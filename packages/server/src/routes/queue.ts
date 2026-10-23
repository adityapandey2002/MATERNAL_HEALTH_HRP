import type { FastifyPluginAsync } from "fastify";
import { assertCan } from "../authz/policy.js";
import {
  assertRequestedScope,
  createDbActorLookup,
  facilityScopePredicate,
} from "../authz/scope.js";
import { db } from "../db/client.js";
import { serializeSyncQueue } from "../lib/serializers.js";

export const queueRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const query = request.query as Record<string, unknown>;
    const requestedFacilityId =
      typeof query.facilityId === "string" && query.facilityId.length > 0
        ? query.facilityId
        : undefined;
    const actor = requestedFacilityId
      ? await assertRequestedScope(request.actor, requestedFacilityId, createDbActorLookup(db))
      : request.actor;

    let base = db
      .selectFrom("sync_queue")
      .innerJoin("facilities", "facilities.id", "sync_queue.facility_id")
      .where(facilityScopePredicate(actor, "facilities.path"))
      .where("sync_queue.status", "in", ["PENDING", "FAILED", "CONFLICT"]);

    if (requestedFacilityId) base = base.where("sync_queue.facility_id", "=", requestedFacilityId);

    const items = await base
      .selectAll("sync_queue")
      .orderBy("sync_queue.created_at", "asc")
      .execute();
    return items.map(serializeSyncQueue);
  });

  app.post("/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await db
      .selectFrom("sync_queue")
      .innerJoin("facilities", "facilities.id", "sync_queue.facility_id")
      .selectAll("sync_queue")
      .select("facilities.path as facility_path")
      .where("sync_queue.id", "=", id)
      .executeTakeFirst();
    if (!item) return reply.code(404).send({ message: "Queue item not found" });

    assertCan(request.actor, "queue:retry", {
      type: "facility",
      facilityPath: item.facility_path,
    });

    const result = await db
      .updateTable("sync_queue")
      .set({
        status: "PENDING",
        retry_count: item.retry_count + 1,
        last_error: null,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return serializeSyncQueue(result);
  });
};
