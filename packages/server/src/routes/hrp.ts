import { hrpReasonForComplication, scheduleFollowUp } from "@hrp/shared";
import { calculateRiskScore } from "@hrp/shared/rules";
import { CreatePatientSchema, HrpPatientFilterSchema } from "@hrp/shared/schemas";
import type { CreatePatient, HrpPatientFilter } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import { assertCan } from "../authz/policy.js";
import {
  assertRequestedScope,
  createDbActorLookup,
  facilityScopePredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import { mapPatientChanges, mapPatientToRow, toJson } from "../lib/mappers.js";
import { oneOf, parsePagination, toBool } from "../lib/pagination.js";
import { serializePatient } from "../lib/serializers.js";
import { validateBody, validateQuery } from "../lib/validate.js";
import { scoreUnregisteredPatient } from "../services/risk.js";

const SORTABLE_COLUMNS = ["created_at", "name", "risk_level", "risk_score", "lmp"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const zIsHrpSchema = z.object({
  isHrp: z.boolean(),
});

export const hrpRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/patients — list HRP patients with extended filters   *
   * ------------------------------------------------------------------ */
  app.get("/", { preValidation: validateQuery(HrpPatientFilterSchema) }, async (request) => {
    const query = request.query as HrpPatientFilter;
    const { page, limit, offset, sort } = parsePagination(
      query as Record<string, unknown>,
      SORTABLE_COLUMNS,
      "created_at"
    );

    const requestedFacilityId = query.facilityId;
    const actor = requestedFacilityId
      ? await assertRequestedScope(request.actor, requestedFacilityId, createDbActorLookup(db))
      : request.actor;

    let base = db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .leftJoin("users as anm", "anm.id", "patients.registered_by")
      .where(facilityScopePredicate(actor, "facilities.path"));

    if (requestedFacilityId) base = base.where("patients.facility_id", "=", requestedFacilityId);

    if (query.isHrp !== undefined) base = base.where("patients.is_hrp", "=", query.isHrp);
    if (query.isReferred !== undefined)
      base = base.where("patients.referred", "=", query.isReferred);
    if (query.hrpComplication !== undefined)
      base = base.where("patients.hrp_complication", "=", query.hrpComplication);
    if (query.followUpStatus !== undefined)
      base = base.where("patients.follow_up_status", "=", query.followUpStatus);

    const riskLevel = oneOf(query.riskLevel, ["GREEN", "AMBER", "RED"] as const);
    if (riskLevel !== undefined) base = base.where("patients.risk_level", "=", riskLevel);

    if (typeof query.search === "string" && query.search.length > 0) {
      const term = `%${query.search}%`;
      base = base.where((eb) =>
        eb.or([eb("patients.name", "ilike", term), eb("patients.phone", "ilike", term)])
      );
      if (UUID_PATTERN.test(query.search)) {
        base = base.where("patients.id", "=", query.search);
      }
    }

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("patients.id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll("patients")
      .select("anm.name as anm_name")
      .orderBy(
        sql`${sql.ref("patients")}.${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      data: data.map((row) => serializePatient(row, row.anm_name)),
      total: Number(totalRow.count),
      page,
      limit,
    };
  });

  /* ------------------------------------------------------------------ *
   *  POST /api/hrp/patients — create patient (Add Form)                *
   * ------------------------------------------------------------------ */
  app.post("/", { preValidation: validateBody(CreatePatientSchema) }, async (request, reply) => {
    const data = request.body as CreatePatient;
    const actor = request.actor;

    assertCan(actor, "patient:write", {
      type: "facility",
      facilityPath: actor.homeFacilityPath,
    });

    // The intake dropdown and the risk engine use different vocabularies.
    // Bridge them so a recorded complication always scores AMBER or above.
    const hrpReason = data.hrpReason ?? hrpReasonForComplication(data.hrpComplication);

    const { score, level } = scoreUnregisteredPatient({
      name: data.name,
      age: data.age,
      riskFactors: data.riskFactors ?? [],
      hrpReason,
    });

    const row = mapPatientToRow(
      { ...data, hrpReason },
      {
        facilityId: actor.homeFacilityId,
        registeredBy: actor.userId,
      }
    );

    const result = await db
      .insertInto("patients")
      .values({
        ...row,
        risk_score: score,
        risk_level: level,
        is_high_risk: level !== "GREEN",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Automated follow-up scheduling: no manual toggle. The registering
    // worker owns the first contact; the block helpdesk can re-dispatch it.
    if (data.isHrp) {
      const { track, scheduledDate } = scheduleFollowUp(
        { village: actor.homeFacilityPath },
        new Date()
      );

      await db
        .updateTable("patients")
        .set({ follow_up_track: track, follow_up_scheduled_date: scheduledDate })
        .where("id", "=", result.id)
        .execute();

      await db
        .insertInto("follow_ups")
        .values({
          patient_id: result.id,
          assigned_to_user_id: actor.userId,
          assigned_by_user_id: actor.userId,
          level: actor.role === "ANM" ? "ANM" : actor.role === "CHO" ? "CHO" : "BLOCK_NODAL",
          track,
          scheduled_date: scheduledDate,
        })
        .execute();
    }

    return reply.code(201).send(serializePatient(result));
  });

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/patients/:id                                         *
   * ------------------------------------------------------------------ */
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .leftJoin("users as anm", "anm.id", "patients.registered_by")
      .selectAll("patients")
      .select("anm.name as anm_name")
      .select("facilities.path as facility_path")
      .where("patients.id", "=", id)
      .executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: "Patient not found" });

    assertCan(request.actor, "patient:read", {
      type: "facility",
      facilityPath: patient.facility_path,
    });

    return serializePatient(patient, patient.anm_name);
  });

  /* ------------------------------------------------------------------ *
   *  PATCH /api/hrp/patients/:id                                       *
   * ------------------------------------------------------------------ */
  app.patch(
    "/:id",
    { preValidation: validateBody(HrpPatientFilterSchema.partial()) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as Partial<CreatePatient> & { isHrp?: boolean };

      const existing = await db
        .selectFrom("patients")
        .innerJoin("facilities", "facilities.id", "patients.facility_id")
        .selectAll("patients")
        .select("facilities.path as facility_path")
        .where("patients.id", "=", id)
        .executeTakeFirst();
      if (!existing) return reply.code(404).send({ message: "Patient not found" });

      assertCan(request.actor, "patient:write", {
        type: "facility",
        facilityPath: existing.facility_path,
      });

      const row = mapPatientChanges(data as import("@hrp/shared/schemas").UpdatePatient);

      const existingPatient = serializePatient(existing);
      const riskFactors = data.riskFactors ?? existingPatient.riskFactors;
      const hrpReason = data.hrpReason === undefined ? existingPatient.hrpReason : data.hrpReason;
      const { score, level } = calculateRiskScore(
        { ...existingPatient, hrpReason, riskFactors },
        null
      );

      const result = await db
        .updateTable("patients")
        .set({
          ...row,
          risk_factors: toJson(riskFactors),
          risk_score: score,
          risk_level: level,
          is_high_risk: level !== "GREEN",
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return serializePatient(result);
    }
  );

  /* ------------------------------------------------------------------ *
   *  PATCH /api/hrp/patients/:id/hrp — mark/unmark as HRP              *
   *  Automated follow-up scheduling when marked HRP (no manual toggle) *
   * ------------------------------------------------------------------ */
  app.patch("/:id/hrp", { preValidation: validateBody(zIsHrpSchema) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { isHrp } = request.body as { isHrp: boolean };

    const existing = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("patients")
      .select("facilities.path as facility_path")
      .select("facilities.name as facility_name")
      .where("patients.id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ message: "Patient not found" });

    assertCan(request.actor, "patient:write", {
      type: "facility",
      facilityPath: existing.facility_path,
    });

    let followUpTrack: string | null = null;
    let followUpScheduledDate: Date | null = null;

    if (isHrp && !existing.is_hrp) {
      const identifiedDate = new Date();
      const { track, scheduledDate } = scheduleFollowUp(
        { village: existing.facility_name },
        identifiedDate
      );
      followUpTrack = track;
      followUpScheduledDate = scheduledDate;
    }

    const result = await db
      .updateTable("patients")
      .set({
        is_hrp: isHrp,
        ...(followUpTrack
          ? {
              follow_up_track: followUpTrack as
                | "IMMEDIATE_7_DAYS"
                | "PMSMA_SESSION"
                | "VHSND_COMMUNITY",
            }
          : {}),
        ...(followUpScheduledDate ? { follow_up_scheduled_date: followUpScheduledDate } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return serializePatient(result);
  });
};
