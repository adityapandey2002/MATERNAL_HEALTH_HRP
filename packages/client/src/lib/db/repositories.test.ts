import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { type LocalPatient, db } from "./local-db";
import {
  clearAllLocalData,
  conflictRepo,
  followUpRepo,
  metaRepo,
  opRepo,
  patientRepo,
  visitRepo,
} from "./repositories";

function makePatient(overrides: Partial<LocalPatient> = {}): LocalPatient {
  return {
    id: "p1",
    abhaId: null,
    facilityId: "f1",
    registeredBy: "u1",
    anmName: null,
    name: "Rekha Devi",
    age: 26,
    phone: "9988776655",
    address: null,
    hrpReason: "PREVIOUS_C_SECTION",
    hrpComplication: null,
    ashaName: null,
    ashaPhone: null,
    referred: true,
    isHrp: true,
    followUpTrack: null,
    followUpScheduledDate: null,
    followUpStatus: "PENDING",
    lmp: null,
    edd: null,
    gravida: 2,
    para: 1,
    abortions: 0,
    riskFactors: [],
    riskLevel: "RED",
    riskScore: 5,
    isHighRisk: true,
    createdAt: "2026-10-31T00:00:00Z",
    updatedAt: "2026-10-31T00:00:00Z",
    syncStatus: "pending",
    ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("patientRepo", () => {
  it("upserts and reads a patient", async () => {
    await patientRepo.upsert(makePatient());
    const got = await patientRepo.get("p1");
    expect(got?.name).toBe("Rekha Devi");
    expect(await patientRepo.pendingCount()).toBe(1);
  });

  it("lists all patients", async () => {
    await patientRepo.upsert(makePatient({ id: "p2", name: "Sunita", syncStatus: "synced" }));
    const all = await patientRepo.list();
    expect(all).toHaveLength(1);
  });
});

describe("opRepo", () => {
  it("enqueues and lists pending ops in order", async () => {
    await opRepo.enqueue({
      entityType: "patient",
      entityId: "p1",
      op: "create",
      payload: { name: "Rekha" },
      clientUpdatedAt: "2026-10-31T00:00:00Z",
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      createdAt: "2026-10-31T00:00:00Z",
    });
    const ops = await opRepo.list();
    expect(ops).toHaveLength(1);
    expect(ops[0].entityType).toBe("patient");
    expect(await opRepo.count()).toBe(1);
  });

  it("removes an op after ack", async () => {
    const seq = await opRepo.enqueue({
      entityType: "visit",
      entityId: "v1",
      op: "create",
      payload: {},
      clientUpdatedAt: "2026-10-31T00:00:00Z",
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      createdAt: "2026-10-31T00:00:00Z",
    });
    await opRepo.remove(seq);
    expect(await opRepo.count()).toBe(0);
  });
});

describe("metaRepo", () => {
  it("stores and reads a value", async () => {
    await metaRepo.set("lastPulledAt", "2026-10-31T00:00:00Z");
    expect(await metaRepo.get("lastPulledAt")).toBe("2026-10-31T00:00:00Z");
    expect(await metaRepo.get("missing")).toBeNull();
  });
});

describe("clearAllLocalData", () => {
  it("wipes every table", async () => {
    await patientRepo.upsert(makePatient({ id: "p3", name: "X", syncStatus: "synced" }));
    await metaRepo.set("k", "v");
    await clearAllLocalData();
    expect(await patientRepo.list()).toHaveLength(0);
    expect(await metaRepo.get("k")).toBeNull();
  });
});
