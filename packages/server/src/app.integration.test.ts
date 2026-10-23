import { randomUUID } from "node:crypto";
import type { UserRole } from "@hrp/shared";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertCan } from "./authz/policy.js";
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

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function tokenFor(
  user: UserFixture,
  claims: { role?: UserRole; facilityId?: string } = {}
): string {
  return app.jwt.sign({
    sub: user.id,
    role: claims.role,
    facilityId: claims.facilityId ?? user.facilityId,
  });
}

beforeAll(async () => {
  const context = await startIntegrationDb();
  db = context.db;

  const { buildApp } = await import("./app.js");

  app = buildApp({ logger: false });
  app.get("/__test/actor", { preHandler: [app.authenticate] }, async (request) => request.actor);
  app.get("/__test/authz/not-found", { preHandler: [app.authenticate] }, async (request) => {
    assertCan(request.actor, "patient:read", {
      type: "facility",
      facilityPath: "INDIA.BIHAR.KISHANGANJ",
    });
  });
  app.get("/__test/authz/forbidden", { preHandler: [app.authenticate] }, async (request) => {
    assertCan(request.actor, "patient:write", {
      type: "facility",
      facilityPath: "INDIA.BIHAR.KISHANGANJ",
    });
  });
  app.get("/__test/error", async () => {
    throw new Error("sensitive internal detail");
  });
  app.get(
    "/__test/schema-validation",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        },
      },
    },
    async () => ({ ok: true })
  );

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

describe("app factory and authz middleware", () => {
  it("serves health without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("reports readiness after migrations run", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready", database: "ok" });
  });

  it("returns the current user and resolves the database actor", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(tokenFor(seed.users.anmA)),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      employeeId: "ANM001",
      role: "ANM",
      facilityId: seed.facilities.villageA.id,
    });

    const actorResponse = await app.inject({
      method: "GET",
      url: "/__test/actor",
      headers: authHeader(tokenFor(seed.users.anmA)),
    });

    expect(actorResponse.statusCode).toBe(200);
    expect(actorResponse.json()).toMatchObject({
      userId: seed.users.anmA.id,
      role: "ANM",
      facilityId: seed.facilities.villageA.id,
      facilityPath: seed.facilities.villageA.path,
      facilityLevel: "VILLAGE",
      homeFacilityId: seed.facilities.villageA.id,
      homeFacilityPath: seed.facilities.villageA.path,
      homeFacilityLevel: "VILLAGE",
    });
  });

  it("rejects an unknown user with 401", async () => {
    const token = app.jwt.sign({ sub: randomUUID(), facilityId: seed.facilities.villageA.id });
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Unauthorized" });
  });

  it("rejects an invalid bearer token with 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader("not-a-token"),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Unauthorized" });
  });

  it("rejects a token without a subject with 401", async () => {
    const token = app.jwt.sign({ sub: "", facilityId: seed.facilities.villageA.id });
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Unauthorized" });
  });

  it("accepts an empty JSON body on a public route", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { "content-type": "application/json" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Logged out" });
  });

  it("accepts a disabled logger option", async () => {
    const { buildApp } = await import("./app.js");
    const quietApp = buildApp({ logger: { enabled: false } });

    await quietApp.ready();
    await quietApp.close();
  });

  it("rejects an inactive user with 401", async () => {
    const { seedInactiveUser } = await import("./test/factories.js");
    const inactive = await seedInactiveUser(db, seed.facilities);

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(tokenFor(inactive)),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ message: "Unauthorized" });
  });

  it("rejects a legacy role with 403", async () => {
    const { seedLegacyRoleUser } = await import("./test/factories.js");
    const legacy = await seedLegacyRoleUser(db, seed.facilities);

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(tokenFor(legacy)),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Forbidden" });
  });

  it("rejects a role and facility mismatch with 403", async () => {
    const { seedRoleFacilityMismatchUser } = await import("./test/factories.js");
    const mismatched = await seedRoleFacilityMismatchUser(db, seed.facilities);

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: authHeader(tokenFor(mismatched)),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Forbidden" });
  });

  it("ignores forged role and facility claims in the token", async () => {
    const token = tokenFor(seed.users.anmA, {
      role: "DHS",
      facilityId: seed.facilities.districtB.id,
    });

    const response = await app.inject({
      method: "GET",
      url: "/__test/actor",
      headers: authHeader(token),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      userId: seed.users.anmA.id,
      role: "ANM",
      facilityId: seed.facilities.villageA.id,
      facilityPath: seed.facilities.villageA.path,
      facilityLevel: "VILLAGE",
    });
  });

  it("maps out-of-scope reads to a generic 404", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__test/authz/not-found",
      headers: authHeader(tokenFor(seed.users.anmA)),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: "Not found" });
  });

  it("maps denied writes to a generic 403", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__test/authz/forbidden",
      headers: authHeader(tokenFor(seed.users.anmA)),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Forbidden" });
  });

  it("returns a generic 500 for unknown errors", async () => {
    const response = await app.inject({ method: "GET", url: "/__test/error" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: "Internal server error" });
  });

  it("preserves validation errors as 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { employeeId: "ANM001" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ValidationError",
      message: "Request validation failed",
    });
  });

  it("preserves Fastify schema validation as 400", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__test/schema-validation",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, error: "Bad Request" });
  });
});
