import { FieldLevelActivateSchema, FieldLevelDeactivateSchema } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertCan } from "../authz/policy.js";
import { db } from "../db/client.js";
import { validateBody } from "../lib/validate.js";

export const fieldLevelRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/field-level/active — check if field-level is active  *
   * ------------------------------------------------------------------ */
  app.get("/active", async (request, _reply) => {
    const actor = request.actor;

    const active = (await db
      .selectFrom("field_level_lists")
      .where("facility_id", "=", actor.facilityId)
      .where("is_active", "=", true)
      .select(["district_list_id", "activated_at"])
      .executeTakeFirst()) as { district_list_id: string; activated_at: Date } | undefined;

    return {
      isActive: !!active,
      districtListId: active?.district_list_id ?? null,
      activatedAt: active?.activated_at ?? null,
    };
  });

  /* ------------------------------------------------------------------ *
   *  POST /api/hrp/field-level/activate — activate (District Nodal)    *
   * ------------------------------------------------------------------ */
  app.post(
    "/activate",
    { preValidation: validateBody(FieldLevelActivateSchema) },
    async (request, reply) => {
      const { facilityId, districtListId } = request.body as {
        facilityId: string;
        districtListId: string;
      };
      const actor = request.actor;

      // Only District Nodal can activate
      const designation = await db
        .selectFrom("user_nodal_designations")
        .where("user_id", "=", actor.userId)
        .where("nodal_level", "=", "DISTRICT")
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!designation) {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Only District Nodal can activate field-level follow-ups",
          },
        });
      }

      // Deactivate any existing active list for this facility
      await db
        .updateTable("field_level_lists")
        .set({ is_active: false })
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true);

      const result = (await db
        .insertInto("field_level_lists")
        .values({
          facility_id: facilityId,
          district_list_id: districtListId,
          activated_by: actor.userId,
          is_active: true,
        })
        .returning(["district_list_id", "activated_at"])
        .executeTakeFirstOrThrow()) as { district_list_id: string; activated_at: Date };

      return {
        isActive: true,
        districtListId: result.district_list_id,
        activatedAt: result.activated_at,
      };
    }
  );

  /* ------------------------------------------------------------------ *
   *  POST /api/hrp/field-level/deactivate — deactivate (District Nodal)*
   * ------------------------------------------------------------------ */
  app.post(
    "/deactivate",
    { preValidation: validateBody(FieldLevelDeactivateSchema) },
    async (request, reply) => {
      const { facilityId } = request.body as { facilityId: string };
      const actor = request.actor;

      const designation = await db
        .selectFrom("user_nodal_designations")
        .where("user_id", "=", actor.userId)
        .where("nodal_level", "=", "DISTRICT")
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!designation) {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Only District Nodal can deactivate field-level follow-ups",
          },
        });
      }

      await db
        .updateTable("field_level_lists")
        .set({ is_active: false })
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true);

      return { isActive: false };
    }
  );
};
