import { SyncPayloadSchema, SyncPullQuerySchema } from "@hrp/shared/schemas";
import type {
  SyncPatient,
  SyncPayload,
  SyncPullQuery,
  SyncReferral,
  SyncVisit,
} from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { assertCan } from "../authz/policy.js";
import {
  type ActorScope,
  facilityScopePredicate,
  referralVisibilityPredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import { mapPatientToRow, mapReferralToRow, mapVisitToRow } from "../lib/mappers.js";
import { serializePatient, serializeReferral, serializeVisit } from "../lib/serializers.js";
import { validateBody, validateQuery } from "../lib/validate.js";
import { recalculatePatientRisk } from "../services/risk.js";

interface Conflict {
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
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

async function syncPatients(
  actor: ActorScope,
  patients: SyncPatient[],
  conflicts: Conflict[],
  serverTimestamp: Date
): Promise<void> {
  for (const p of patients) {
    const existing = p.id ? await findPatientWithFacility(p.id) : undefined;

    if (existing) {
      assertCan(actor, "patient:write", {
        type: "facility",
        facilityPath: existing.facility_path,
      });

      if (p.updatedAt && existing.updated_at > p.updatedAt) {
        conflicts.push({
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
      await db
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

    const row = mapPatientToRow(p, {
      facilityId: actor.homeFacilityId,
      registeredBy: actor.userId,
    });
    await db
      .insertInto("patients")
      .values({ ...row, ...(p.id ? { id: p.id } : {}) })
      .execute();
  }
}

async function syncVisits(
  actor: ActorScope,
  visits: SyncVisit[],
  conflicts: Conflict[],
  serverTimestamp: Date
): Promise<string | undefined> {
  for (const v of visits) {
    const patient = await findPatientWithFacility(v.patientId);
    if (!patient) return "Patient not found";

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
        conflicts.push({
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
      await db
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
    await db
      .insertInto("visits")
      .values({
        ...row,
        ...(v.id ? { id: v.id } : {}),
        visit_date: row.visit_date ?? new Date(),
      })
      .execute();

    await recalculatePatientRisk(v.patientId);
  }

  return undefined;
}

async function syncReferrals(
  actor: ActorScope,
  referrals: SyncReferral[],
  conflicts: Conflict[],
  serverTimestamp: Date
): Promise<string | undefined> {
  for (const r of referrals) {
    const patient = await findPatientWithFacility(r.patientId);
    if (!patient) return "Patient not found";

    const destination = await db
      .selectFrom("facilities")
      .select(["id"])
      .where("id", "=", r.toFacilityId)
      .executeTakeFirst();
    if (!destination) return "Destination facility not found";

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
        conflicts.push({
          entityType: "REFERRAL",
          entityId: existing.id,
          serverVersion: serializeReferral(existing),
          clientVersion: r,
        });
        continue;
      }

      await db
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
    await db
      .insertInto("referrals")
      .values({
        ...row,
        ...(r.id ? { id: r.id } : {}),
        status: "PENDING",
      })
      .execute();
  }

  return undefined;
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.post("/push", { preValidation: validateBody(SyncPayloadSchema) }, async (request, reply) => {
    const body = request.body as SyncPayload;
    const actor = request.actor;
    const serverTimestamp = new Date();
    const conflicts: Conflict[] = [];

    await syncPatients(actor, body.patients ?? [], conflicts, serverTimestamp);

    const visitError = await syncVisits(actor, body.visits ?? [], conflicts, serverTimestamp);
    if (visitError) return reply.code(404).send({ message: visitError });

    const referralError = await syncReferrals(
      actor,
      body.referrals ?? [],
      conflicts,
      serverTimestamp
    );
    if (referralError) return reply.code(404).send({ message: referralError });

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

    return {
      patients: syncedPatients.map((row) => serializePatient(row)),
      visits: syncedVisits.map(serializeVisit),
      referrals: syncedReferrals.map(serializeReferral),
      serverTimestamp,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
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

    return {
      patients: patients.map((row) => serializePatient(row)),
      visits: visits.map(serializeVisit),
      referrals: referrals.map(serializeReferral),
      serverTimestamp: new Date(),
    };
  });
};
