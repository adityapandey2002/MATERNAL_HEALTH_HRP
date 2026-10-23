import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { assertCan } from "../authz/policy.js";
import {
  assertRequestedScope,
  createDbActorLookup,
  facilityScopePredicate,
} from "../authz/scope.js";
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
    const requestedFacilityId =
      typeof query.facilityId === "string" && query.facilityId.length > 0
        ? query.facilityId
        : undefined;
    const actor = requestedFacilityId
      ? await assertRequestedScope(request.actor, requestedFacilityId, createDbActorLookup(db))
      : request.actor;

    let base = db
      .selectFrom("supervision_alerts")
      .innerJoin("facilities", "facilities.id", "supervision_alerts.facility_id")
      .where(facilityScopePredicate(actor, "facilities.path"));
    const acknowledged = toBool(query.acknowledged);
    const type = oneOf(query.type, ALERT_TYPES);
    const severity = oneOf(query.severity, SEVERITIES);

    if (requestedFacilityId)
      base = base.where("supervision_alerts.facility_id", "=", requestedFacilityId);
    if (type !== undefined) base = base.where("supervision_alerts.type", "=", type);
    if (severity !== undefined) base = base.where("supervision_alerts.severity", "=", severity);
    if (acknowledged !== undefined)
      base = base.where("supervision_alerts.acknowledged", "=", acknowledged);
    if (typeof query.dateFrom === "string")
      base = base.where("supervision_alerts.created_at", ">=", new Date(query.dateFrom));
    if (typeof query.dateTo === "string")
      base = base.where("supervision_alerts.created_at", "<=", new Date(query.dateTo));

    const totalRow = await base
      .clearSelect()
      .select((eb) => eb.fn.count("supervision_alerts.id").as("count"))
      .executeTakeFirstOrThrow();

    const data = await base
      .selectAll("supervision_alerts")
      .orderBy(
        sql`${sql.ref("supervision_alerts")}.${sql.ref(sort.column)} ${sql.raw(sort.order === "asc" ? "asc" : "desc")}`
      )
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

    const alert = await db
      .selectFrom("supervision_alerts")
      .innerJoin("facilities", "facilities.id", "supervision_alerts.facility_id")
      .selectAll("supervision_alerts")
      .select("facilities.path as facility_path")
      .where("supervision_alerts.id", "=", id)
      .executeTakeFirst();
    if (!alert) return reply.code(404).send({ message: "Alert not found" });

    assertCan(request.actor, "alert:acknowledge", {
      type: "facility",
      facilityPath: alert.facility_path,
    });

    const result = await db
      .updateTable("supervision_alerts")
      .set({
        acknowledged: true,
        acknowledged_by: request.actor.userId,
        acknowledged_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return serializeSupervisionAlert(result);
  });
};
