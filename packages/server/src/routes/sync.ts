import type { Patient, Referral, Visit } from "@hrp/shared";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { mapPatientToRow, mapReferralToRow, mapVisitToRow } from "../lib/mappers.js";
import { serializePatient, serializeReferral, serializeVisit } from "../lib/serializers.js";
import { recalculatePatientRisk } from "../services/risk.js";

interface Conflict {
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
}

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.post("/push", async (request, _reply) => {
    const body = request.body as {
      patients?: Patient[];
      visits?: Visit[];
      referrals?: Referral[];
    };
    const patients = body.patients ?? [];
    const visits = body.visits ?? [];
    const referrals = body.referrals ?? [];
    const user = request.user;
    const serverTimestamp = new Date();
    const conflicts: Conflict[] = [];

    for (const p of patients) {
      const existing = await db
        .selectFrom("patients")
        .selectAll()
        .where("id", "=", p.id)
        .executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(p.updatedAt)) {
        conflicts.push({
          entityType: "PATIENT",
          entityId: p.id,
          serverVersion: serializePatient(existing),
          clientVersion: p,
        });
        continue;
      }
      const row = mapPatientToRow(p, {
        facilityId: user.facilityId,
        registeredBy: user.sub,
      });
      await db
        .insertInto("patients")
        .values({ ...row, id: p.id, name: p.name, age: p.age })
        .onConflict((oc) => oc.column("id").doUpdateSet({ ...row, updated_at: serverTimestamp }))
        .execute();
    }

    for (const v of visits) {
      const existing = await db
        .selectFrom("visits")
        .selectAll()
        .where("id", "=", v.id)
        .executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(v.updatedAt)) {
        conflicts.push({
          entityType: "VISIT",
          entityId: v.id,
          serverVersion: serializeVisit(existing),
          clientVersion: v,
        });
        continue;
      }
      const row = mapVisitToRow(v, {
        facilityId: user.facilityId,
        conductedBy: user.sub,
      });
      await db
        .insertInto("visits")
        .values({
          ...row,
          id: v.id,
          patient_id: v.patientId,
          visit_number: v.visitNumber,
          gestational_weeks: v.gestationalWeeks,
          visit_date: row.visit_date ?? new Date(),
        })
        .onConflict((oc) => oc.column("id").doUpdateSet({ ...row, updated_at: serverTimestamp }))
        .execute();
    }

    for (const r of referrals) {
      const existing = await db
        .selectFrom("referrals")
        .selectAll()
        .where("id", "=", r.id)
        .executeTakeFirst();
      if (existing && new Date(existing.updated_at) > new Date(r.updatedAt)) {
        conflicts.push({
          entityType: "REFERRAL",
          entityId: r.id,
          serverVersion: serializeReferral(existing),
          clientVersion: r,
        });
        continue;
      }
      const row = mapReferralToRow(r, {
        fromFacilityId: user.facilityId,
        referredBy: user.sub,
      });
      await db
        .insertInto("referrals")
        .values({
          ...row,
          id: r.id,
          patient_id: r.patientId,
          to_facility_id: r.toFacilityId,
          reason: r.reason,
          urgency: r.urgency,
          status: "PENDING",
        })
        .onConflict((oc) => oc.column("id").doUpdateSet({ ...row, updated_at: serverTimestamp }))
        .execute();
    }

    // Danger signs captured offline still change clinical risk once synced.
    for (const v of visits) {
      if (v.patientId) await recalculatePatientRisk(v.patientId);
    }

    const syncedPatients = await db
      .selectFrom("patients")
      .selectAll()
      .where("facility_id", "=", user.facilityId)
      .execute();
    const syncedVisits = await db
      .selectFrom("visits")
      .selectAll()
      .where("facility_id", "=", user.facilityId)
      .execute();
    const syncedReferrals = await db
      .selectFrom("referrals")
      .selectAll()
      .where("from_facility_id", "=", user.facilityId)
      .execute();

    return {
      patients: syncedPatients.map((row) => serializePatient(row)),
      visits: syncedVisits.map(serializeVisit),
      referrals: syncedReferrals.map(serializeReferral),
      serverTimestamp,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  });

  app.get("/pull", async (request) => {
    const { since } = request.query as { since?: string };
    const user = request.user;
    const sinceDate = since ? new Date(since) : new Date(0);

    const patients = await db
      .selectFrom("patients")
      .selectAll()
      .where("facility_id", "=", user.facilityId)
      .where("updated_at", ">", sinceDate)
      .execute();
    const visits = await db
      .selectFrom("visits")
      .selectAll()
      .where("facility_id", "=", user.facilityId)
      .where("updated_at", ">", sinceDate)
      .execute();
    const referrals = await db
      .selectFrom("referrals")
      .selectAll()
      .where("from_facility_id", "=", user.facilityId)
      .where("updated_at", ">", sinceDate)
      .execute();

    return {
      patients: patients.map((row) => serializePatient(row)),
      visits: visits.map(serializeVisit),
      referrals: referrals.map(serializeReferral),
      serverTimestamp: new Date(),
    };
  });
};
