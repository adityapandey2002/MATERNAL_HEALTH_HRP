import type { FastifyPluginAsync } from "fastify";
import { assertCan } from "../authz/policy.js";
import { facilityScopePredicate } from "../authz/scope.js";
import { db } from "../db/client.js";
import { serializeFacility } from "../lib/serializers.js";

export const facilityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const facilities = await db
      .selectFrom("facilities")
      .selectAll()
      .where(facilityScopePredicate(request.actor, "path"))
      .orderBy("level")
      .orderBy("name")
      .execute();
    return facilities.map(serializeFacility);
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const facility = await db
      .selectFrom("facilities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!facility) return reply.code(404).send({ message: "Facility not found" });

    assertCan(request.actor, "facility:read", {
      type: "facility",
      facilityPath: facility.path,
    });

    return serializeFacility(facility);
  });

  app.get("/:id/children", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parent = await db
      .selectFrom("facilities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!parent) return reply.code(404).send({ message: "Facility not found" });

    assertCan(request.actor, "facility:read", {
      type: "facility",
      facilityPath: parent.path,
    });

    const children = await db
      .selectFrom("facilities")
      .selectAll()
      .where("parent_id", "=", id)
      .where(facilityScopePredicate(request.actor, "path"))
      .orderBy("level")
      .orderBy("name")
      .execute();
    return children.map(serializeFacility);
  });
};
