import { NodalDashboardSchema } from "@hrp/shared/schemas";
import type { NodalDashboardParams } from "@hrp/shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertCan } from "../authz/policy.js";
import { createDbActorLookup, facilityScopePredicate } from "../authz/scope.js";
import { db } from "../db/client.js";
import { validateBody, validateQuery } from "../lib/validate.js";

const zNodalDashboardQuery = z.object({
  facilityId: z.string().uuid(),
  nodalLevel: z.enum(["BLOCK", "DISTRICT"]),
});

export const nodalRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/nodal/dashboard — Block/District nodal dashboard     *
   * ------------------------------------------------------------------ */
  app.get(
    "/dashboard",
    { preValidation: validateQuery(zNodalDashboardQuery) },
    async (request, reply) => {
      const { facilityId, nodalLevel } = request.query as NodalDashboardParams;
      const actor = request.actor;

      // Authorization: only Block Nodal / District Nodal designations
      const designation = await db
        .selectFrom("user_nodal_designations")
        .where("user_id", "=", actor.userId)
        .where("nodal_level", "=", nodalLevel)
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (!designation) {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Not designated as nodal authority for this facility",
          },
        });
      }

      // Total HRP patients in scope
      const totalHrpPatients = await db
        .selectFrom("patients")
        .where("is_hrp", "=", true)
        .where("facility_id", "=", facilityId)
        .select((eb) => eb.fn.count("id").as("count"))
        .executeTakeFirstOrThrow();

      // Referred patients
      const referredPatients = await db
        .selectFrom("patients")
        .where("is_hrp", "=", true)
        .where("referred", "=", true)
        .where("facility_id", "=", facilityId)
        .select((eb) => eb.fn.count("id").as("count"))
        .executeTakeFirstOrThrow();

      // Follow-up stats
      const pendingFollowUps = await db
        .selectFrom("follow_ups")
        .innerJoin("patients", "patients.id", "follow_ups.patient_id")
        .where("patients.facility_id", "=", facilityId)
        .where("follow_ups.status", "=", "PENDING")
        .select((eb) => eb.fn.count("follow_ups.id").as("count"))
        .executeTakeFirstOrThrow();

      const completedFollowUps = await db
        .selectFrom("follow_ups")
        .innerJoin("patients", "patients.id", "follow_ups.patient_id")
        .where("patients.facility_id", "=", facilityId)
        .where("follow_ups.status", "=", "COMPLETE")
        .select((eb) => eb.fn.count("follow_ups.id").as("count"))
        .executeTakeFirstOrThrow();

      const notReachableFollowUps = await db
        .selectFrom("follow_ups")
        .innerJoin("patients", "patients.id", "follow_ups.patient_id")
        .where("patients.facility_id", "=", facilityId)
        .where("follow_ups.status", "=", "NOT_REACHABLE")
        .select((eb) => eb.fn.count("follow_ups.id").as("count"))
        .executeTakeFirstOrThrow();

      // ANMs offline > 48h (simplified: no sync activity in last 48h)
      const anmsOffline = await db
        .selectFrom("users")
        .where("role", "=", "ANM")
        .where("facility_id", "=", facilityId)
        .where("is_active", "=", true)
        .select((eb) => eb.fn.count("id").as("count"))
        .executeTakeFirstOrThrow();

      const totalCount = Number(totalHrpPatients.count);
      const adherenceRate =
        totalCount > 0 ? Math.round((Number(completedFollowUps.count) / totalCount) * 100) : 0;

      return {
        totalHrpPatients: Number(totalHrpPatients.count),
        referredPatients: Number(referredPatients.count),
        pendingFollowUps: Number(pendingFollowUps.count),
        completedFollowUps: Number(completedFollowUps.count),
        notReachableFollowUps: Number(notReachableFollowUps.count),
        anmsOffline: Number(anmsOffline.count),
        blockAdherenceRate: adherenceRate,
        districtAdherenceRate: nodalLevel === "DISTRICT" ? adherenceRate : undefined,
      };
    }
  );

  /* ------------------------------------------------------------------ *
   *  GET /api/hrp/nodal/anms-offline — ANMs offline > 48h              *
   * ------------------------------------------------------------------ */
  app.get("/anms-offline", async (request, reply) => {
    const actor = request.actor;

    const designation = await db
      .selectFrom("user_nodal_designations")
      .where("user_id", "=", actor.userId)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!designation) {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Not designated as nodal authority" },
      });
    }

    const _cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const anms = await db
      .selectFrom("users")
      .innerJoin("facilities", "facilities.id", "users.facility_id")
      .where("users.role", "=", "ANM")
      .where("users.is_active", "=", true)
      .where(facilityScopePredicate(actor, "facilities.path"))
      .select(["users.id", "users.name", "users.employee_id", "facilities.name as facility_name"])
      .execute();

    return { data: anms, count: anms.length };
  });
};
