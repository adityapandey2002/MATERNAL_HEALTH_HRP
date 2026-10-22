import { CreateVisitSchema, UpdateVisitSchema } from "@hrp/shared/schemas";
import type { CreateVisit, UpdateVisit } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
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

    let base = db.selectFrom("visits");

    if (typeof query.patientId === "string") base = base.where("patient_id", "=", query.patientId);
    if (typeof query.facilityId === "string")
      base = base.where("facility_id", "=", query.facilityId);
    if (typeof query.conductedBy === "string")
      base = base.where("conducted_by", "=", query.conductedBy);
    if (typeof query.dateFrom === "string")
      base = base.where("visit_date", ">=", new Date(query.dateFrom));
    if (typeof query.dateTo === "string")
      base = base.where("visit_date", "<=", new Date(query.dateTo));

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll()
      .orderBy(sql`${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`)
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: data.map(serializeVisit), total: Number(totalRow.count), page, limit };
  });

  app.get("/by-patient/:patientId", async (request) => {
    const { patientId } = request.params as { patientId: string };
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
    const user = request.user;

    const row = mapVisitToRow(data, {
      facilityId: user.facilityId,
      conductedBy: user.sub,
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
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ message: "Visit not found" });

    const row = mapVisitChanges(data);

    const result = await db
      .updateTable("visits")
      .set({ ...row, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await recalculatePatientRisk(result.patient_id);

    return serializeVisit(result);
  });
};
