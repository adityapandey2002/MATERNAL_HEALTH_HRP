import type { FastifyPluginAsync } from "fastify";
import { assertCan } from "../authz/policy.js";
import { facilityScopePredicate } from "../authz/scope.js";
import { db } from "../db/client.js";
import { serializeDevice } from "../lib/serializers.js";
import { UUID_PATTERN, parseDeviceId, revokeDevice } from "../services/devices.js";

/**
 * Device supervision.
 *
 * A district officer or block health manager has to be able to end a phone's
 * access the moment it is reported lost. These routes list the installs that
 * hold field data and mark one revoked; the auth hook (see `app.ts`) does the
 * enforcing, so every route that carries the device header stops working
 * immediately, offline cache included.
 */

const ADMIN_ROLES: readonly string[] = ["BHM", "DHS"];

function deviceRowQuery() {
  return db
    .selectFrom("devices")
    .innerJoin("users", "users.id", "devices.user_id")
    .innerJoin("facilities", "facilities.id", "users.facility_id")
    .selectAll("devices")
    .select([
      "users.name as user_name",
      "users.employee_id as user_employee_id",
      "users.role as user_role",
      "facilities.path as facility_path",
    ]);
}

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /**
   * Field staff see their own installs; a supervisor sees every device in its
   * subtree. Filtering by `userId` is allowed because the query is already
   * narrowed by scope.
   */
  app.get("/", async (request) => {
    const actor = request.actor;
    const { userId } = request.query as { userId?: string };

    let query = deviceRowQuery();
    if (ADMIN_ROLES.includes(actor.role)) {
      query = query.where(facilityScopePredicate(actor, "facilities.path"));
    } else {
      query = query.where("devices.user_id", "=", actor.userId);
    }

    const scopedUserId = typeof userId === "string" && UUID_PATTERN.test(userId) ? userId : null;
    if (scopedUserId) {
      query = query.where("devices.user_id", "=", scopedUserId);
    }

    const rows = await query.orderBy("devices.last_seen_at", "desc").execute();
    return { data: rows.map(serializeDevice), total: rows.length };
  });

  /**
   * Revoke one install. The row is kept (not deleted) so the history of which
   * device held data, and when it was cut off, survives.
   */
  app.post("/:id/revoke", async (request, reply) => {
    const actor = request.actor;
    const { id } = request.params as { id: string };
    const deviceId = parseDeviceId(id);

    if (!deviceId) {
      return reply.code(404).send({ message: "Not found" });
    }

    const row = await deviceRowQuery().where("devices.id", "=", deviceId).executeTakeFirst();

    if (!row) {
      return reply.code(404).send({ message: "Not found" });
    }

    assertCan(actor, "device:revoke", {
      type: "facility",
      facilityPath: row.facility_path,
    });

    await revokeDevice(db, deviceId);

    const fresh = await deviceRowQuery()
      .where("devices.id", "=", deviceId)
      .executeTakeFirstOrThrow();

    return serializeDevice(fresh);
  });
};
