import { randomUUID } from "node:crypto";
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

interface PatientListBody {
  data: Array<{ id: string; facilityId: string; age: number }>;
  total: number;
  limit: number;
}

interface VisitListBody {
  data: Array<{ id: string; patientId: string; facilityId: string }>;
  total: number;
}

interface PatientBody {
  id: string;
  facilityId: string;
  registeredBy: string;
  age: number;
}

interface VisitBody {
  id: string;
  patientId: string;
  facilityId: string;
  conductedBy: string;
  notes: string | null;
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function tokenFor(user: UserFixture): string {
  return app.jwt.sign({ sub: user.id, facilityId: user.facilityId });
}

function inject(
  user: UserFixture,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: object
) {
  return app.inject({
    method,
    url,
    headers: authHeader(tokenFor(user)),
    payload,
  });
}

function ids(body: { data: Array<{ id: string }> }): string[] {
  return body.data.map((row) => row.id);
}

function visitPayload(patientId: string, visitNumber: number): object {
  return {
    patientId,
    visitNumber,
    gestationalWeeks: 18,
    visitDate: "2026-03-01",
  };
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

describe("patient facility scope", () => {
  it("scopes patient lists to the actor facility subtree", async () => {
    const anmResponse = await inject(seed.users.anmA, "GET", "/api/patients");
    expect(anmResponse.statusCode).toBe(200);
    const anmBody = anmResponse.json() as PatientListBody;
    expect(anmBody.total).toBe(1);
    expect(ids(anmBody)).toEqual([seed.patients.patientA.id]);

    for (const user of [seed.users.choA, seed.users.bhmA, seed.users.dhsA]) {
      const response = await inject(user, "GET", "/api/patients");
      expect(response.statusCode).toBe(200);

      const body = response.json() as PatientListBody;
      expect(body.total).toBe(2);
      expect(new Set(ids(body))).toEqual(
        new Set([seed.patients.patientA.id, seed.patients.patientA2.id])
      );
      expect(ids(body)).not.toContain(seed.patients.patientB.id);
    }
  });

  it("applies the scope before counting and paginating", async () => {
    const response = await inject(seed.users.choA, "GET", "/api/patients?limit=1");

    expect(response.statusCode).toBe(200);
    const body = response.json() as PatientListBody;
    expect(body.data).toHaveLength(1);
    expect(body.limit).toBe(1);
    expect(body.total).toBe(2);
  });

  it("narrows by facilityId without allowing the client to widen scope", async () => {
    const choVillage = await inject(
      seed.users.choA,
      "GET",
      `/api/patients?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(choVillage.statusCode).toBe(200);
    const choBody = choVillage.json() as PatientListBody;
    expect(choBody.total).toBe(1);
    expect(ids(choBody)).toEqual([seed.patients.patientA2.id]);

    const anmOwn = await inject(
      seed.users.anmA,
      "GET",
      `/api/patients?facilityId=${seed.facilities.villageA.id}`
    );
    expect(anmOwn.statusCode).toBe(200);
    expect(ids(anmOwn.json() as PatientListBody)).toEqual([seed.patients.patientA.id]);

    const anmSibling = await inject(
      seed.users.anmA,
      "GET",
      `/api/patients?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(anmSibling.statusCode).toBe(403);

    const choOtherDistrict = await inject(
      seed.users.choA,
      "GET",
      `/api/patients?facilityId=${seed.facilities.villageB.id}`
    );
    expect(choOtherDistrict.statusCode).toBe(403);
  });

  it("hides out-of-scope patients on read but allows CHO in-subtree reads", async () => {
    const anmResponse = await inject(
      seed.users.anmA,
      "GET",
      `/api/patients/${seed.patients.patientA2.id}`
    );
    expect(anmResponse.statusCode).toBe(404);

    const choResponse = await inject(
      seed.users.choA,
      "GET",
      `/api/patients/${seed.patients.patientA2.id}`
    );
    expect(choResponse.statusCode).toBe(200);
    expect((choResponse.json() as PatientBody).id).toBe(seed.patients.patientA2.id);
  });

  it("denies out-of-scope patient patches and allows CHO patches", async () => {
    const anmResponse = await inject(
      seed.users.anmA,
      "PATCH",
      `/api/patients/${seed.patients.patientA2.id}`,
      { age: 28 }
    );
    expect(anmResponse.statusCode).toBe(403);

    const choResponse = await inject(
      seed.users.choA,
      "PATCH",
      `/api/patients/${seed.patients.patientA2.id}`,
      { age: 31 }
    );
    expect(choResponse.statusCode).toBe(200);
    const body = choResponse.json() as PatientBody;
    expect(body.age).toBe(31);
    expect(body.facilityId).toBe(seed.facilities.villageA2.id);
  });

  it("denies patient deletion and keeps the row", async () => {
    const response = await inject(
      seed.users.anmA,
      "DELETE",
      `/api/patients/${seed.patients.patientA2.id}`
    );
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("patients")
      .select(["id", "name"])
      .where("id", "=", seed.patients.patientA2.id)
      .executeTakeFirst();
    expect(row).toEqual({ id: seed.patients.patientA2.id, name: seed.patients.patientA2.name });
  });

  it("creates patients at the actor home facility", async () => {
    const response = await inject(seed.users.anmA, "POST", "/api/patients", {
      name: "Nisha Devi",
      age: 29,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as PatientBody;
    expect(body.facilityId).toBe(seed.facilities.villageA.id);
    expect(body.registeredBy).toBe(seed.users.anmA.id);
  });

  it("returns 404 for missing patient ids", async () => {
    const missing = randomUUID();

    expect((await inject(seed.users.choA, "GET", `/api/patients/${missing}`)).statusCode).toBe(404);
    expect(
      (await inject(seed.users.choA, "PATCH", `/api/patients/${missing}`, { age: 30 })).statusCode
    ).toBe(404);
    expect((await inject(seed.users.choA, "DELETE", `/api/patients/${missing}`)).statusCode).toBe(
      404
    );
  });
});

describe("visit facility scope", () => {
  it("scopes visit lists to the actor facility subtree", async () => {
    const anmResponse = await inject(seed.users.anmA, "GET", "/api/visits");
    expect(anmResponse.statusCode).toBe(200);
    const anmBody = anmResponse.json() as VisitListBody;
    expect(anmBody.total).toBe(1);
    expect(ids(anmBody)).toEqual([seed.patients.visitA.id]);

    for (const user of [seed.users.choA, seed.users.bhmA, seed.users.dhsA]) {
      const response = await inject(user, "GET", "/api/visits?sortBy=created_at");
      expect(response.statusCode).toBe(200);

      const body = response.json() as VisitListBody;
      expect(body.total).toBe(2);
      expect(new Set(ids(body))).toEqual(
        new Set([seed.patients.visitA.id, seed.patients.visitA2.id])
      );
      expect(ids(body)).not.toContain(seed.patients.visitB.id);
    }
  });

  it("narrows visit lists by facilityId without widening", async () => {
    const choResponse = await inject(
      seed.users.choA,
      "GET",
      `/api/visits?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(choResponse.statusCode).toBe(200);
    const body = choResponse.json() as VisitListBody;
    expect(body.total).toBe(1);
    expect(ids(body)).toEqual([seed.patients.visitA2.id]);

    const anmResponse = await inject(
      seed.users.anmA,
      "GET",
      `/api/visits?facilityId=${seed.facilities.villageA2.id}`
    );
    expect(anmResponse.statusCode).toBe(403);
  });

  it("scopes visits by patient and hides out-of-scope patients", async () => {
    const anmOwn = await inject(
      seed.users.anmA,
      "GET",
      `/api/visits/by-patient/${seed.patients.patientA.id}`
    );
    expect(anmOwn.statusCode).toBe(200);
    const anmVisits = anmOwn.json() as Array<{ id: string }>;
    expect(anmVisits.map((visit) => visit.id)).toEqual([seed.patients.visitA.id]);

    const anmOther = await inject(
      seed.users.anmA,
      "GET",
      `/api/visits/by-patient/${seed.patients.patientA2.id}`
    );
    expect(anmOther.statusCode).toBe(404);

    const choOther = await inject(
      seed.users.choA,
      "GET",
      `/api/visits/by-patient/${seed.patients.patientA2.id}`
    );
    expect(choOther.statusCode).toBe(200);
    const choVisits = choOther.json() as Array<{ id: string }>;
    expect(choVisits.map((visit) => visit.id)).toEqual([seed.patients.visitA2.id]);
  });

  it("enforces visit creation scope and records the actor home facility", async () => {
    const anmOther = await inject(
      seed.users.anmA,
      "POST",
      "/api/visits",
      visitPayload(seed.patients.patientA2.id, 2)
    );
    expect(anmOther.statusCode).toBe(403);

    const anmOwn = await inject(
      seed.users.anmA,
      "POST",
      "/api/visits",
      visitPayload(seed.patients.patientA.id, 2)
    );
    expect(anmOwn.statusCode).toBe(201);
    const anmVisit = anmOwn.json() as VisitBody;
    expect(anmVisit.facilityId).toBe(seed.facilities.villageA.id);
    expect(anmVisit.conductedBy).toBe(seed.users.anmA.id);

    const choOther = await inject(
      seed.users.choA,
      "POST",
      "/api/visits",
      visitPayload(seed.patients.patientA2.id, 2)
    );
    expect(choOther.statusCode).toBe(201);
    const choVisit = choOther.json() as VisitBody;
    expect(choVisit.facilityId).toBe(seed.facilities.hwcA.id);
    expect(choVisit.conductedBy).toBe(seed.users.choA.id);
  });

  it("enforces visit patch scope", async () => {
    const anmResponse = await inject(
      seed.users.anmA,
      "PATCH",
      `/api/visits/${seed.patients.visitA2.id}`,
      { notes: "updated" }
    );
    expect(anmResponse.statusCode).toBe(403);

    const choResponse = await inject(
      seed.users.choA,
      "PATCH",
      `/api/visits/${seed.patients.visitA2.id}`,
      { notes: "reviewed" }
    );
    expect(choResponse.statusCode).toBe(200);
    expect((choResponse.json() as VisitBody).notes).toBe("reviewed");
  });

  it("moves a visit only when the destination patient is in scope", async () => {
    const crossDistrict = await inject(
      seed.users.choA,
      "PATCH",
      `/api/visits/${seed.patients.visitA2.id}`,
      { patientId: seed.patients.patientB.id }
    );
    expect(crossDistrict.statusCode).toBe(403);

    const unchanged = await db
      .selectFrom("visits")
      .select(["patient_id", "facility_id"])
      .where("id", "=", seed.patients.visitA2.id)
      .executeTakeFirstOrThrow();
    expect(unchanged.patient_id).toBe(seed.patients.patientA2.id);
    expect(unchanged.facility_id).toBe(seed.facilities.villageA2.id);

    const move = await inject(seed.users.choA, "PATCH", `/api/visits/${seed.patients.visitA2.id}`, {
      patientId: seed.patients.patientA.id,
    });
    expect(move.statusCode).toBe(200);
    const body = move.json() as VisitBody;
    expect(body.patientId).toBe(seed.patients.patientA.id);
    expect(body.facilityId).toBe(seed.facilities.villageA.id);

    const moved = await db
      .selectFrom("visits")
      .select(["patient_id", "facility_id"])
      .where("id", "=", seed.patients.visitA2.id)
      .executeTakeFirstOrThrow();
    expect(moved.patient_id).toBe(seed.patients.patientA.id);
    expect(moved.facility_id).toBe(seed.facilities.villageA.id);
  });

  it("returns 404 for missing patient and visit ids", async () => {
    const missing = randomUUID();

    expect(
      (await inject(seed.users.choA, "GET", `/api/visits/by-patient/${missing}`)).statusCode
    ).toBe(404);
    expect(
      (await inject(seed.users.choA, "POST", "/api/visits", visitPayload(missing, 1))).statusCode
    ).toBe(404);
    expect(
      (await inject(seed.users.choA, "PATCH", `/api/visits/${missing}`, { notes: "x" })).statusCode
    ).toBe(404);
  });
});

describe("supervision roles are read-only for clinical records", () => {
  it("denies BHM and DHS patient and visit creation", async () => {
    for (const user of [seed.users.bhmA, seed.users.dhsA]) {
      const patientResponse = await inject(user, "POST", "/api/patients", {
        name: "New Patient",
        age: 30,
      });
      expect(patientResponse.statusCode).toBe(403);

      const visitResponse = await inject(
        user,
        "POST",
        "/api/visits",
        visitPayload(seed.patients.patientA.id, 2)
      );
      expect(visitResponse.statusCode).toBe(403);
    }

    const patientCount = await db
      .selectFrom("patients")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(patientCount.count)).toBe(3);

    const visitCount = await db
      .selectFrom("visits")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(visitCount.count)).toBe(3);
  });
});
