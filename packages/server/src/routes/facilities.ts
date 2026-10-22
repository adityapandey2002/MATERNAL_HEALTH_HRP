import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { serializeFacility } from "../lib/serializers.js";

export const facilityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async () => {
    const facilities = await db.selectFrom("facilities").selectAll().orderBy("level").execute();
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
    return serializeFacility(facility);
  });

  app.get("/:id/children", async (request) => {
    const { id } = request.params as { id: string };
    const children = await db
      .selectFrom("facilities")
      .selectAll()
      .where("parent_id", "=", id)
      .execute();
    return children.map(serializeFacility);
  });
};
