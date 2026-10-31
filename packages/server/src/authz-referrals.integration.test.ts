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

interface ReferralListBody {
  data: Array<{
    id: string;
    patientId: string;
    fromFacilityId: string;
    toFacilityId: string;
    status: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

interface ReferralBody {
  id: string;
  patientId: string;
  fromFacilityId: string;
  toFacilityId: string;
  referredBy: string;
  status: string;
  respondedAt: string | null;
  respondedBy: string | null;
}

function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function tokenFor(user: UserFixture): string {
  return app.jwt.sign({ sub: user.id, facilityId: user.facilityId });
}

function inject(
  user: UserFixture,
  method: "GET" | "POST" | "PATCH",
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

function createPayload(patientId: string, toFacilityId: string, extra: object = {}): object {
  return {
    patientId,
    toFacilityId,
    reason: "High risk pregnancy",
    urgency: "RED",
    ...extra,
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

describe("referral visibility scope", () => {
  it("shows an ANM only its own outbound referrals", async () => {
    const response = await inject(seed.users.anmA, "GET", "/api/referrals");
    expect(response.statusCode).toBe(200);

    const body = response.json() as ReferralListBody;
    expect(body.total).toBe(1);
    expect(ids(body)).toEqual([referrals.villageAToChcA.id]);
    expect(ids(body)).not.toContain(referrals.villageA2ToHwcA.id);
    expect(ids(body)).not.toContain(referrals.villageBToChcB.id);
  });

  it("shows CHO the HWC subtree and BHM/DHS the block and district referrals", async () => {
    const choResponse = await inject(seed.users.choA, "GET", "/api/referrals");
    expect(choResponse.statusCode).toBe(200);
    const choBody = choResponse.json() as ReferralListBody;
    expect(choBody.total).toBe(2);
    expect(new Set(ids(choBody))).toEqual(
      new Set([referrals.villageAToChcA.id, referrals.villageA2ToHwcA.id])
    );

    const expectedSupervisor = new Set([
      referrals.villageAToChcA.id,
      referrals.villageA2ToHwcA.id,
      referrals.chcAToDistrictA.id,
    ]);

    for (const user of [seed.users.bhmA, seed.users.dhsA]) {
      const response = await inject(user, "GET", "/api/referrals");
      expect(response.statusCode).toBe(200);
      const body = response.json() as ReferralListBody;
      expect(body.total).toBe(3);
      expect(new Set(ids(body))).toEqual(expectedSupervisor);
    }
  });

  it("hides the other district from every actor", async () => {
    for (const user of [seed.users.anmA, seed.users.choA, seed.users.bhmA, seed.users.dhsA]) {
      const response = await inject(user, "GET", "/api/referrals");
      expect(response.statusCode).toBe(200);
      expect(ids(response.json() as ReferralListBody)).not.toContain(referrals.villageBToChcB.id);
    }
  });

  it("lets a REFERRAL_NODAL grant widen list and respond access across blocks", async () => {
    const { seedResponsibility } = await import("./test/factories.js");
    await seedResponsibility(db, {
      userId: seed.users.bhmA.id,
      scopeFacilityId: seed.facilities.blockB.id,
      grantedBy: seed.users.dhsA.id,
    });

    const list = await inject(seed.users.bhmA, "GET", "/api/referrals");
    expect(list.statusCode).toBe(200);
    const body = list.json() as ReferralListBody;
    expect(body.total).toBe(4);
    expect(ids(body)).toContain(referrals.villageBToChcB.id);

    const respond = await inject(
      seed.users.bhmA,
      "PATCH",
      `/api/referrals/${referrals.villageBToChcB.id}`,
      { status: "ACCEPTED" }
    );
    expect(respond.statusCode).toBe(200);
    const responded = respond.json() as ReferralBody;
    expect(responded.status).toBe("ACCEPTED");
    expect(responded.respondedBy).toBe(seed.users.bhmA.id);
  });
});

describe("referral creation scope", () => {
  it("lets an ANM create a referral for its own patient", async () => {
    const response = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.chcA.id)
    );

    expect(response.statusCode).toBe(201);
    const body = response.json() as ReferralBody;
    expect(body).toMatchObject({
      patientId: seed.patients.patientA.id,
      fromFacilityId: seed.facilities.villageA.id,
      toFacilityId: seed.facilities.chcA.id,
      referredBy: seed.users.anmA.id,
      status: "PENDING",
      respondedAt: null,
      respondedBy: null,
    });
  });

  it("denies an ANM a sibling-village patient and denies BHM/DHS entirely", async () => {
    const anmSibling = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA2.id, seed.facilities.chcA.id)
    );
    expect(anmSibling.statusCode).toBe(403);

    // BHM is a clinical write role and can create referrals now.
    const bhmResponse = await inject(
      seed.users.bhmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.chcA.id)
    );
    expect(bhmResponse.statusCode).toBe(201);

    // DHS remains read-only for clinical records.
    const dhsResponse = await inject(
      seed.users.dhsA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.chcA.id)
    );
    expect(dhsResponse.statusCode).toBe(403);

    const count = await db
      .selectFrom("referrals")
      .select((eb) => eb.fn.count("id").as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(5);
  });

  it("denies an ANM another district's patient", async () => {
    const response = await inject(
      seed.users.anmB,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.chcB.id)
    );
    expect(response.statusCode).toBe(403);
  });

  it("lets a CHO create for a village patient in its subtree", async () => {
    const response = await inject(
      seed.users.choA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA2.id, seed.facilities.chcA.id)
    );

    expect(response.statusCode).toBe(201);
    const body = response.json() as ReferralBody;
    expect(body.fromFacilityId).toBe(seed.facilities.hwcA.id);
    expect(body.referredBy).toBe(seed.users.choA.id);
  });

  it("allows an out-of-scope destination and ignores client-supplied source fields", async () => {
    const response = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.districtB.id, {
        fromFacilityId: seed.facilities.districtB.id,
        referredBy: seed.users.dhsA.id,
        status: "COMPLETED",
      })
    );

    expect(response.statusCode).toBe(201);
    const body = response.json() as ReferralBody;
    expect(body).toMatchObject({
      fromFacilityId: seed.facilities.villageA.id,
      toFacilityId: seed.facilities.districtB.id,
      referredBy: seed.users.anmA.id,
      status: "PENDING",
    });
  });

  it("returns 404 for an unknown patient or destination facility", async () => {
    const missingPatient = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(randomUUID(), seed.facilities.chcA.id)
    );
    expect(missingPatient.statusCode).toBe(404);

    const missingDestination = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, randomUUID())
    );
    expect(missingDestination.statusCode).toBe(404);
  });
});

describe("referral response authorization", () => {
  it("allows a CHO at an HWC destination and denies a CHC destination", async () => {
    const allowed = await inject(
      seed.users.choA,
      "PATCH",
      `/api/referrals/${referrals.villageA2ToHwcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(allowed.statusCode).toBe(200);
    const body = allowed.json() as ReferralBody;
    expect(body).toMatchObject({
      status: "ACCEPTED",
      respondedBy: seed.users.choA.id,
    });
    expect(body.respondedAt).not.toBeNull();

    const denied = await inject(
      seed.users.choA,
      "PATCH",
      `/api/referrals/${referrals.villageAToChcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(denied.statusCode).toBe(403);

    const unchanged = await db
      .selectFrom("referrals")
      .select(["status", "responded_by", "responded_at"])
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(unchanged).toEqual({
      status: "PENDING",
      responded_by: null,
      responded_at: null,
    });
  });

  it("allows a BHM at a CHC destination and denies an HWC destination", async () => {
    const allowed = await inject(
      seed.users.bhmA,
      "PATCH",
      `/api/referrals/${referrals.villageAToChcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(allowed.statusCode).toBe(200);
    expect((allowed.json() as ReferralBody).respondedBy).toBe(seed.users.bhmA.id);

    const denied = await inject(
      seed.users.bhmA,
      "PATCH",
      `/api/referrals/${referrals.villageA2ToHwcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(denied.statusCode).toBe(403);
  });

  it("allows a DHS at a district destination and denies a CHC destination", async () => {
    const allowed = await inject(
      seed.users.dhsA,
      "PATCH",
      `/api/referrals/${referrals.chcAToDistrictA.id}`,
      { status: "ACCEPTED" }
    );
    expect(allowed.statusCode).toBe(200);
    expect((allowed.json() as ReferralBody).respondedBy).toBe(seed.users.dhsA.id);

    const denied = await inject(
      seed.users.dhsA,
      "PATCH",
      `/api/referrals/${referrals.villageAToChcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(denied.statusCode).toBe(403);
  });

  it("denies an ANM response and leaves the referral unchanged", async () => {
    const response = await inject(
      seed.users.anmA,
      "PATCH",
      `/api/referrals/${referrals.villageAToChcA.id}`,
      { status: "ACCEPTED" }
    );
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("referrals")
      .select(["status", "responded_by", "responded_at"])
      .where("id", "=", referrals.villageAToChcA.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "PENDING", responded_by: null, responded_at: null });
  });

  it("denies a cross-district response without a nodal grant", async () => {
    const response = await inject(
      seed.users.bhmA,
      "PATCH",
      `/api/referrals/${referrals.villageBToChcB.id}`,
      { status: "ACCEPTED" }
    );
    expect(response.statusCode).toBe(403);

    const row = await db
      .selectFrom("referrals")
      .select(["status", "responded_by"])
      .where("id", "=", referrals.villageBToChcB.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: "PENDING", responded_by: null });
  });

  it("returns 404 for a missing referral and 400 for an invalid status", async () => {
    const missing = await inject(seed.users.choA, "PATCH", `/api/referrals/${randomUUID()}`, {
      status: "ACCEPTED",
    });
    expect(missing.statusCode).toBe(404);

    const invalid = await inject(
      seed.users.choA,
      "PATCH",
      `/api/referrals/${referrals.villageA2ToHwcA.id}`,
      { status: "ACKNOWLEDGED" }
    );
    expect(invalid.statusCode).toBe(400);
  });
});

describe("referral list filters", () => {
  it("applies visibility before counting and paginating", async () => {
    const first = await inject(seed.users.choA, "GET", "/api/referrals?limit=1");
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as ReferralListBody;
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.total).toBe(2);
    expect(firstBody.page).toBe(1);
    expect(firstBody.limit).toBe(1);

    const second = await inject(seed.users.choA, "GET", "/api/referrals?limit=1&page=2");
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as ReferralListBody;
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.total).toBe(2);
    expect(secondBody.page).toBe(2);
    expect(ids(secondBody)).not.toEqual(ids(firstBody));
  });

  it("narrows visible rows by status, patient, from and to", async () => {
    await db
      .updateTable("referrals")
      .set({ status: "ACCEPTED" })
      .where("id", "=", referrals.chcAToDistrictA.id)
      .execute();

    const byStatus = await inject(seed.users.bhmA, "GET", "/api/referrals?status=ACCEPTED");
    expect(byStatus.statusCode).toBe(200);
    const statusBody = byStatus.json() as ReferralListBody;
    expect(statusBody.total).toBe(1);
    expect(ids(statusBody)).toEqual([referrals.chcAToDistrictA.id]);

    const hiddenByScope = await inject(seed.users.choA, "GET", "/api/referrals?status=ACCEPTED");
    expect(hiddenByScope.statusCode).toBe(200);
    expect((hiddenByScope.json() as ReferralListBody).total).toBe(0);

    const byPatient = await inject(
      seed.users.bhmA,
      "GET",
      `/api/referrals?patientId=${seed.patients.patientA.id}`
    );
    expect(byPatient.statusCode).toBe(200);
    expect(new Set(ids(byPatient.json() as ReferralListBody))).toEqual(
      new Set([referrals.villageAToChcA.id, referrals.chcAToDistrictA.id])
    );

    const byFrom = await inject(
      seed.users.bhmA,
      "GET",
      `/api/referrals?fromFacilityId=${seed.facilities.chcA.id}`
    );
    expect(byFrom.statusCode).toBe(200);
    expect(ids(byFrom.json() as ReferralListBody)).toEqual([referrals.chcAToDistrictA.id]);

    const byTo = await inject(
      seed.users.bhmA,
      "GET",
      `/api/referrals?toFacilityId=${seed.facilities.hwcA.id}`
    );
    expect(byTo.statusCode).toBe(200);
    expect(ids(byTo.json() as ReferralListBody)).toEqual([referrals.villageA2ToHwcA.id]);
  });

  it("narrows by an out-of-subtree destination without widening or 403", async () => {
    const created = await inject(
      seed.users.anmA,
      "POST",
      "/api/referrals",
      createPayload(seed.patients.patientA.id, seed.facilities.districtB.id)
    );
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as ReferralBody;

    const filtered = await inject(
      seed.users.choA,
      "GET",
      `/api/referrals?toFacilityId=${seed.facilities.districtB.id}`
    );
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json() as ReferralListBody;
    expect(body.total).toBe(1);
    expect(ids(body)).toEqual([createdBody.id]);

    const empty = await inject(
      seed.users.choA,
      "GET",
      `/api/referrals?toFacilityId=${seed.facilities.chcB.id}`
    );
    expect(empty.statusCode).toBe(200);
    expect((empty.json() as ReferralListBody).total).toBe(0);
  });
});
