import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "./db/types.js";
import type { ReferralFixtures, SeedFixtures, UserFixture } from "./test/factories.js";
import {
  getIntegrationDb,
  resetIntegrationDb,
  startIntegrationDb,
  stopIntegrationDb,
} from "./test/integration-db.js";

let app: FastifyInstance;
let db: Kysely<DB>;
let seed: SeedFixtures;
let referrals: ReferralFixtures;

interface SyncPatientBody {
  id: string;
  facilityId: string;
  registeredBy: string;
  name: string;
  age: number;
}

interface SyncVisitBody {
  id: string;
  patientId: string;
  facilityId: string;
  conductedBy: string;
  visitNumber: number;
  notes: string | null;
}

interface SyncReferralBody {
  id: string;
  patientId: string;
  fromFacilityId: string;
  toFacilityId: string;
  referredBy: string;
  reason: string;
  urgency: string;
  status: string;
}

interface SyncResponseBody {
  patients: SyncPatientBody[];
  visits: SyncVisitBody[];
  referrals: SyncReferralBody[];
  serverTimestamp: string;
  conflicts?: Array<{
    entityType: string;
    entityId: string;
    serverVersion: SyncPatientBody | SyncVisitBody | SyncReferralBody;
    clientVersion: unknown;
  }>;
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function tokenFor(user: UserFixture): string {
  return app.jwt.sign({ sub: user.id, facilityId: user.facilityId });
}

function push(user: UserFixture, payload: object) {
  return app.inject({
    method: "POST",
    url: "/api/sync/push",
    headers: authHeader(tokenFor(user)),
    payload,
  });
}

function pull(user: UserFixture, since?: string) {
  const search = since === undefined ? "" : `?since=${encodeURIComponent(since)}`;
  return app.inject({
    method: "GET",
    url: `/api/sync/pull${search}`,
    headers: authHeader(tokenFor(user)),
  });
}

function ids(rows: Array<{ id: string }>): string[] {
  return rows.map((row) => row.id);
}

function patientPayload(overrides: object = {}): object {
  return {
    name: "Nisha Devi",
    age: 29,
    ...overrides,
  };
}

function visitPayload(patientId: string, visitNumber: number, overrides: object = {}): object {
  return {
    patientId,
    visitNumber,
    gestationalWeeks: 20,
    visitDate: "2026-03-01",
    ...overrides,
  };
}

function referralPayload(patientId: string, toFacilityId: string, overrides: object = {}): object {
  return {
    patientId,
    toFacilityId,
    reason: "High risk pregnancy",
    urgency: "RED",
    ...overrides,
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
  const { seedBaseFixtures, seedReferralFixtures } = await import("./test/factories.js");
  seed = await seedBaseFixtures(getIntegrationDb());
  referrals = await seedReferralFixtures(db, seed.facilities, seed.patients, seed.users);
});

afterAll(async () => {
  await app.close();
  await stopIntegrationDb();
});

describe("sync push validation", () => {
  it("accepts an empty push and returns the actor scope", async () => {
    const response = await push(seed.users.anmA, {});

    expect(response.statusCode).toBe(200);
    const body = response.json() as SyncResponseBody;
    expect(ids(body.patients)).toEqual([seed.patients.patientA.id]);
    expect(ids(body.visits)).toEqual([seed.patients.visitA.id]);
    expect(ids(body.referrals)).toEqual([referrals.villageAToChcA.id]);
    expect(body.conflicts).toBeUndefined();
  });

  it("rejects invalid bodies before touching the database", async () => {
    const invalid = await push(seed.users.anmA, {
      patients: [{ ...patientPayload(), name: "", age: 10 }],
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: "ValidationError" });

    const oversized = await push(seed.users.anmA, {
      patients: Array.from({ length: 101 }, (_, index) =>
        patientPayload({ name: `Patient ${index}` })
      ),
    });
    expect(oversized.statusCode).toBe(400);

    const count = await db
      .selectFrom("patients")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(3);
  });
});

describe("sync patient scope", () => {
  it("lets an ANM update its own patient without changing facility or registrant", async () => {
    const response = await push(seed.users.anmA, {
      patients: [
        patientPayload({
          id: seed.patients.patientA.id,
          name: "Rekha Devi Updated",
          age: 28,
          facilityId: seed.facilities.villageB.id,
          registeredBy: seed.users.anmB.id,
        }),
      ],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("patients")
      .selectAll()
      .where("id", "=", seed.patients.patientA.id)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Rekha Devi Updated");
    expect(row.age).toBe(28);
    expect(row.facility_id).toBe(seed.facilities.villageA.id);
    expect(row.registered_by).toBe(seed.users.anmA.id);

    const body = response.json() as SyncResponseBody;
    const synced = body.patients.find((patient) => patient.id === seed.patients.patientA.id);
    expect(synced?.facilityId).toBe(seed.facilities.villageA.id);
  });

  it("denies an ANM writing a sibling-village or other-district patient", async () => {
    for (const patient of [seed.patients.patientA2, seed.patients.patientB]) {
      const response = await push(seed.users.anmA, {
        patients: [patientPayload({ id: patient.id, name: "Tampered", age: 30 })],
      });
      expect(response.statusCode).toBe(403);
    }

    const rows = await db
      .selectFrom("patients")
      .select(["id", "name"])
      .where("id", "in", [seed.patients.patientA2.id, seed.patients.patientB.id])
      .execute();
    expect(new Set(rows.map((row) => row.name))).toEqual(
      new Set([seed.patients.patientA2.name, seed.patients.patientB.name])
    );
  });

  it("lets a CHO update a subtree patient and denies supervisors", async () => {
    const choResponse = await push(seed.users.choA, {
      patients: [
        patientPayload({
          id: seed.patients.patientA2.id,
          name: "Kavita Devi Updated",
          age: 31,
        }),
      ],
    });
    expect(choResponse.statusCode).toBe(200);

    const row = await db
      .selectFrom("patients")
      .selectAll()
      .where("id", "=", seed.patients.patientA2.id)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Kavita Devi Updated");
    expect(row.facility_id).toBe(seed.facilities.villageA2.id);
    expect(row.registered_by).toBe(seed.users.anmA.id);

    // BHM is a clinical write role and can push patients now.
    const bhmResponse = await push(seed.users.bhmA, {
      patients: [patientPayload({ name: "Supervisor Created" })],
    });
    expect(bhmResponse.statusCode).toBe(200);

    // DHS remains read-only for clinical records.
    const dhsResponse = await push(seed.users.dhsA, {
      patients: [patientPayload({ name: "Supervisor Created" })],
    });
    expect(dhsResponse.statusCode).toBe(403);

    const count = await db
      .selectFrom("patients")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(4);
  });

  it("creates a new patient at the actor home facility", async () => {
    const response = await push(seed.users.anmA, {
      patients: [patientPayload({ name: "Nisha Devi" })],
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as SyncResponseBody;
    const created = body.patients.find((patient) => patient.name === "Nisha Devi");
    expect(created).toBeDefined();
    expect(created?.facilityId).toBe(seed.facilities.villageA.id);
    expect(created?.registeredBy).toBe(seed.users.anmA.id);
  });

  it("preserves a client-supplied id for a new patient", async () => {
    const id = randomUUID();
    const response = await push(seed.users.anmA, {
      patients: [patientPayload({ id, name: "Preserved Id" })],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("patients")
      .select(["id", "facility_id", "registered_by"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      id,
      facility_id: seed.facilities.villageA.id,
      registered_by: seed.users.anmA.id,
    });
  });

  it("reports conflicts only after authorization and leaves the row unchanged", async () => {
    const stale = new Date(Date.now() - 86_400_000).toISOString();

    const patientResponse = await push(seed.users.anmA, {
      patients: [
        patientPayload({ id: seed.patients.patientA.id, name: "Stale", updatedAt: stale }),
      ],
    });
    expect(patientResponse.statusCode).toBe(200);
    const patientBody = patientResponse.json() as SyncResponseBody;
    expect(patientBody.conflicts).toHaveLength(1);
    expect(patientBody.conflicts?.[0]).toMatchObject({
      entityType: "PATIENT",
      entityId: seed.patients.patientA.id,
      serverVersion: { id: seed.patients.patientA.id, facilityId: seed.facilities.villageA.id },
    });

    const visitResponse = await push(seed.users.anmA, {
      visits: [
        visitPayload(seed.patients.patientA.id, 1, {
          id: seed.patients.visitA.id,
          notes: "Stale visit",
          updatedAt: stale,
        }),
      ],
    });
    expect(visitResponse.statusCode).toBe(200);
    const visitBody = visitResponse.json() as SyncResponseBody;
    expect(visitBody.conflicts?.[0]).toMatchObject({
      entityType: "VISIT",
      entityId: seed.patients.visitA.id,
      serverVersion: { id: seed.patients.visitA.id, facilityId: seed.facilities.villageA.id },
    });

    const referralResponse = await push(seed.users.anmA, {
      referrals: [
        referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id, {
          id: referrals.villageAToChcA.id,
          reason: "Stale referral",
          updatedAt: stale,
        }),
      ],
    });
    expect(referralResponse.statusCode).toBe(200);
    const referralBody = referralResponse.json() as SyncResponseBody;
    expect(referralBody.conflicts?.[0]).toMatchObject({
      entityType: "REFERRAL",
      entityId: referrals.villageAToChcA.id,
      serverVersion: { id: referrals.villageAToChcA.id },
    });

    const patient = await db
      .selectFrom("patients")
      .select("name")
      .where("id", "=", seed.patients.patientA.id)
      .executeTakeFirstOrThrow();
    expect(patient.name).toBe(seed.patients.patientA.name);

    const visit = await db
      .selectFrom("visits")
      .select("notes")
      .where("id", "=", seed.patients.visitA.id)
      .executeTakeFirstOrThrow();
    expect(visit.notes).toBeNull();

    const referral = await db
      .selectFrom("referrals")
      .select("reason")
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(referral.reason).toBe("Test referral");
  });
});

describe("sync visit scope", () => {
  it("updates an own visit while preserving facility and conductor", async () => {
    const response = await push(seed.users.anmA, {
      visits: [
        visitPayload(seed.patients.patientA.id, 1, {
          id: seed.patients.visitA.id,
          gestationalWeeks: 22,
          notes: "synced",
          facilityId: seed.facilities.districtB.id,
          conductedBy: seed.users.dhsA.id,
        }),
      ],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("visits")
      .selectAll()
      .where("id", "=", seed.patients.visitA.id)
      .executeTakeFirstOrThrow();
    expect(row.patient_id).toBe(seed.patients.patientA.id);
    expect(row.facility_id).toBe(seed.facilities.villageA.id);
    expect(row.conducted_by).toBe(seed.users.anmA.id);
    expect(row.gestational_weeks).toBe(22);
    expect(row.notes).toBe("synced");
  });

  it("denies cross-village updates and new visits for out-of-scope patients", async () => {
    const crossVillage = await push(seed.users.anmA, {
      visits: [
        visitPayload(seed.patients.patientA2.id, 1, {
          id: seed.patients.visitA2.id,
          notes: "cross-village",
        }),
      ],
    });
    expect(crossVillage.statusCode).toBe(403);

    const newVisit = await push(seed.users.anmA, {
      visits: [visitPayload(seed.patients.patientA2.id, 2)],
    });
    expect(newVisit.statusCode).toBe(403);

    const count = await db
      .selectFrom("visits")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(3);
  });

  it("moves a visit only when the destination patient is in scope", async () => {
    const move = await push(seed.users.choA, {
      visits: [
        visitPayload(seed.patients.patientA.id, 1, {
          id: seed.patients.visitA2.id,
          gestationalWeeks: 16,
          visitDate: "2026-02-11",
        }),
      ],
    });
    expect(move.statusCode).toBe(200);

    const moved = await db
      .selectFrom("visits")
      .select(["patient_id", "facility_id", "conducted_by"])
      .where("id", "=", seed.patients.visitA2.id)
      .executeTakeFirstOrThrow();
    expect(moved).toEqual({
      patient_id: seed.patients.patientA.id,
      facility_id: seed.facilities.villageA.id,
      conducted_by: seed.users.anmA.id,
    });

    const denied = await push(seed.users.anmA, {
      visits: [
        visitPayload(seed.patients.patientA2.id, 1, {
          id: seed.patients.visitA.id,
          notes: "move denied",
        }),
      ],
    });
    expect(denied.statusCode).toBe(403);

    const unchanged = await db
      .selectFrom("visits")
      .select(["patient_id", "facility_id", "notes"])
      .where("id", "=", seed.patients.visitA.id)
      .executeTakeFirstOrThrow();
    expect(unchanged).toEqual({
      patient_id: seed.patients.patientA.id,
      facility_id: seed.facilities.villageA.id,
      notes: null,
    });
  });

  it("creates a new visit for an own patient at the actor home facility", async () => {
    const response = await push(seed.users.anmA, {
      visits: [visitPayload(seed.patients.patientA.id, 2, { notes: "new visit" })],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("visits")
      .selectAll()
      .where("patient_id", "=", seed.patients.patientA.id)
      .where("visit_number", "=", 2)
      .executeTakeFirstOrThrow();
    expect(row.facility_id).toBe(seed.facilities.villageA.id);
    expect(row.conducted_by).toBe(seed.users.anmA.id);
    expect(row.notes).toBe("new visit");
  });

  it("returns 404 when the visit patient is missing", async () => {
    const response = await push(seed.users.anmA, {
      visits: [visitPayload(randomUUID(), 1)],
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("sync referral scope", () => {
  it("creates a referral from the actor home and ignores spoofed source fields", async () => {
    const response = await push(seed.users.anmA, {
      referrals: [
        referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id, {
          reason: "Needs review",
          fromFacilityId: seed.facilities.districtB.id,
          referredBy: seed.users.dhsA.id,
          status: "COMPLETED",
        }),
      ],
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as SyncResponseBody;
    const created = body.referrals.find((referral) => referral.reason === "Needs review");
    expect(created).toMatchObject({
      patientId: seed.patients.patientA.id,
      fromFacilityId: seed.facilities.villageA.id,
      toFacilityId: seed.facilities.chcA.id,
      referredBy: seed.users.anmA.id,
      status: "PENDING",
    });

    const row = await db
      .selectFrom("referrals")
      .selectAll()
      .where("id", "=", created?.id ?? "")
      .executeTakeFirstOrThrow();
    expect(row.from_facility_id).toBe(seed.facilities.villageA.id);
    expect(row.referred_by).toBe(seed.users.anmA.id);
    expect(row.status).toBe("PENDING");
  });

  it("lets BHM create referrals", async () => {
    const response = await push(seed.users.bhmA, {
      referrals: [referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id)],
    });
    expect(response.statusCode).toBe(200);

    const count = await db
      .selectFrom("referrals")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(5);
  });

  it("lets the creator update reason and urgency without changing routing or status", async () => {
    const response = await push(seed.users.anmA, {
      referrals: [
        referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id, {
          id: referrals.villageAToChcA.id,
          reason: "Creator updated reason",
          urgency: "GREEN",
          fromFacilityId: seed.facilities.districtB.id,
          referredBy: seed.users.dhsA.id,
          status: "COMPLETED",
        }),
      ],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("referrals")
      .selectAll()
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(row.reason).toBe("Creator updated reason");
    expect(row.urgency).toBe("GREEN");
    expect(row.status).toBe("PENDING");
    expect(row.patient_id).toBe(seed.patients.patientA.id);
    expect(row.from_facility_id).toBe(seed.facilities.villageA.id);
    expect(row.to_facility_id).toBe(seed.facilities.chcA.id);
    expect(row.referred_by).toBe(seed.users.anmA.id);
  });

  it("lets the destination BHM update without changing routing or status", async () => {
    const response = await push(seed.users.bhmA, {
      referrals: [
        referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id, {
          id: referrals.villageAToChcA.id,
          reason: "BHM reviewed",
          urgency: "AMBER",
          fromFacilityId: seed.facilities.districtB.id,
          referredBy: seed.users.dhsA.id,
          status: "COMPLETED",
        }),
      ],
    });

    expect(response.statusCode).toBe(200);
    const row = await db
      .selectFrom("referrals")
      .selectAll()
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(row.reason).toBe("BHM reviewed");
    expect(row.urgency).toBe("AMBER");
    expect(row.status).toBe("PENDING");
    expect(row.from_facility_id).toBe(seed.facilities.villageA.id);
    expect(row.to_facility_id).toBe(seed.facilities.chcA.id);
    expect(row.referred_by).toBe(seed.users.anmA.id);
  });

  it("denies an unrelated ANM and leaves the referral unchanged", async () => {
    const response = await push(seed.users.anmB, {
      referrals: [
        referralPayload(seed.patients.patientA.id, seed.facilities.chcA.id, {
          id: referrals.villageAToChcA.id,
          reason: "Unrelated update",
        }),
      ],
    });
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("referrals")
      .select(["reason", "status", "from_facility_id", "to_facility_id"])
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      reason: "Test referral",
      status: "PENDING",
      from_facility_id: seed.facilities.villageA.id,
      to_facility_id: seed.facilities.chcA.id,
    });
  });

  it("returns 404 for an unknown patient or destination facility", async () => {
    const missingPatient = await push(seed.users.anmA, {
      referrals: [referralPayload(randomUUID(), seed.facilities.chcA.id)],
    });
    expect(missingPatient.statusCode).toBe(404);

    const missingDestination = await push(seed.users.anmA, {
      referrals: [referralPayload(seed.patients.patientA.id, randomUUID())],
    });
    expect(missingDestination.statusCode).toBe(404);
  });
});

describe("sync pull and response scope", () => {
  it("returns only subtree patients and visits and visible referrals", async () => {
    for (const user of [seed.users.choA, seed.users.bhmA, seed.users.dhsA]) {
      const response = await push(user, {});
      expect(response.statusCode).toBe(200);

      const body = response.json() as SyncResponseBody;
      expect(ids(body.patients)).not.toContain(seed.patients.patientB.id);
      expect(ids(body.visits)).not.toContain(seed.patients.visitB.id);
      expect(ids(body.referrals)).not.toContain(referrals.villageBToChcB.id);
    }

    const choPush = (await push(seed.users.choA, {})).json() as SyncResponseBody;
    expect(new Set(ids(choPush.patients))).toEqual(
      new Set([seed.patients.patientA.id, seed.patients.patientA2.id])
    );
    expect(new Set(ids(choPush.visits))).toEqual(
      new Set([seed.patients.visitA.id, seed.patients.visitA2.id])
    );

    const choPull = (await pull(seed.users.choA)).json() as SyncResponseBody;
    expect(new Set(ids(choPull.patients))).toEqual(
      new Set([seed.patients.patientA.id, seed.patients.patientA2.id])
    );
    expect(new Set(ids(choPull.visits))).toEqual(
      new Set([seed.patients.visitA.id, seed.patients.visitA2.id])
    );
    expect(new Set(ids(choPull.referrals))).toEqual(
      new Set([referrals.villageAToChcA.id, referrals.villageA2ToHwcA.id])
    );
    expect(ids(choPull.referrals)).not.toContain(referrals.villageBToChcB.id);

    const dhsPull = (await pull(seed.users.dhsA)).json() as SyncResponseBody;
    expect(ids(dhsPull.patients)).not.toContain(seed.patients.patientB.id);
    expect(ids(dhsPull.visits)).not.toContain(seed.patients.visitB.id);
    expect(ids(dhsPull.referrals)).not.toContain(referrals.villageBToChcB.id);
  });

  it("filters pull results by since and rejects invalid cursors", async () => {
    const oldDate = new Date("2026-01-01T00:00:00.000Z");
    const newDate = new Date("2026-03-01T00:00:00.000Z");

    await db
      .updateTable("patients")
      .set({ updated_at: oldDate })
      .where("id", "=", seed.patients.patientA.id)
      .execute();
    await db
      .updateTable("patients")
      .set({ updated_at: newDate })
      .where("id", "=", seed.patients.patientA2.id)
      .execute();
    await db
      .updateTable("visits")
      .set({ updated_at: oldDate })
      .where("id", "=", seed.patients.visitA.id)
      .execute();
    await db
      .updateTable("visits")
      .set({ updated_at: newDate })
      .where("id", "=", seed.patients.visitA2.id)
      .execute();
    await db
      .updateTable("referrals")
      .set({ updated_at: oldDate })
      .where("id", "=", referrals.villageAToChcA.id)
      .execute();
    await db
      .updateTable("referrals")
      .set({ updated_at: newDate })
      .where("id", "=", referrals.villageA2ToHwcA.id)
      .execute();

    const response = await pull(seed.users.choA, "2026-02-01T00:00:00.000Z");
    expect(response.statusCode).toBe(200);

    const body = response.json() as SyncResponseBody;
    expect(ids(body.patients)).toEqual([seed.patients.patientA2.id]);
    expect(ids(body.visits)).toEqual([seed.patients.visitA2.id]);
    expect(ids(body.referrals)).toEqual([referrals.villageA2ToHwcA.id]);

    expect((await pull(seed.users.choA, "not-a-date")).statusCode).toBe(400);
    expect((await pull(seed.users.choA, "")).statusCode).toBe(400);
  });
});
