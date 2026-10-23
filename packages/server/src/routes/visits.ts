import { CreateVisitSchema, UpdateVisitSchema } from "@hrp/shared/schemas";
import type { CreateVisit, UpdateVisit } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { assertCan } from "../authz/policy.js";
import {
  assertRequestedScope,
  createDbActorLookup,
  facilityScopePredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import { mapVisitChanges, mapVisitToRow } from "../lib/mappers.js";
import { parsePagination } from "../lib/pagination.js";
import { serializeVisit } from "../lib/serializers.js";
import { validateBody } from "../lib/validate.js";
import { recalculatePatientRisk } from "../services/risk.js";

const SORTABLE_COLUMNS = ["visit_date", "created_at", "gestational_weeks"] as const;

export const visitRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, limit, offset, sort } = parsePagination(query, SORTABLE_COLUMNS, "visit_date");
    const requestedFacilityId =
      typeof query.facilityId === "string" && query.facilityId.length > 0
        ? query.facilityId
        : undefined;
    const actor = requestedFacilityId
      ? await assertRequestedScope(request.actor, requestedFacilityId, createDbActorLookup(db))
      : request.actor;

    let base = db
      .selectFrom("visits")
      .innerJoin("facilities", "facilities.id", "visits.facility_id")
      .where(facilityScopePredicate(actor, "facilities.path"));

    if (typeof query.patientId === "string")
      base = base.where("visits.patient_id", "=", query.patientId);
    if (requestedFacilityId) base = base.where("visits.facility_id", "=", requestedFacilityId);
    if (typeof query.conductedBy === "string")
      base = base.where("visits.conducted_by", "=", query.conductedBy);
    if (typeof query.dateFrom === "string")
      base = base.where("visits.visit_date", ">=", new Date(query.dateFrom));
    if (typeof query.dateTo === "string")
      base = base.where("visits.visit_date", "<=", new Date(query.dateTo));

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("visits.id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll("visits")
      .orderBy(
        sql`${sql.ref(`visits.${sort.column}`)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: data.map(serializeVisit), total: Number(totalRow.count), page, limit };
  });

  app.get("/by-patient/:patientId", async (request, reply) => {
    const { patientId } = request.params as { patientId: string };
    const patient = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .select(["patients.id", "facilities.path as facility_path"])
      .where("patients.id", "=", patientId)
      .executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: "Patient not found" });

    assertCan(request.actor, "patient:read", {
      type: "facility",
      facilityPath: patient.facility_path,
    });

    const visits = await db
      .selectFrom("visits")
      .selectAll()
      .where("patient_id", "=", patientId)
      .orderBy("visit_number", "asc")
      .execute();
    return visits.map(serializeVisit);
  });

  app.post("/", { preValidation: validateBody(CreateVisitSchema) }, async (request, reply) => {
    const data = request.body as CreateVisit;
    const actor = request.actor;

    const patient = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .select(["patients.id", "facilities.path as facility_path"])
      .where("patients.id", "=", data.patientId)
      .executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: "Patient not found" });

    assertCan(actor, "visit:write", {
      type: "facility",
      facilityPath: patient.facility_path,
    });

    const row = mapVisitToRow(data, {
      facilityId: actor.homeFacilityId,
      conductedBy: actor.userId,
    });

    const result = await db
      .insertInto("visits")
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Danger signs recorded at this visit change the patient's clinical risk.
    await recalculatePatientRisk(data.patientId);

    return reply.code(201).send(serializeVisit(result));
  });

  app.patch("/:id", { preValidation: validateBody(UpdateVisitSchema) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as UpdateVisit;

    const existing = await db
      .selectFrom("visits")
      .innerJoin("facilities", "facilities.id", "visits.facility_id")
      .selectAll("visits")
      .select("facilities.path as facility_path")
      .where("visits.id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ message: "Visit not found" });

    assertCan(request.actor, "visit:write", {
      type: "facility",
      facilityPath: existing.facility_path,
    });

    const row = mapVisitChanges(data);

    if (data.patientId !== undefined && data.patientId !== existing.patient_id) {
      const patient = await db
        .selectFrom("patients")
        .innerJoin("facilities", "facilities.id", "patients.facility_id")
        .select(["patients.id", "patients.facility_id", "facilities.path as facility_path"])
        .where("patients.id", "=", data.patientId)
        .executeTakeFirst();
      if (!patient) return reply.code(404).send({ message: "Patient not found" });

      assertCan(request.actor, "visit:write", {
        type: "facility",
        facilityPath: patient.facility_path,
      });

      row.facility_id = patient.facility_id;
    }

    const result = await db
      .updateTable("visits")
      .set({ ...row, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await recalculatePatientRisk(existing.patient_id);
    if (result.patient_id !== existing.patient_id) {
      await recalculatePatientRisk(result.patient_id);
    }

    return serializeVisit(result);
  });
};
