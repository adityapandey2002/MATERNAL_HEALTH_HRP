import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { oneOf, parsePagination, toBool } from "../lib/pagination.js";
import { serializeSupervisionAlert } from "../lib/serializers.js";

const SORTABLE_COLUMNS = ["created_at", "severity", "type"] as const;
const ALERT_TYPES = [
  "ANM_OFFLINE",
  "VISIT_OVERDUE",
  "SYNC_FAILED",
  "HIGH_RISK_UNATTENDED",
] as const;
const SEVERITIES = ["GREEN", "AMBER", "RED"] as const;

export const supervisionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/alerts", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, limit, offset, sort } = parsePagination(query, SORTABLE_COLUMNS, "created_at");

    let base = db.selectFrom("supervision_alerts");
    const acknowledged = toBool(query.acknowledged);
    const type = oneOf(query.type, ALERT_TYPES);
    const severity = oneOf(query.severity, SEVERITIES);

    if (typeof query.facilityId === "string")
      base = base.where("facility_id", "=", query.facilityId);
    if (type !== undefined) base = base.where("type", "=", type);
    if (severity !== undefined) base = base.where("severity", "=", severity);
    if (acknowledged !== undefined) base = base.where("acknowledged", "=", acknowledged);
    if (typeof query.dateFrom === "string")
      base = base.where("created_at", ">=", new Date(query.dateFrom));
    if (typeof query.dateTo === "string")
      base = base.where("created_at", "<=", new Date(query.dateTo));

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

    return {
      data: data.map(serializeSupervisionAlert),
      total: Number(totalRow.count),
      page,
      limit,
    };
  });

  app.post("/alerts/:id/acknowledge", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user;

    const result = await db
      .updateTable("supervision_alerts")
      .set({
        acknowledged: true,
        acknowledged_by: user.sub,
        acknowledged_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return reply.code(404).send({ message: "Alert not found" });
    return serializeSupervisionAlert(result);
  });
};
