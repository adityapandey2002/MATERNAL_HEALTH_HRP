import {
  CreateFollowUpSchema,
  FollowUpFilterSchema,
  UpdateFollowUpSchema,
} from "@hrp/shared/schemas";
import type { CreateFollowUp, FollowUpFilter, UpdateFollowUp } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { type Updateable, sql } from "kysely";
import { z } from "zod";
import { assertCan } from "../authz/policy.js";
import {
  assertRequestedScope,
  createDbActorLookup,
  facilityScopePredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import { parsePagination } from "../lib/pagination.js";
import { serializeFollowUp } from "../lib/serializers.js";
import { validateBody, validateQuery } from "../lib/validate.js";

const SORTABLE_COLUMNS = ["scheduled_date", "created_at", "status"] as const;
const _UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FollowUpListSchema = FollowUpFilterSchema.extend({
  search: z.string().optional(),
});

export const followUpRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/follow-ups — list follow-ups with filters            *
   * ------------------------------------------------------------------ */
  app.get("/", { preValidation: validateQuery(FollowUpListSchema) }, async (request) => {
    const query = request.query as FollowUpFilter & { search?: string };
    const { page, limit, offset, sort } = parsePagination(
      query as Record<string, unknown>,
      SORTABLE_COLUMNS,
      "scheduled_date"
    );

    const requestedFacilityId = query.facilityId;
    const actor = requestedFacilityId
      ? await assertRequestedScope(request.actor, requestedFacilityId, createDbActorLookup(db))
      : request.actor;

    let base = db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .leftJoin("users as assigned_user", "assigned_user.id", "follow_ups.assigned_to_user_id")
      .where(facilityScopePredicate(actor, "facilities.path"));

    if (requestedFacilityId) base = base.where("patients.facility_id", "=", requestedFacilityId);

    if (query.status !== undefined) base = base.where("follow_ups.status", "=", query.status);
    if (query.track !== undefined) base = base.where("follow_ups.track", "=", query.track);
    if (query.assignedToUserId !== undefined)
      base = base.where("follow_ups.assigned_to_user_id", "=", query.assignedToUserId);
    if (query.patientId !== undefined)
      base = base.where("follow_ups.patient_id", "=", query.patientId);
    if (query.dueBefore !== undefined)
      base = base.where("follow_ups.scheduled_date", "<", new Date(query.dueBefore));
    if (query.dueAfter !== undefined)
      base = base.where("follow_ups.scheduled_date", ">", new Date(query.dueAfter));

    if (typeof query.search === "string" && query.search.length > 0) {
      const term = `%${query.search}%`;
      base = base.where((eb) =>
        eb.or([eb("patients.name", "ilike", term), eb("patients.phone", "ilike", term)])
      );
    }

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("follow_ups.id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll("follow_ups")
      .select([
        "patients.name as patient_name",
        "patients.phone as patient_phone",
        "patients.age as patient_age",
        "assigned_user.name as assigned_to_name",
        "facilities.path as facility_path",
      ])
      .orderBy(
        sql`follow_ups.${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      data: data.map((row) =>
        serializeFollowUp(row as unknown as import("../db/types.js").FollowUpRow)
      ),
      total: Number(totalRow.count),
      page,
      limit,
    };
  });

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/follow-ups/panel — panel view: HRP-referred patients *
   * ------------------------------------------------------------------ */
  app.get("/panel", async (request, _reply) => {
    const actor = request.actor;

    const data = await db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .leftJoin("users as registered_anm", "registered_anm.id", "patients.registered_by")
      .leftJoin("users as assigned_user", "assigned_user.id", "follow_ups.assigned_to_user_id")
      .where("patients.is_hrp", "=", true)
      .where("patients.referred", "=", true)
      .where(facilityScopePredicate(actor, "facilities.path"))
      .selectAll("follow_ups")
      .select("patients.name as patient_name")
      .select("patients.age as patient_age")
      .select("patients.phone as patient_phone")
      .select("patients.hrp_complication as patient_hrp_complication")
      .select("registered_anm.name as referred_by_anm_name")
      .select("facilities.path as facility_path")
      .orderBy("follow_ups.scheduled_date asc")
      .execute();

    return {
      data: data.map((row) => ({
        ...serializeFollowUp(row as unknown as import("../db/types.js").FollowUpRow),
        patient: {
          name: row.patient_name,
          age: row.patient_age,
          phone: row.patient_phone,
          hrpComplication: row.patient_hrp_complication,
          isReferred: true,
        },
        referredByAnmName: row.referred_by_anm_name,
      })),
    };
  });

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/follow-ups/field — field-level follow-ups            *
   *  Only visible when district-level field-level list is active       *
   * ------------------------------------------------------------------ */
  app.get("/field", async (request, _reply) => {
    const actor = request.actor;

    const fieldLevelActive = await db
      .selectFrom("field_level_lists")
      .where("facility_id", "=", actor.facilityId)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!fieldLevelActive) {
      return { data: [], total: 0, page: 1, limit: 20, active: false };
    }

    const data = await db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .where("follow_ups.assigned_to_user_id", "=", actor.userId)
      .where(facilityScopePredicate(actor, "facilities.path"))
      .selectAll("follow_ups")
      .select("patients.name as patient_name")
      .select("patients.age as patient_age")
      .select("facilities.path as facility_path")
      .orderBy("follow_ups.scheduled_date asc")
      .execute();

    return {
      data: data.map((row) =>
        serializeFollowUp(row as unknown as import("../db/types.js").FollowUpRow)
      ),
      total: data.length,
      page: 1,
      limit: 20,
      active: true,
    };
  });

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/follow-ups/:id                                       *
   * ------------------------------------------------------------------ */
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const followUp = await db
      .selectFrom("follow_ups")
      .innerJoin("patients", "patients.id", "follow_ups.patient_id")
      .innerJoin("facilities", "facilities.id", "patients.facility_id")
      .selectAll("follow_ups")
      .select("facilities.path as facility_path")
      .where("follow_ups.id", "=", id)
      .executeTakeFirst();
    if (!followUp) return reply.code(404).send({ message: "Follow-up not found" });

    assertCan(request.actor, "patient:read", {
      type: "facility",
      facilityPath: followUp.facility_path,
    });

    return serializeFollowUp(followUp);
  });

  /* ------------------------------------------------------------------ *
   *  PATCH /api/hrp/follow-ups/:id — update follow-up status           *
   * ------------------------------------------------------------------ */
  app.patch(
    "/:id",
    { preValidation: validateBody(UpdateFollowUpSchema) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateFollowUp;

      const existing = await db
        .selectFrom("follow_ups")
        .innerJoin("patients", "patients.id", "follow_ups.patient_id")
        .innerJoin("facilities", "facilities.id", "patients.facility_id")
        .selectAll("follow_ups")
        .select("facilities.path as facility_path")
        .where("follow_ups.id", "=", id)
        .executeTakeFirst();
      if (!existing) return reply.code(404).send({ message: "Follow-up not found" });

      assertCan(request.actor, "patient:write", {
        type: "facility",
        facilityPath: existing.facility_path,
      });

      const setClause: Record<string, unknown> = {
        status: data.status,
        updated_at: new Date(),
      };

      if (data.status === "COMPLETE") {
        setClause.completed_at = new Date();
        setClause.completed_by_user_id = request.actor.userId;
      }

      const result = await db
        .updateTable("follow_ups")
        .set(setClause as Updateable<import("../db/types.js").DB["follow_ups"]>)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return serializeFollowUp(result);
    }
  );
};
