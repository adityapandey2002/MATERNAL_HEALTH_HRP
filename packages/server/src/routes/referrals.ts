import { CreateReferralSchema } from "@hrp/shared/schemas";
import type { CreateReferral } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { assertCan } from "../authz/policy.js";
import { referralVisibilityPredicate } from "../authz/scope.js";
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

    let base = db
      .selectFrom("referrals")
      .innerJoin("facilities as from_facility", "from_facility.id", "referrals.from_facility_id")
      .innerJoin("facilities as to_facility", "to_facility.id", "referrals.to_facility_id")
      .where(referralVisibilityPredicate(request.actor, "from_facility.path", "to_facility.path"));
    const status = oneOf(query.status, REFERRAL_STATUSES);

    if (status !== undefined) base = base.where("referrals.status", "=", status);
    if (typeof query.patientId === "string")
      base = base.where("referrals.patient_id", "=", query.patientId);
    if (typeof query.fromFacilityId === "string")
      base = base.where("referrals.from_facility_id", "=", query.fromFacilityId);
    if (typeof query.toFacilityId === "string")
      base = base.where("referrals.to_facility_id", "=", query.toFacilityId);

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("referrals.id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll("referrals")
      .orderBy(
        sql`${sql.ref("referrals")}.${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return { data: data.map(serializeReferral), total: Number(totalRow.count), page, limit };
  });

  app.post("/", { preValidation: validateBody(CreateReferralSchema) }, async (request, reply) => {
    const data = request.body as CreateReferral;
    const actor = request.actor;

    const patient = await db
      .selectFrom("patients")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .select(["patients.id", "facilities.path as facility_path"])
      .where("patients.id", "=", data.patientId)
      .executeTakeFirst();
    if (!patient) return reply.code(404).send({ message: "Patient not found" });

    assertCan(actor, "referral:create", {
      type: "facility",
      facilityPath: patient.facility_path,
    });

    const destination = await db
      .selectFrom("facilities")
      .select(["id"])
      .where("id", "=", data.toFacilityId)
      .executeTakeFirst();
    if (!destination) {
      return reply.code(404).send({ message: "Destination facility not found" });
    }

    const row = mapReferralToRow(data, {
      fromFacilityId: actor.homeFacilityId,
      referredBy: actor.userId,
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

    const referral = await db
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
    if (!referral) return reply.code(404).send({ message: "Referral not found" });

    assertCan(request.actor, "referral:respond", {
      type: "referral",
      fromFacilityPath: referral.from_facility_path,
      toFacilityPath: referral.to_facility_path,
      toFacilityLevel: referral.to_facility_level,
    });

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
        responded_by: status !== undefined && status !== "PENDING" ? request.actor.userId : null,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return serializeReferral(result);
  });
};
