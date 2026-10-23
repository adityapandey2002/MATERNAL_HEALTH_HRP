import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "./db/types.js";
import type {
  SeedFixtures,
  SupervisionAlertFixture,
  SyncQueueItemFixture,
  UserFixture,
} from "./test/factories.js";
import {
  getIntegrationDb,
  resetIntegrationDb,
  startIntegrationDb,
  stopIntegrationDb,
} from "./test/integration-db.js";

let app: FastifyInstance;
let db: Kysely<DB>;
let seed: SeedFixtures;

interface AlertSet {
  villageA: SupervisionAlertFixture;
  villageA2: SupervisionAlertFixture;
  hwcA: SupervisionAlertFixture;
  blockA: SupervisionAlertFixture;
  districtA: SupervisionAlertFixture;
  villageB: SupervisionAlertFixture;
}

interface QueueSet {
  villageA: SyncQueueItemFixture;
  villageA2: SyncQueueItemFixture;
  hwcA: SyncQueueItemFixture;
  blockA: SyncQueueItemFixture;
  districtA: SyncQueueItemFixture;
  villageB: SyncQueueItemFixture;
}

let alerts: AlertSet;
let queue: QueueSet;

interface AlertListBody {
  data: Array<{
    id: string;
    facilityId: string;
    acknowledged: boolean;
    acknowledgedBy: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
}

interface AlertBody {
  id: string;
  facilityId: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

interface QueueItemBody {
  id: string;
  facilityId: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: Record<string, unknown>;
  status: string;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function tokenFor(user: UserFixture): string {
  return app.jwt.sign({ sub: user.id, facilityId: user.facilityId });
}

function inject(user: UserFixture, method: "GET" | "POST", url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: authHeader(tokenFor(user)),
    payload,
  });
}

function ids(rows: Array<{ id: string }>): string[] {
  return rows.map((row) => row.id);
}

beforeAll(async () => {
  const context = await startIntegrationDb();
  db = context.db;

  const { buildApp } = await import("./app.js");
  app = buildApp({ logger: false });
  await app.ready();
});

beforeEach(async () => {
  await resetIntegrationDb();
  const { seedBaseFixtures, seedSupervisionAlert, seedSyncQueueItem } = await import(
    "./test/factories.js"
  );
  seed = await seedBaseFixtures(getIntegrationDb());

  alerts = {
    villageA: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.villageA.id,
      message: "Village A ANM offline",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    }),
    villageA2: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.villageA2.id,
      type: "HIGH_RISK_UNATTENDED",
      severity: "RED",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    }),
    hwcA: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.hwcA.id,
      type: "VISIT_OVERDUE",
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
    }),
    blockA: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.blockA.id,
      severity: "GREEN",
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
    }),
    districtA: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.districtA.id,
      type: "SYNC_FAILED",
      createdAt: new Date("2026-03-05T00:00:00.000Z"),
    }),
    villageB: await seedSupervisionAlert(db, {
      facilityId: seed.facilities.villageB.id,
      message: "Other district alert",
      createdAt: new Date("2026-03-06T00:00:00.000Z"),
    }),
  };

  queue = {
    villageA: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.villageA.id,
      entityId: seed.patients.patientA.id,
      payload: { source: "village-a" },
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    }),
    villageA2: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.villageA2.id,
      entityId: seed.patients.patientA2.id,
      operation: "UPDATE",
      createdAt: new Date("2026-03-02T00:00:00.000Z"),
    }),
    hwcA: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.hwcA.id,
      entityId: seed.patients.visitA.id,
      entityType: "VISIT",
      operation: "UPDATE",
      status: "FAILED",
      retryCount: 2,
      lastError: "network timeout",
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
    }),
    blockA: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.blockA.id,
      entityId: seed.patients.visitA2.id,
      entityType: "VISIT",
      status: "FAILED",
      retryCount: 1,
      lastError: "server error",
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
    }),
    districtA: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.districtA.id,
      entityId: seed.patients.patientA.id,
      operation: "UPDATE",
      status: "CONFLICT",
      createdAt: new Date("2026-03-05T00:00:00.000Z"),
    }),
    villageB: await seedSyncQueueItem(db, {
      facilityId: seed.facilities.villageB.id,
      entityId: seed.patients.patientB.id,
      status: "FAILED",
      createdAt: new Date("2026-03-06T00:00:00.000Z"),
    }),
  };
});

afterAll(async () => {
  await app.close();
  await stopIntegrationDb();
});

describe("facility subtree scope", () => {
  it("scopes facility lists to the actor subtree ordered by level and name", async () => {
    const anmResponse = await inject(seed.users.anmA, "GET", "/api/facilities");
    expect(anmResponse.statusCode).toBe(200);
    expect(ids(anmResponse.json())).toEqual([seed.facilities.villageA.id]);

    const choResponse = await inject(seed.users.choA, "GET", "/api/facilities");
    expect(choResponse.statusCode).toBe(200);
    expect(ids(choResponse.json())).toEqual([
      seed.facilities.hwcA.id,
      seed.facilities.villageA2.id,
      seed.facilities.villageA.id,
    ]);

    const bhmResponse = await inject(seed.users.bhmA, "GET", "/api/facilities");
    expect(bhmResponse.statusCode).toBe(200);
    expect(new Set(ids(bhmResponse.json()))).toEqual(
      new Set([
        seed.facilities.blockA.id,
        seed.facilities.chcA.id,
        seed.facilities.hwcA.id,
        seed.facilities.villageA.id,
        seed.facilities.villageA2.id,
      ])
    );

    const dhsResponse = await inject(seed.users.dhsA, "GET", "/api/facilities");
    expect(dhsResponse.statusCode).toBe(200);
    const dhsIds = ids(dhsResponse.json());
    expect(new Set(dhsIds)).toEqual(
      new Set([
        seed.facilities.districtA.id,
        seed.facilities.blockA.id,
        seed.facilities.chcA.id,
        seed.facilities.hwcA.id,
        seed.facilities.villageA.id,
        seed.facilities.villageA2.id,
      ])
    );
    expect(dhsIds).not.toContain(seed.facilities.districtB.id);
    expect(dhsIds).not.toContain(seed.facilities.villageB.id);
  });

  it("hides out-of-scope facility reads and child listings from an ANM", async () => {
    for (const facility of [seed.facilities.districtA, seed.facilities.hwcA]) {
      const read = await inject(seed.users.anmA, "GET", `/api/facilities/${facility.id}`);
      expect(read.statusCode).toBe(404);

      const children = await inject(
        seed.users.anmA,
        "GET",
        `/api/facilities/${facility.id}/children`
      );
      expect(children.statusCode).toBe(404);
    }

    const own = await inject(
      seed.users.anmA,
      "GET",
      `/api/facilities/${seed.facilities.villageA.id}`
    );
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ id: seed.facilities.villageA.id });

    const ownChildren = await inject(
      seed.users.anmA,
      "GET",
      `/api/facilities/${seed.facilities.villageA.id}/children`
    );
    expect(ownChildren.statusCode).toBe(200);
    expect(ownChildren.json()).toEqual([]);

    const choChildren = await inject(
      seed.users.choA,
      "GET",
      `/api/facilities/${seed.facilities.hwcA.id}/children`
    );
    expect(choChildren.statusCode).toBe(200);
    expect(ids(choChildren.json())).toEqual([
      seed.facilities.villageA2.id,
      seed.facilities.villageA.id,
    ]);
  });

  it("returns 404 for missing facility ids", async () => {
    const missing = randomUUID();

    expect((await inject(seed.users.dhsA, "GET", `/api/facilities/${missing}`)).statusCode).toBe(
      404
    );
    expect(
      (await inject(seed.users.dhsA, "GET", `/api/facilities/${missing}/children`)).statusCode
    ).toBe(404);
  });
});

describe("supervision alert scope", () => {
  it("scopes alert lists and totals to the actor subtree before pagination", async () => {
    const anmResponse = await inject(seed.users.anmA, "GET", "/api/supervision/alerts");
    expect(anmResponse.statusCode).toBe(200);
    const anmBody = anmResponse.json() as AlertListBody;
    expect(anmBody.total).toBe(1);
    expect(ids(anmBody.data)).toEqual([alerts.villageA.id]);

    const choResponse = await inject(seed.users.choA, "GET", "/api/supervision/alerts");
    expect(choResponse.statusCode).toBe(200);
    const choBody = choResponse.json() as AlertListBody;
    expect(choBody.total).toBe(3);
    expect(new Set(ids(choBody.data))).toEqual(
      new Set([alerts.villageA.id, alerts.villageA2.id, alerts.hwcA.id])
    );

    const bhmResponse = await inject(seed.users.bhmA, "GET", "/api/supervision/alerts");
    expect(bhmResponse.statusCode).toBe(200);
    const bhmBody = bhmResponse.json() as AlertListBody;
    expect(bhmBody.total).toBe(4);
    expect(new Set(ids(bhmBody.data))).toEqual(
      new Set([alerts.villageA.id, alerts.villageA2.id, alerts.hwcA.id, alerts.blockA.id])
    );

    const dhsResponse = await inject(seed.users.dhsA, "GET", "/api/supervision/alerts");
    expect(dhsResponse.statusCode).toBe(200);
    const dhsBody = dhsResponse.json() as AlertListBody;
    expect(dhsBody.total).toBe(5);
    expect(ids(dhsBody.data)).not.toContain(alerts.villageB.id);
    expect(dhsBody.data).toHaveLength(5);

    const paged = await inject(seed.users.choA, "GET", "/api/supervision/alerts?limit=2");
    expect(paged.statusCode).toBe(200);
    const pagedBody = paged.json() as AlertListBody;
    expect(pagedBody.data).toHaveLength(2);
    expect(pagedBody.total).toBe(3);
    expect(pagedBody.limit).toBe(2);
  });

  it("narrows alerts by facilityId and rejects widening", async () => {
    const choNarrow = await inject(
      seed.users.choA,
      "GET",
      `/api/supervision/alerts?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(choNarrow.statusCode).toBe(200);
    const choBody = choNarrow.json() as AlertListBody;
    expect(choBody.total).toBe(1);
    expect(ids(choBody.data)).toEqual([alerts.villageA2.id]);

    const anmWiden = await inject(
      seed.users.anmA,
      "GET",
      `/api/supervision/alerts?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(anmWiden.statusCode).toBe(403);

    const choCrossDistrict = await inject(
      seed.users.choA,
      "GET",
      `/api/supervision/alerts?facilityId=${seed.facilities.villageB.id}`
    );
    expect(choCrossDistrict.statusCode).toBe(403);
  });

  it("denies acknowledgement to an ANM and leaves the alert unchanged", async () => {
    const response = await inject(
      seed.users.anmA,
      "POST",
      `/api/supervision/alerts/${alerts.villageA.id}/acknowledge`
    );
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("supervision_alerts")
      .select(["acknowledged", "acknowledged_by", "acknowledged_at"])
      .where("id", "=", alerts.villageA.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  });

  it("allows in-scope supervisors to acknowledge alerts", async () => {
    const cases = [
      { user: seed.users.choA, alert: alerts.villageA2 },
      { user: seed.users.bhmA, alert: alerts.blockA },
      { user: seed.users.dhsA, alert: alerts.districtA },
    ];

    for (const { user, alert } of cases) {
      const response = await inject(
        user,
        "POST",
        `/api/supervision/alerts/${alert.id}/acknowledge`
      );
      expect(response.statusCode).toBe(200);
      const body = response.json() as AlertBody;
      expect(body).toMatchObject({
        id: alert.id,
        facilityId: alert.facilityId,
        acknowledged: true,
        acknowledgedBy: user.id,
      });
      expect(body.acknowledgedAt).not.toBeNull();

      const row = await db
        .selectFrom("supervision_alerts")
        .select(["acknowledged", "acknowledged_by"])
        .where("id", "=", alert.id)
        .executeTakeFirstOrThrow();
      expect(row).toEqual({ acknowledged: true, acknowledged_by: user.id });
    }
  });

  it("denies cross-district acknowledgement and keeps the alert unchanged", async () => {
    for (const user of [seed.users.choA, seed.users.bhmA, seed.users.dhsA]) {
      const response = await inject(
        user,
        "POST",
        `/api/supervision/alerts/${alerts.villageB.id}/acknowledge`
      );
      expect(response.statusCode).toBe(403);
    }

    const row = await db
      .selectFrom("supervision_alerts")
      .select(["acknowledged", "acknowledged_by"])
      .where("id", "=", alerts.villageB.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ acknowledged: false, acknowledged_by: null });
  });

  it("returns 404 for missing alert ids", async () => {
    const response = await inject(
      seed.users.choA,
      "POST",
      `/api/supervision/alerts/${randomUUID()}/acknowledge`
    );
    expect(response.statusCode).toBe(404);
  });
});

describe("sync queue scope", () => {
  it("scopes the queue to the actor subtree with no global results", async () => {
    const anmResponse = await inject(seed.users.anmA, "GET", "/api/queue");
    expect(anmResponse.statusCode).toBe(200);
    const anmItems = anmResponse.json() as QueueItemBody[];
    expect(ids(anmItems)).toEqual([queue.villageA.id]);

    const choResponse = await inject(seed.users.choA, "GET", "/api/queue");
    expect(choResponse.statusCode).toBe(200);
    const choItems = choResponse.json() as QueueItemBody[];
    expect(new Set(ids(choItems))).toEqual(
      new Set([queue.villageA.id, queue.villageA2.id, queue.hwcA.id])
    );

    const bhmResponse = await inject(seed.users.bhmA, "GET", "/api/queue");
    expect(bhmResponse.statusCode).toBe(200);
    const bhmItems = bhmResponse.json() as QueueItemBody[];
    expect(new Set(ids(bhmItems))).toEqual(
      new Set([queue.villageA.id, queue.villageA2.id, queue.hwcA.id, queue.blockA.id])
    );

    const dhsResponse = await inject(seed.users.dhsA, "GET", "/api/queue");
    expect(dhsResponse.statusCode).toBe(200);
    const dhsItems = dhsResponse.json() as QueueItemBody[];
    expect(ids(dhsItems)).toHaveLength(5);
    expect(ids(dhsItems)).not.toContain(queue.villageB.id);
  });

  it("narrows the queue by facilityId and rejects widening", async () => {
    const choNarrow = await inject(
      seed.users.choA,
      "GET",
      `/api/queue?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(choNarrow.statusCode).toBe(200);
    expect(ids(choNarrow.json() as QueueItemBody[])).toEqual([queue.villageA2.id]);

    const anmWiden = await inject(
      seed.users.anmA,
      "GET",
      `/api/queue?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(anmWiden.statusCode).toBe(403);

    const choCrossDistrict = await inject(
      seed.users.choA,
      "GET",
      `/api/queue?facilityId=${seed.facilities.villageB.id}`
    );
    expect(choCrossDistrict.statusCode).toBe(403);
  });

  it("serializes queue items with camelCase fields including facilityId and payload", async () => {
    const response = await inject(
      seed.users.choA,
      "GET",
      `/api/queue?facilityId=${seed.facilities.villageA.id}`
    );
    expect(response.statusCode).toBe(200);
    const items = response.json() as QueueItemBody[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: queue.villageA.id,
      facilityId: seed.facilities.villageA.id,
      entityType: "PATIENT",
      entityId: seed.patients.patientA.id,
      operation: "CREATE",
      payload: { source: "village-a" },
      status: "PENDING",
      retryCount: 0,
      lastError: null,
    });
    expect(Number.isNaN(new Date(items[0].createdAt).getTime())).toBe(false);
    expect(Number.isNaN(new Date(items[0].updatedAt).getTime())).toBe(false);
  });

  it("denies retry to an ANM and leaves the item unchanged", async () => {
    const response = await inject(seed.users.anmA, "POST", `/api/queue/${queue.villageA.id}/retry`);
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("sync_queue")
      .select(["status", "retry_count", "last_error"])
      .where("id", "=", queue.villageA.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "PENDING", retry_count: 0, last_error: null });
  });

  it("allows in-scope supervisors to retry and increments the count once", async () => {
    const cases = [
      { user: seed.users.choA, item: queue.hwcA, retryCount: 3 },
      { user: seed.users.bhmA, item: queue.blockA, retryCount: 2 },
      { user: seed.users.dhsA, item: queue.districtA, retryCount: 1 },
    ];

    for (const { user, item, retryCount } of cases) {
      const response = await inject(user, "POST", `/api/queue/${item.id}/retry`);
      expect(response.statusCode).toBe(200);
      const body = response.json() as QueueItemBody;
      expect(body).toMatchObject({
        id: item.id,
        facilityId: item.facilityId,
        status: "PENDING",
        retryCount,
        lastError: null,
      });
      expect(body.payload).toBeTypeOf("object");

      const row = await db
        .selectFrom("sync_queue")
        .select(["status", "retry_count", "last_error"])
        .where("id", "=", item.id)
        .executeTakeFirstOrThrow();
      expect(row).toEqual({ status: "PENDING", retry_count: retryCount, last_error: null });
    }
  });

  it("denies cross-district retry and leaves the item unchanged", async () => {
    for (const user of [seed.users.choA, seed.users.bhmA]) {
      const response = await inject(user, "POST", `/api/queue/${queue.villageB.id}/retry`);
      expect(response.statusCode).toBe(403);
    }

    const row = await db
      .selectFrom("sync_queue")
      .select(["status", "retry_count"])
      .where("id", "=", queue.villageB.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "FAILED", retry_count: 0 });
  });

  it("returns 404 for missing queue item ids", async () => {
    const response = await inject(seed.users.choA, "POST", `/api/queue/${randomUUID()}/retry`);
    expect(response.statusCode).toBe(404);
  });
});
