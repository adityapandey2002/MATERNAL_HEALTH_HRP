import { hrpReasonForComplication, scheduleFollowUp } from "@hrp/shared";
import { calculateRiskScore } from "@hrp/shared/rules";
import { SyncPayloadSchema, SyncPullQuerySchema } from "@hrp/shared/schemas";
import type {
  SyncFollowUp,
  SyncPatient,
  SyncPayload,
  SyncPullQuery,
  SyncReferral,
  SyncVisit,
} from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { type Insertable, type Kysely, type Updateable, sql } from "kysely";
import { assertCan } from "../authz/policy.js";
import {
  type ActorScope,
  facilityScopePredicate,
  referralVisibilityPredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import type { DB } from "../db/types.js";
import { mapPatientToRow, mapReferralToRow, mapVisitToRow } from "../lib/mappers.js";
import {
  serializeFollowUp,
  serializePatient,
  serializeReferral,
  serializeVisit,
} from "../lib/serializers.js";
import { validateBody, validateQuery } from "../lib/validate.js";
import { nextFieldFollowUpValues, resolveInitialFollowUpOwner } from "../services/hrp-follow-up.js";
import { recalculatePatientRisk, scoreUnregisteredPatient } from "../services/risk.js";

interface Conflict {
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
}

interface RejectedItem {
  entityType: string;
  entityId?: string;
  reason: string;
}

interface Outcomes {
  conflicts: Conflict[];
  rejected: RejectedItem[];
}

async function findPatientWithFacility(id: string) {
  return db
    .selectFrom("patients")
    .innerJoin("facilities", "facilities.id", "patients.facility_id")
    .selectAll("patients")
    .select("facilities.path as facility_path")
    .where("patients.id", "=", id)
    .executeTakeFirst();
}

async function findVisitWithFacility(id: string) {
  return db
    .selectFrom("visits")
    .innerJoin("facilities", "facilities.id", "visits.facility_id")
    .selectAll("visits")
    .select("facilities.path as facility_path")
    .where("visits.id", "=", id)
    .executeTakeFirst();
}

async function findReferralWithFacilities(id: string) {
  return db
    .selectFrom("referrals")
    .innerJoin("facilities as from_facility", "from_facility.id", "referrals.from_facility_id")
    .innerJoin("facilities as to_facility", "to_facility.id", "referrals.to_facility_id")
    .selectAll("referrals")
    .select([
      "from_facility.path as from_facility_path",
      "to_facility.path as to_facility_path",
      "to_facility.level as to_facility_level",
    ])
    .where("referrals.id", "=", id)
    .executeTakeFirst();
}

async function findFollowUpWithPatient(id: string, trx: Kysely<DB>) {
  return trx
    .selectFrom("follow_ups")
    .innerJoin("patients", "patients.id", "follow_ups.patient_id")
    .innerJoin("facilities", "facilities.id", "patients.facility_id")
    .selectAll("follow_ups")
    .select([
      "patients.is_hrp as patient_is_hrp",
      "patients.registered_by as patient_registered_by",
      "facilities.path as facility_path",
    ])
    .where("follow_ups.id", "=", id)
    .executeTakeFirst();
}

async function syncPatients(
  trx: Kysely<DB>,
  actor: ActorScope,
  patients: SyncPatient[],
  outcomes: Outcomes,
  serverTimestamp: Date
): Promise<void> {
  for (const p of patients) {
    try {
      const existing = p.id ? await findPatientWithFacility(p.id) : undefined;

      if (existing) {
        assertCan(actor, "patient:write", {
          type: "facility",
          facilityPath: existing.facility_path,
        });

        if (p.updatedAt && existing.updated_at > p.updatedAt) {
          outcomes.conflicts.push({
            entityType: "PATIENT",
            entityId: existing.id,
            serverVersion: serializePatient(existing),
            clientVersion: p,
          });
          continue;
        }

        const row = mapPatientToRow(p, {
          facilityId: existing.facility_id,
          registeredBy: existing.registered_by,
        });
        await trx
          .updateTable("patients")
          .set({ ...row, updated_at: serverTimestamp })
          .where("id", "=", existing.id)
          .execute();
        continue;
      }

      assertCan(actor, "patient:write", {
        type: "facility",
        facilityPath: actor.homeFacilityPath,
      });

      const hrpReason = p.hrpReason ?? null;

      const { score, level } = scoreUnregisteredPatient({
        name: p.name,
        age: p.age,
        riskFactors: p.riskFactors ?? [],
        hrpReason: hrpReason as never,
      });

      const row = mapPatientToRow(
        { ...p, hrpReason },
        {
          facilityId: actor.homeFacilityId,
          registeredBy: actor.userId,
        }
      );

      const inserted = await trx
        .insertInto("patients")
        .values({
          ...row,
          ...(p.id ? { id: p.id } : {}),
          risk_score: score,
          risk_level: level,
          is_high_risk: level !== "GREEN",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (p.isHrp) {
        const { track, scheduledDate } = scheduleFollowUp({ referred: p.referred }, new Date());
        const owner = await resolveInitialFollowUpOwner(trx, {
          facilityPath: actor.homeFacilityPath,
          actor: { userId: actor.userId, role: actor.role },
          track,
        });

        await trx
          .insertInto("follow_ups")
          .values({
            patient_id: inserted.id,
            assigned_to_user_id: owner.userId,
            assigned_by_user_id: actor.userId,
            level: owner.level,
            track,
            scheduled_date: scheduledDate,
          })
          .execute();

        await trx
          .updateTable("patients")
          .set({ follow_up_track: track, follow_up_scheduled_date: scheduledDate })
          .where("id", "=", inserted.id)
          .execute();
      }
    } catch (err) {
      outcomes.rejected.push({
        entityType: "PATIENT",
        entityId: p.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function syncVisits(
  trx: Kysely<DB>,
  actor: ActorScope,
  visits: SyncVisit[],
  outcomes: Outcomes,
  serverTimestamp: Date
): Promise<void> {
  for (const v of visits) {
    try {
      const patient = await findPatientWithFacility(v.patientId);
      if (!patient) {
        outcomes.rejected.push({
          entityType: "VISIT",
          entityId: v.id,
          reason: "Patient not found",
        });
        continue;
      }

      const existing = v.id ? await findVisitWithFacility(v.id) : undefined;

      if (existing) {
        assertCan(actor, "visit:write", {
          type: "facility",
          facilityPath: existing.facility_path,
        });

        let facilityId = existing.facility_id;
        const moved = v.patientId !== existing.patient_id;
        if (moved) {
          assertCan(actor, "visit:write", {
            type: "facility",
            facilityPath: patient.facility_path,
          });
          facilityId = patient.facility_id;
        }

        if (v.updatedAt && existing.updated_at > v.updatedAt) {
          outcomes.conflicts.push({
            entityType: "VISIT",
            entityId: existing.id,
            serverVersion: serializeVisit(existing),
            clientVersion: v,
          });
          continue;
        }

        const row = mapVisitToRow(v, {
          facilityId,
          conductedBy: existing.conducted_by,
        });
        await trx
          .updateTable("visits")
          .set({ ...row, updated_at: serverTimestamp })
          .where("id", "=", existing.id)
          .execute();

        await recalculatePatientRisk(existing.patient_id);
        if (moved) await recalculatePatientRisk(v.patientId);
        continue;
      }

      assertCan(actor, "visit:write", {
        type: "facility",
        facilityPath: patient.facility_path,
      });

      const row = mapVisitToRow(v, {
        facilityId: actor.homeFacilityId,
        conductedBy: actor.userId,
      });
      await trx
        .insertInto("visits")
        .values({
          ...row,
          ...(v.id ? { id: v.id } : {}),
          visit_date: row.visit_date ?? new Date(),
        })
        .execute();

      await recalculatePatientRisk(v.patientId);
    } catch (err) {
      outcomes.rejected.push({
        entityType: "VISIT",
        entityId: v.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function syncReferrals(
  trx: Kysely<DB>,
  actor: ActorScope,
  referrals: SyncReferral[],
  outcomes: Outcomes,
  serverTimestamp: Date
): Promise<void> {
  for (const r of referrals) {
    try {
      const patient = await findPatientWithFacility(r.patientId);
      if (!patient) {
        outcomes.rejected.push({
          entityType: "REFERRAL",
          entityId: r.id,
          reason: "Patient not found",
        });
        continue;
      }

      const destination = await trx
        .selectFrom("facilities")
        .select(["id"])
        .where("id", "=", r.toFacilityId)
        .executeTakeFirst();
      if (!destination) {
        outcomes.rejected.push({
          entityType: "REFERRAL",
          entityId: r.id,
          reason: "Destination facility not found",
        });
        continue;
      }

      const existing = r.id ? await findReferralWithFacilities(r.id) : undefined;

      if (existing) {
        const isCreator = existing.from_facility_path === actor.homeFacilityPath;
        if (!isCreator) {
          assertCan(actor, "referral:respond", {
            type: "referral",
            fromFacilityPath: existing.from_facility_path,
            toFacilityPath: existing.to_facility_path,
            toFacilityLevel: existing.to_facility_level,
          });
        }

        if (r.updatedAt && existing.updated_at > r.updatedAt) {
          outcomes.conflicts.push({
            entityType: "REFERRAL",
            entityId: existing.id,
            serverVersion: serializeReferral(existing),
            clientVersion: r,
          });
          continue;
        }

        await trx
          .updateTable("referrals")
          .set({
            reason: r.reason,
            urgency: r.urgency,
            updated_at: serverTimestamp,
          })
          .where("id", "=", existing.id)
          .execute();
        continue;
      }

      assertCan(actor, "referral:create", {
        type: "facility",
        facilityPath: patient.facility_path,
      });

      const row = mapReferralToRow(r, {
        fromFacilityId: actor.homeFacilityId,
        referredBy: actor.userId,
      });
      await trx
        .insertInto("referrals")
        .values({
          ...row,
          ...(r.id ? { id: r.id } : {}),
          status: "PENDING",
        })
        .execute();
    } catch (err) {
      outcomes.rejected.push({
        entityType: "REFERRAL",
        entityId: r.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function clampCompletedAt(completedAt: Date, now: Date): Date {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (completedAt < thirtyDaysAgo) return thirtyDaysAgo;
  if (completedAt > now) return now;
  return completedAt;
}

async function startNextFieldCycle(
  trx: Kysely<DB>,
  patientId: string,
  registeredBy: string | null,
  actor: ActorScope,
  completedAt: Date,
  serverTimestamp: Date
): Promise<void> {
  const registrant = await trx
    .selectFrom("users")
    .select(["id", "role"])
    .where("id", "=", registeredBy ?? "")
    .executeTakeFirst();

  const next = nextFieldFollowUpValues({
    patientId,
    registrantUserId: registrant?.id ?? actor.userId,
    registrantRole: registrant?.role ?? null,
    assignedByUserId: actor.userId,
    completedAt,
  });

  await trx.insertInto("follow_ups").values(next).execute();
  await trx
    .updateTable("patients")
    .set({
      follow_up_track: next.track,
      follow_up_scheduled_date: next.scheduled_date,
      updated_at: serverTimestamp,
    })
    .where("id", "=", patientId)
    .execute();
}
async function syncFollowUps(
  trx: Kysely<DB>,
  actor: ActorScope,
  followUps: SyncFollowUp[],
  outcomes: Outcomes,
  serverTimestamp: Date
): Promise<void> {
  for (const f of followUps) {
    try {
      const existing = f.id ? await findFollowUpWithPatient(f.id, trx) : undefined;

      if (existing) {
        assertCan(actor, "followup:manage", {
          type: "facility",
          facilityPath: existing.facility_path,
        });

        // Conflict check: if server is newer, record and skip.
        if (f.updatedAt && existing.updated_at > f.updatedAt) {
          outcomes.conflicts.push({
            entityType: "FOLLOWUP",
            entityId: existing.id,
            serverVersion: serializeFollowUp(existing),
            clientVersion: f,
          });
          continue;
        }

        const completedAt = clampCompletedAt(
          f.completedAt ? new Date(f.completedAt) : serverTimestamp,
          serverTimestamp
        );

        const setClause: Updateable<DB["follow_ups"]> = {
          status: f.status ?? existing.status,
          updated_at: serverTimestamp,
        };
        if (f.notes !== undefined) setClause.notes = f.notes;
        if (f.status === "COMPLETE" && existing.status !== "COMPLETE") {
          setClause.completed_at = completedAt;
          setClause.completed_by_user_id = actor.userId;
        }

        const updated = await trx
          .updateTable("follow_ups")
          .set(setClause)
          .where("id", "=", existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();

        // Start the next cycle when a referred HRP's cycle is first completed.
        if (f.status === "COMPLETE" && existing.status !== "COMPLETE" && existing.patient_is_hrp) {
          const otherOpen = await trx
            .selectFrom("follow_ups")
            .select("id")
            .where("patient_id", "=", existing.patient_id)
            .where("status", "!=", "COMPLETE")
            .where("id", "!=", existing.id)
            .executeTakeFirst();

          if (!otherOpen) {
            await startNextFieldCycle(
              trx,
              existing.patient_id,
              existing.patient_registered_by,
              actor,
              completedAt,
              serverTimestamp
            );
          }
        }
        void updated;
        continue;
      }

      // New follow-up (client-supplied id). Only referred-HRP initial cycles
      // are created via the registration flow; sync-created rows are updates.
      outcomes.rejected.push({
        entityType: "FOLLOWUP",
        entityId: f.id,
        reason: "Follow-up not found (sync only updates existing rows)",
      });
    } catch (err) {
      outcomes.rejected.push({
        entityType: "FOLLOWUP",
        entityId: f.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.post("/push", { preValidation: validateBody(SyncPayloadSchema) }, async (request, _reply) => {
    const body = request.body as SyncPayload;
    const actor = request.actor;
    const serverTimestamp = new Date();
    const outcomes: Outcomes = { conflicts: [], rejected: [] };

    await db.transaction().execute(async (trx) => {
      await syncPatients(trx, actor, body.patients ?? [], outcomes, serverTimestamp);
      await syncVisits(trx, actor, body.visits ?? [], outcomes, serverTimestamp);
      await syncReferrals(trx, actor, body.referrals ?? [], outcomes, serverTimestamp);
      await syncFollowUps(trx, actor, body.followUps ?? [], outcomes, serverTimestamp);
    });

    const syncedPatients = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("patients")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .execute();
    const syncedVisits = await db
      .selectFrom("visits")
      .innerJoin("facilities", "facilities.id", "visits.facility_id")
      .selectAll("visits")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .execute();
    const syncedReferrals = await db
      .selectFrom("referrals")
      .innerJoin("facilities as from_facility", "from_facility.id", "referrals.from_facility_id")
      .innerJoin("facilities as to_facility", "to_facility.id", "referrals.to_facility_id")
      .selectAll("referrals")
      .where(referralVisibilityPredicate(actor, "from_facility.path", "to_facility.path"))
      .execute();
    const syncedFollowUps = await db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("follow_ups")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .execute();

    return {
      patients: syncedPatients.map((row) => serializePatient(row)),
      visits: syncedVisits.map(serializeVisit),
      referrals: syncedReferrals.map(serializeReferral),
      followUps: syncedFollowUps.map((row) => serializeFollowUp(row)),
      serverTimestamp,
      conflicts: outcomes.conflicts.length > 0 ? outcomes.conflicts : undefined,
      rejected: outcomes.rejected.length > 0 ? outcomes.rejected : undefined,
    };
  });

  app.get("/pull", { preValidation: validateQuery(SyncPullQuerySchema) }, async (request) => {
    const { since } = request.query as SyncPullQuery;
    const actor = request.actor;
    const sinceDate = since ?? new Date(0);

    const patients = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("patients")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .where("patients.updated_at", ">", sinceDate)
      .execute();
    const visits = await db
      .selectFrom("visits")
      .innerJoin("facilities", "facilities.id", "visits.facility_id")
      .selectAll("visits")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .where("visits.updated_at", ">", sinceDate)
      .execute();
    const referrals = await db
      .selectFrom("referrals")
      .innerJoin("facilities as from_facility", "from_facility.id", "referrals.from_facility_id")
      .innerJoin("facilities as to_facility", "to_facility.id", "referrals.to_facility_id")
      .selectAll("referrals")
      .where(referralVisibilityPredicate(actor, "from_facility.path", "to_facility.path"))
      .where("referrals.updated_at", ">", sinceDate)
      .execute();
    const followUps = await db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("follow_ups")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .where("follow_ups.updated_at", ">", sinceDate)
      .execute();

    return {
      patients: patients.map((row) => serializePatient(row)),
      visits: visits.map(serializeVisit),
      referrals: referrals.map(serializeReferral),
      followUps: followUps.map((row) => serializeFollowUp(row)),
      serverTimestamp: new Date(),
    };
  });
};
