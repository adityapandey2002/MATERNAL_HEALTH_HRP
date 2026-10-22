import { CreateReferralSchema } from "@hrp/shared/schemas";
import type { CreateReferral } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { mapReferralToRow } from "../lib/mappers.js";
import { oneOf, parsePagination } from "../lib/pagination.js";
import { serializeReferral } from "../lib/serializers.js";
import { validateBody } from "../lib/validate.js";

const SORTABLE_COLUMNS = ["created_at", "status", "urgency"] as const;
const REFERRAL_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"] as const;

export const referralRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, limit, offset, sort } = parsePagination(query, SORTABLE_COLUMNS, "created_at");

    let base = db.selectFrom("referrals");
    const status = oneOf(query.status, REFERRAL_STATUSES);

    if (status !== undefined) base = base.where("status", "=", status);
    if (typeof query.patientId === "string") base = base.where("patient_id", "=", query.patientId);
    if (typeof query.fromFacilityId === "string")
      base = base.where("from_facility_id", "=", query.fromFacilityId);
    if (typeof query.toFacilityId === "string")
      base = base.where("to_facility_id", "=", query.toFacilityId);

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

    return { data: data.map(serializeReferral), total: Number(totalRow.count), page, limit };
  });

  app.post("/", { preValidation: validateBody(CreateReferralSchema) }, async (request, reply) => {
    const data = request.body as CreateReferral;
    const user = request.user;

    const row = mapReferralToRow(data, {
      fromFacilityId: user.facilityId,
      referredBy: user.sub,
    });

    const result = await db
      .insertInto("referrals")
      .values(row)
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(serializeReferral(result));
  });

  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as { status?: string };
    const user = request.user;

    const status = oneOf(data.status, REFERRAL_STATUSES);
    if (data.status !== undefined && status === undefined) {
      return reply.code(400).send({
        error: "ValidationError",
        message: "status must be PENDING, ACCEPTED, REJECTED or COMPLETED",
      });
    }

    const result = await db
      .updateTable("referrals")
      .set({
        ...(status !== undefined ? { status } : {}),
        responded_at: status !== undefined && status !== "PENDING" ? new Date() : null,
        responded_by: status !== undefined && status !== "PENDING" ? user.sub : null,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return reply.code(404).send({ message: "Referral not found" });
    return serializeReferral(result);
  });
};
