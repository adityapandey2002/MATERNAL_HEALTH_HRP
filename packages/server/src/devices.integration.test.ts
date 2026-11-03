import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "./db/types.js";
import type { SeedFixtures, UserFixture } from "./test/factories.js";
import {
  getIntegrationDb,
  resetIntegrationDb,
  startIntegrationDb,
  stopIntegrationDb,
} from "./test/integration-db.js";

let app: FastifyInstance;
let db: Kysely<DB>;
let seed: SeedFixtures;

const ANM_DEVICE = "11111111-1111-4111-8111-111111111111";
const OTHER_DEVICE = "22222222-2222-4222-8222-222222222222";

function tokenFor(user: UserFixture): string {
  return app.jwt.sign({ sub: user.id, facilityId: user.facilityId });
}

function headers(user: UserFixture, deviceId?: string): Record<string, string> {
  return {
    authorization: `Bearer ${tokenFor(user)}`,
    ...(deviceId ? { "x-device-id": deviceId } : {}),
  };
}

function login(user: UserFixture, deviceId?: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: {
      "content-type": "application/json",
      ...(deviceId ? { "x-device-id": deviceId } : {}),
    },
    payload: { employeeId: user.employeeId, password: "password123" },
  });
}

function pull(user: UserFixture, deviceId?: string) {
  return app.inject({ method: "GET", url: "/api/sync/pull", headers: headers(user, deviceId) });
}

function listDevices(user: UserFixture, query = "") {
  return app.inject({ method: "GET", url: `/api/devices${query}`, headers: headers(user) });
}

function revoke(user: UserFixture, deviceId: string) {
  return app.inject({
    method: "POST",
    url: `/api/devices/${deviceId}/revoke`,
    headers: headers(user),
  });
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
  const { seedBaseFixtures } = await import("./test/factories.js");
  seed = await seedBaseFixtures(getIntegrationDb());
});

afterAll(async () => {
  await app.close();
  await stopIntegrationDb();
});

describe("device registration", () => {
  it("records the install that signs in", async () => {
    const response = await login(seed.users.anmA, ANM_DEVICE);
    expect(response.statusCode).toBe(200);

    const row = await db
      .selectFrom("devices")
      .selectAll()
      .where("id", "=", ANM_DEVICE)
      .executeTakeFirstOrThrow();

    expect(row.user_id).toBe(seed.users.anmA.id);
    expect(row.revoked_at).toBeNull();
  });

  it("ignores a malformed device header instead of failing the request", async () => {
    const response = await pull(seed.users.anmA, "not-a-uuid");
    expect(response.statusCode).toBe(200);

    expect(await db.selectFrom("devices").selectAll().execute()).toHaveLength(0);
  });

  it("keeps a revoked install revoked when it signs in again", async () => {
    await login(seed.users.anmA, ANM_DEVICE);
    await revoke(seed.users.bhmA, ANM_DEVICE);

    const revokedAt = (
      await db
        .selectFrom("devices")
        .select("revoked_at")
        .where("id", "=", ANM_DEVICE)
        .executeTakeFirstOrThrow()
    ).revoked_at;

    // A blocked phone that still knows the password must not come back.
    await login(seed.users.anmA, ANM_DEVICE);

    const after = await db
      .selectFrom("devices")
      .select("revoked_at")
      .where("id", "=", ANM_DEVICE)
      .executeTakeFirstOrThrow();

    expect(after.revoked_at).toEqual(revokedAt);
  });
});

describe("revoked devices", () => {
  it("stops syncing as soon as the row is revoked", async () => {
    await login(seed.users.anmA, ANM_DEVICE);
    expect((await pull(seed.users.anmA, ANM_DEVICE)).statusCode).toBe(200);

    await revoke(seed.users.bhmA, ANM_DEVICE);

    const blocked = await pull(seed.users.anmA, ANM_DEVICE);
    expect(blocked.statusCode).toBe(401);
    expect(blocked.json()).toMatchObject({ code: "DEVICE_REVOKED" });
  });

  it("refuses to refresh a revoked install's session", async () => {
    // The native build is the one that keeps a refresh token on the device.
    const signedIn = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: {
        "content-type": "application/json",
        "x-client-platform": "native",
        "x-device-id": ANM_DEVICE,
      },
      payload: { employeeId: seed.users.anmA.employeeId, password: "password123" },
    });
    const refreshToken = signedIn.json().refreshToken as string;
    expect(refreshToken).toBeTruthy();

    await revoke(seed.users.bhmA, ANM_DEVICE);

    const refreshed = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: {
        "content-type": "application/json",
        "x-client-platform": "native",
        "x-device-id": ANM_DEVICE,
      },
      payload: { refreshToken },
    });

    expect(refreshed.statusCode).toBe(401);
    expect(refreshed.json()).toMatchObject({ code: "DEVICE_REVOKED" });
  });

  it("leaves other installs of the same user working", async () => {
    await login(seed.users.anmA, ANM_DEVICE);
    await login(seed.users.anmA, OTHER_DEVICE);

    await revoke(seed.users.bhmA, ANM_DEVICE);

    expect((await pull(seed.users.anmA, ANM_DEVICE)).statusCode).toBe(401);
    expect((await pull(seed.users.anmA, OTHER_DEVICE)).statusCode).toBe(200);
    expect((await pull(seed.users.anmA)).statusCode).toBe(200);
  });
});

describe("device supervision", () => {
  it("lists a supervisor's subtree but only its own installs for an ANM", async () => {
    await login(seed.users.anmA, ANM_DEVICE);
    await login(seed.users.anmB, OTHER_DEVICE);

    const bhm = await listDevices(seed.users.bhmA);
    expect(bhm.statusCode).toBe(200);
    const bhmIds = bhm.json().data.map((device: { id: string }) => device.id);
    expect(bhmIds).toEqual([ANM_DEVICE]);

    const anm = await listDevices(seed.users.anmA);
    expect(anm.json().data.map((device: { id: string }) => device.id)).toEqual([ANM_DEVICE]);
  });

  it("denies revocation to an ANM and leaves the device active", async () => {
    await login(seed.users.anmA, ANM_DEVICE);

    const denied = await revoke(seed.users.anmA, ANM_DEVICE);
    expect(denied.statusCode).toBe(403);

    expect((await pull(seed.users.anmA, ANM_DEVICE)).statusCode).toBe(200);
  });

  it("denies a supervisor in another district", async () => {
    await login(seed.users.anmA, ANM_DEVICE);

    const denied = await revoke(seed.users.anmB, ANM_DEVICE);
    expect(denied.statusCode).toBe(403);
  });

  it("returns 404 for an unknown device id", async () => {
    const missing = await revoke(seed.users.bhmA, "33333333-3333-4333-8333-333333333333");
    expect(missing.statusCode).toBe(404);
  });

  it("keeps the first revocation time when revoked twice", async () => {
    await login(seed.users.anmA, ANM_DEVICE);

    const first = await revoke(seed.users.bhmA, ANM_DEVICE);
    expect(first.statusCode).toBe(200);
    const firstRevokedAt = first.json().revokedAt as string;

    const second = await revoke(seed.users.dhsA, ANM_DEVICE);
    expect(second.json().revokedAt).toBe(firstRevokedAt);
  });
});
