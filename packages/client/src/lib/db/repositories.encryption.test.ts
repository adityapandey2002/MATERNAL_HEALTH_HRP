import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceLockedError, isEncryptedValue, setDataKey } from "../crypto";
import { type LocalFollowUp, type LocalPatient, type LocalVisit, db } from "./local-db";
import {
  conflictRepo,
  followUpRepo,
  migrateLocalData,
  opRepo,
  patientRepo,
  visitRepo,
} from "./repositories";

async function unlock(): Promise<void> {
  const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ])) as CryptoKey;
  setDataKey(key);
}

function makePatient(overrides: Partial<LocalPatient> = {}): LocalPatient {
  return {
    id: "p1",
    abhaId: "12-3456-7890-1234",
    facilityId: "f1",
    registeredBy: "u1",
    anmName: "Asha Ben",
    name: "Rekha Devi",
    age: 26,
    phone: "9988776655",
    address: "Bhagwanpur, Araria",
    hrpReason: "PREVIOUS_C_SECTION",
    hrpComplication: null,
    ashaName: "Sunita Kumari",
    ashaPhone: "8877665544",
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

function makeVisit(overrides: Partial<LocalVisit> = {}): LocalVisit {
  return {
    id: "v1",
    patientId: "p1",
    facilityId: "f1",
    conductedBy: "u1",
    visitNumber: 1,
    visitDate: "2026-10-31T00:00:00Z",
    gestationalWeeks: 28,
    bpSystolic: 150,
    bpDiastolic: 95,
    hemoglobin: 9.2,
    weight: 52,
    dangerSigns: [],
    supplements: {},
    referred: false,
    notes: "Complains of swelling in both feet",
    createdAt: "2026-10-31T00:00:00Z",
    updatedAt: "2026-10-31T00:00:00Z",
    syncStatus: "pending",
    ...overrides,
  };
}

function makeFollowUp(overrides: Partial<LocalFollowUp> = {}): LocalFollowUp {
  return {
    id: "fu1",
    patientId: "p1",
    assignedToUserId: "u1",
    assignedByUserId: "u2",
    level: "BLOCK",
    track: "BLOCK_15_DAY",
    status: "PENDING",
    scheduledDate: "2026-11-15",
    completedAt: null,
    completedByUserId: null,
    notes: "Call ASHA before visiting",
    createdAt: "2026-10-31T00:00:00Z",
    updatedAt: "2026-10-31T00:00:00Z",
    syncStatus: "pending",
    ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setDataKey(null);
});

afterEach(() => {
  setDataKey(null);
  vi.unstubAllEnvs();
});

describe("patientRepo encryption", () => {
  it("stores identifiers as ciphertext and returns plaintext", async () => {
    await unlock();
    await patientRepo.upsert(makePatient());

    const raw = await db.patients.get("p1");
    expect(isEncryptedValue(raw?.name)).toBe(true);
    expect(isEncryptedValue(raw?.phone)).toBe(true);
    expect(isEncryptedValue(raw?.abhaId)).toBe(true);
    expect(isEncryptedValue(raw?.address)).toBe(true);
    expect(isEncryptedValue(raw?.ashaName)).toBe(true);
    expect(isEncryptedValue(raw?.ashaPhone)).toBe(true);
    expect(raw?.nameIndex).toBeTruthy();

    // Coded clinical fields stay queryable.
    expect(raw?.riskLevel).toBe("RED");
    expect(raw?.isHrp).toBe(true);

    const got = await patientRepo.get("p1");
    expect(got?.name).toBe("Rekha Devi");
    expect(got?.phone).toBe("9988776655");
    expect(got?.address).toBe("Bhagwanpur, Araria");
    expect(got?.ashaName).toBe("Sunita Kumari");
  });

  it("finds an exact name through the blind index", async () => {
    await unlock();
    await patientRepo.upsert(makePatient());
    await patientRepo.upsert(makePatient({ id: "p2", name: "Sunita Devi" }));

    const matches = await patientRepo.findByExactName("f1", "  REKHA   devi ");
    expect(matches.map((p) => p.id)).toEqual(["p1"]);

    expect(await patientRepo.findByExactName("f1", "Rekha")).toHaveLength(0);
    expect(await patientRepo.findByExactName("f2", "Rekha Devi")).toHaveLength(0);
  });

  it("keeps plaintext in demo builds without a key", async () => {
    await patientRepo.upsert(makePatient());

    const raw = await db.patients.get("p1");
    expect(raw?.name).toBe("Rekha Devi");
    expect(raw?.nameIndex).toBeNull();
  });
});

describe("visit and follow-up notes", () => {
  it("encrypts free-text notes at rest", async () => {
    await unlock();
    await visitRepo.upsert(makeVisit());
    await followUpRepo.upsert(makeFollowUp());

    expect(isEncryptedValue((await db.visits.get("v1"))?.notes)).toBe(true);
    expect(isEncryptedValue((await db.followUps.get("fu1"))?.notes)).toBe(true);

    expect((await visitRepo.get("v1"))?.notes).toBe("Complains of swelling in both feet");
    expect((await followUpRepo.get("fu1"))?.notes).toBe("Call ASHA before visiting");
  });
});

describe("sync queue encryption", () => {
  it("encrypts the payload and conflict versions at rest", async () => {
    await unlock();
    await opRepo.enqueue({
      entityType: "patient",
      entityId: "p1",
      op: "create",
      payload: { name: "Rekha Devi", phone: "9988776655" },
      clientUpdatedAt: "2026-10-31T00:00:00Z",
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      createdAt: "2026-10-31T00:00:00Z",
    });
    await conflictRepo.add({
      entityType: "PATIENT",
      entityId: "p1",
      serverVersion: { name: "Rekha Devi" },
      clientVersion: { name: "Rekha D." },
      seenAt: "2026-10-31T00:00:00Z",
    });

    const rawOp = await db.pendingOps.toCollection().first();
    expect(isEncryptedValue(rawOp?.payload)).toBe(true);

    const rawConflict = await db.conflicts.toCollection().first();
    expect(isEncryptedValue(rawConflict?.serverVersion)).toBe(true);
    expect(isEncryptedValue(rawConflict?.clientVersion)).toBe(true);

    const ops = await opRepo.list();
    expect(ops[0]?.payload).toEqual({ name: "Rekha Devi", phone: "9988776655" });

    const conflicts = await conflictRepo.list();
    expect(conflicts[0]?.serverVersion).toEqual({ name: "Rekha Devi" });
    expect(conflicts[0]?.clientVersion).toEqual({ name: "Rekha D." });
  });
});

describe("migrateLocalData", () => {
  it("encrypts rows written before the key was set", async () => {
    // Simulate a device that cached data under the old plaintext build.
    await db.patients.put(makePatient());
    await db.visits.put(makeVisit());
    await db.followUps.put(makeFollowUp());
    await db.pendingOps.add({
      entityType: "patient",
      entityId: "p1",
      op: "create",
      payload: { name: "Rekha Devi" },
      clientUpdatedAt: "2026-10-31T00:00:00Z",
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      createdAt: "2026-10-31T00:00:00Z",
    });

    await unlock();
    await migrateLocalData();

    expect(isEncryptedValue((await db.patients.get("p1"))?.name)).toBe(true);
    expect(isEncryptedValue((await db.visits.get("v1"))?.notes)).toBe(true);
    expect(isEncryptedValue((await db.followUps.get("fu1"))?.notes)).toBe(true);
    expect(isEncryptedValue((await db.pendingOps.toCollection().first())?.payload)).toBe(true);

    // Still readable through the repository boundary.
    expect((await patientRepo.get("p1"))?.name).toBe("Rekha Devi");
    expect((await visitRepo.get("v1"))?.notes).toBe("Complains of swelling in both feet");
  });

  it("is a no-op while locked", async () => {
    await db.patients.put(makePatient());
    await migrateLocalData();
    expect(isEncryptedValue((await db.patients.get("p1"))?.name)).toBe(false);
  });
});

describe("pilot lock enforcement", () => {
  it("refuses local reads without a key when the build requires encryption", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    setDataKey(null);

    await expect(patientRepo.list()).rejects.toBeInstanceOf(DeviceLockedError);
    await expect(visitRepo.byPatient("p1")).rejects.toBeInstanceOf(DeviceLockedError);
  });
});
