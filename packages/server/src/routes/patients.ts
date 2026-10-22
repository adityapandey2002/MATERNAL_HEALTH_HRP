import { calculateRiskScore } from "@hrp/shared/rules";
import { CreatePatientSchema, UpdatePatientSchema } from "@hrp/shared/schemas";
import type { CreatePatient, UpdatePatient } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { mapPatientChanges, mapPatientToRow, toJson } from "../lib/mappers.js";
import { oneOf, parsePagination, toBool } from "../lib/pagination.js";
import { serializePatient } from "../lib/serializers.js";
import { validateBody } from "../lib/validate.js";
import { scoreUnregisteredPatient } from "../services/risk.js";

const SORTABLE_COLUMNS = ["created_at", "name", "risk_level", "risk_score", "lmp"] as const;
const RISK_LEVELS = ["GREEN", "AMBER", "RED"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const patientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, limit, offset, sort } = parsePagination(query, SORTABLE_COLUMNS, "created_at");

    // The block-level dashboard shows which ANM registered each woman, and
    // supervisors filter by ANM name. Joining keeps that lookup in one query.
    let base = db
      .selectFrom("patients")
      .leftJoin("users as anm", "anm.id", "patients.registered_by");
    const isHighRisk = toBool(query.isHighRisk);
    const riskLevel = oneOf(query.riskLevel, RISK_LEVELS);

    if (typeof query.facilityId === "string")
      base = base.where("patients.facility_id", "=", query.facilityId);
    if (riskLevel !== undefined) base = base.where("patients.risk_level", "=", riskLevel);
    if (isHighRisk !== undefined) base = base.where("patients.is_high_risk", "=", isHighRisk);
    if (typeof query.registeredBy === "string" && query.registeredBy.length > 0)
      base = base.where("patients.registered_by", "=", query.registeredBy);
    if (typeof query.anmName === "string" && query.anmName.trim().length > 0)
      base = base.where("anm.name", "ilike", `%${query.anmName.trim()}%`);
    if (typeof query.search === "string" && query.search.length > 0) {
      const term = `%${query.search}%`;
      base = base.where((eb) =>
        eb.or([eb("patients.name", "ilike", term), eb("patients.phone", "ilike", term)])
      );
      // `id` is a uuid, so it can only be matched by an exact uuid. Casting
      // the column to text would make the term an untyped literal and fail.
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

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = await db
      .selectFrom("patients")
      .leftJoin("users as anm", "anm.id", "patients.registered_by")
      .selectAll("patients")
      .select("anm.name as anm_name")
      .where("patients.id", "=", id)
      .executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: "Patient not found" });
    return serializePatient(patient, patient.anm_name);
  });

  app.post("/", { preValidation: validateBody(CreatePatientSchema) }, async (request, reply) => {
    const data = request.body as CreatePatient;
    const user = request.user;

    const { score, level } = scoreUnregisteredPatient({
      name: data.name,
      age: data.age,
      riskFactors: data.riskFactors ?? [],
      hrpReason: data.hrpReason ?? null,
    });

    const row = mapPatientToRow(data, {
      facilityId: user.facilityId,
      registeredBy: user.sub,
    });

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

    return reply.code(201).send(serializePatient(result));
  });

  app.patch(
    "/:id",
    { preValidation: validateBody(UpdatePatientSchema) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdatePatient;

      const existing = await db
        .selectFrom("patients")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      if (!existing) return reply.code(404).send({ message: "Patient not found" });

      const row = mapPatientChanges(data);

      const existingPatient = serializePatient(existing);
      const riskFactors = data.riskFactors ?? existingPatient.riskFactors;
      // An explicit null clears the reason; undefined keeps the stored one.
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

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.deleteFrom("patients").where("id", "=", id).execute();
    return reply.code(204).send();
  });
};
