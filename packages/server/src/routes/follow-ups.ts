import { nextHrpFollowUpDate } from "@hrp/shared";
import {
  CreateFollowUpSchema,
  DispatchFollowUpSchema,
  FollowUpFilterSchema,
  UpdateFollowUpSchema,
} from "@hrp/shared/schemas";
import type {
  CreateFollowUp,
  DispatchFollowUp,
  FollowUpFilter,
  FollowUpListItem,
  UpdateFollowUp,
} from "@hrp/shared/schemas";
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
import type { DB, FollowUpRow } from "../db/types.js";
import { parsePagination } from "../lib/pagination.js";
import { serializeFollowUp } from "../lib/serializers.js";
import { validateBody, validateQuery } from "../lib/validate.js";
import { followUpLevelForRole, nextFieldFollowUpValues } from "../services/hrp-follow-up.js";

const SORTABLE_COLUMNS = ["scheduled_date", "created_at", "status"] as const;
const _UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FollowUpListSchema = FollowUpFilterSchema.extend({
  search: z.string().optional(),
});

type FollowUpJoinedRow = FollowUpRow & {
  patient_name: string;
  patient_phone: string | null;
  patient_age: number;
  patient_risk_level: "GREEN" | "AMBER" | "RED";
  hrp_complication: string | null;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
  completed_by_name: string | null;
  completed_by_role: string | null;
  village: string | null;
  block_name: string | null;
};

/**
 * Follow-up rows carry the patient and the acting tier so the shared block
 * line list can show "Done by ANM (Radha Sharma)" without extra requests.
 */
function toFollowUpListItem(row: FollowUpJoinedRow): FollowUpListItem {
  return {
    ...serializeFollowUp(row),
    patientName: row.patient_name,
    patientAge: row.patient_age,
    patientPhone: row.patient_phone,
    patientRiskLevel: row.patient_risk_level,
    hrpComplication: (row.hrp_complication ?? null) as FollowUpListItem["hrpComplication"],
    village: row.village,
    blockName: row.block_name,
    assignedToName: row.assigned_to_name,
    assignedToRole: row.assigned_to_role,
    completedByName: row.completed_by_name,
    completedByRole: row.completed_by_role,
  };
}

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
      .leftJoin("users as completed_user", "completed_user.id", "follow_ups.completed_by_user_id")
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
        "patients.risk_level as patient_risk_level",
        "patients.hrp_complication as hrp_complication",
        "assigned_user.name as assigned_to_name",
        "assigned_user.role as assigned_to_role",
        "completed_user.name as completed_by_name",
        "completed_user.role as completed_by_role",
        "facilities.name as village",
        "facilities.block as block_name",
        "facilities.path as facility_path",
      ])
      .orderBy(
        sql`follow_ups.${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      data: data.map((row) => toFollowUpListItem(row)),
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
        ...serializeFollowUp(row),
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
      data: data.map((row) => serializeFollowUp(row)),
      total: data.length,
      page: 1,
      limit: 20,
      active: true,
    };
  });

  /* ------------------------------------------------------------------ *
   *  POST /api/hrp/follow-ups/dispatch — push a list to an ANM/CHO      *
   *  Block dispatch box: assigns the selected women to a field worker   *
   *  and starts (or moves) their next 15-day field cycle.               *
   * ------------------------------------------------------------------ */
  app.post(
    "/dispatch",
    { preValidation: validateBody(DispatchFollowUpSchema) },
    async (request, reply) => {
      const actor = request.actor;
      const data = request.body as DispatchFollowUp;

      assertCan(actor, "followup:manage", {
        type: "facility",
        facilityPath: actor.homeFacilityPath,
      });

      const assignee = await db
        .selectFrom("users")
        .innerJoin("facilities", "facilities.id", "users.facility_id")
        .select([
          "users.id as id",
          "users.role as role",
          "users.is_active as is_active",
          "facilities.path as facility_path",
        ])
        .where("users.id", "=", data.assignedToUserId)
        .executeTakeFirst();

      if (!assignee || !assignee.is_active) {
        return reply.code(404).send({ message: "Assigned field worker not found" });
      }

      assertCan(actor, "followup:manage", {
        type: "facility",
        facilityPath: assignee.facility_path,
      });

      const dispatchRole = assignee.role;
      if (
        dispatchRole !== "ANM" &&
        dispatchRole !== "CHO" &&
        dispatchRole !== "HRP_HELPDESK_BLOCK"
      ) {
        return reply
          .code(400)
          .send({ message: "Follow-ups can only be dispatched to field workers" });
      }

      const patients = await db
        .selectFrom("patients")
        .innerJoin("facilities", "facilities.id", "patients.facility_id")
        .select("patients.id as id")
        .where("patients.id", "in", data.patientIds)
        .where(facilityScopePredicate(actor, "facilities.path"))
        .execute();

      if (patients.length !== new Set(data.patientIds).size) {
        return reply.code(404).send({ message: "One or more patients are out of scope" });
      }

      const now = new Date();
      const scheduledDate = data.scheduledDate
        ? new Date(data.scheduledDate)
        : nextHrpFollowUpDate(now);
      const level = followUpLevelForRole(dispatchRole);

      const rows = await db.transaction().execute(async (trx) => {
        const pending = await trx
          .selectFrom("follow_ups")
          .select(["id", "patient_id"])
          .where(
            "patient_id",
            "in",
            patients.map((patient) => patient.id)
          )
          .where("status", "=", "PENDING")
          .orderBy("scheduled_date", "asc")
          .execute();

        const pendingByPatient = new Map<string, string>();
        for (const row of pending) {
          if (!pendingByPatient.has(row.patient_id)) {
            pendingByPatient.set(row.patient_id, row.id);
          }
        }

        const result: FollowUpRow[] = [];

        for (const patient of patients) {
          const pendingId = pendingByPatient.get(patient.id);

          if (pendingId) {
            result.push(
              await trx
                .updateTable("follow_ups")
                .set({
                  assigned_to_user_id: data.assignedToUserId,
                  assigned_by_user_id: actor.userId,
                  level,
                  track: "FIELD_15_DAY",
                  scheduled_date: scheduledDate,
                  notes: data.notes ?? null,
                  updated_at: now,
                })
                .where("id", "=", pendingId)
                .returningAll()
                .executeTakeFirstOrThrow()
            );
            continue;
          }

          result.push(
            await trx
              .insertInto("follow_ups")
              .values({
                patient_id: patient.id,
                assigned_to_user_id: data.assignedToUserId,
                assigned_by_user_id: actor.userId,
                level,
                track: "FIELD_15_DAY",
                scheduled_date: scheduledDate,
                notes: data.notes ?? null,
              })
              .returningAll()
              .executeTakeFirstOrThrow()
          );
        }

        return result;
      });

      return reply.code(201).send({
        data: rows.map((row) => serializeFollowUp(row)),
        count: rows.length,
      });
    }
  );

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
   *  Completing a cycle starts the next 15-day field cycle for an HRP. *
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
        .select([
          "patients.is_hrp as patient_is_hrp",
          "patients.registered_by as patient_registered_by",
          "facilities.path as facility_path",
        ])
        .where("follow_ups.id", "=", id)
        .executeTakeFirst();
      if (!existing) return reply.code(404).send({ message: "Follow-up not found" });

      assertCan(request.actor, "followup:manage", {
        type: "facility",
        facilityPath: existing.facility_path,
      });

      const now = new Date();

      const result = await db.transaction().execute(async (trx) => {
        const setClause: Updateable<DB["follow_ups"]> = {
          status: data.status,
          updated_at: now,
        };

        if (data.notes !== undefined) setClause.notes = data.notes;
        if (data.status === "COMPLETE") {
          setClause.completed_at = now;
          setClause.completed_by_user_id = request.actor.userId;
        }

        const updated = await trx
          .updateTable("follow_ups")
          .set(setClause)
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirstOrThrow();

        if (
          data.status !== "COMPLETE" ||
          existing.status === "COMPLETE" ||
          !existing.patient_is_hrp
        ) {
          return updated;
        }

        // Do not stack a second open cycle on a woman who already has one.
        const otherOpen = await trx
          .selectFrom("follow_ups")
          .select("id")
          .where("patient_id", "=", existing.patient_id)
          .where("status", "!=", "COMPLETE")
          .where("id", "!=", id)
          .executeTakeFirst();

        if (otherOpen) return updated;

        const registrant = await trx
          .selectFrom("users")
          .select(["id", "role"])
          .where("id", "=", existing.patient_registered_by)
          .executeTakeFirst();

        const next = nextFieldFollowUpValues({
          patientId: existing.patient_id,
          registrantUserId: registrant?.id ?? request.actor.userId,
          registrantRole: registrant?.role ?? null,
          assignedByUserId: request.actor.userId,
          completedAt: now,
        });

        await trx.insertInto("follow_ups").values(next).execute();
        await trx
          .updateTable("patients")
          .set({
            follow_up_track: next.track,
            follow_up_scheduled_date: next.scheduled_date,
            updated_at: now,
          })
          .where("id", "=", existing.patient_id)
          .execute();

        return updated;
      });

      return serializeFollowUp(result);
    }
  );
};
