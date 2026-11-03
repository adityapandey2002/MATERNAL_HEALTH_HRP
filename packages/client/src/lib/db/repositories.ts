import {
  DeviceLockedError,
  blindIndex,
  canUseLocalData,
  decryptJson,
  decryptNullable,
  decryptString,
  encryptJson,
  encryptNullable,
  encryptString,
  hasDataKey,
  isEncryptedValue,
  normaliseName,
} from "../crypto";
import {
  type ConflictRecord,
  type LocalFollowUp,
  type LocalPatient,
  type LocalVisit,
  type PendingOp,
  db,
} from "./local-db";

/**
 * The repository layer is the encryption boundary.
 *
 * Screens and the sync engine only ever see plaintext domain objects. Every
 * write goes through `encode*`, which encrypts direct identifiers and notes
 * when the PIN key is unlocked; every read goes through `decode*`. Demo builds
 * (no PIN) keep plaintext because they only hold synthetic records.
 */

function assertLocalDataUsable(): void {
  if (!canUseLocalData()) {
    // Pilot build, device locked: fail closed rather than write plaintext.
    throw new DeviceLockedError();
  }
}

/** Facility-scoped so the same name at two facilities does not collide. */
async function nameIndexFor(facilityId: string, name: string): Promise<string | null> {
  if (!hasDataKey()) return null;
  return blindIndex(`${facilityId}|${normaliseName(name)}`);
}

async function encodePatient(patient: LocalPatient): Promise<LocalPatient> {
  if (!hasDataKey()) return { ...patient, nameIndex: null };
  return {
    ...patient,
    name: await encryptString(patient.name),
    abhaId: await encryptNullable(patient.abhaId),
    phone: await encryptNullable(patient.phone),
    address: await encryptNullable(patient.address),
    ashaName: await encryptNullable(patient.ashaName),
    ashaPhone: await encryptNullable(patient.ashaPhone),
    nameIndex: await nameIndexFor(patient.facilityId, patient.name),
  };
}

async function decodePatient(patient: LocalPatient): Promise<LocalPatient> {
  if (!hasDataKey()) return patient;
  return {
    ...patient,
    name: await decryptString(patient.name),
    abhaId: await decryptNullable(patient.abhaId),
    phone: await decryptNullable(patient.phone),
    address: await decryptNullable(patient.address),
    ashaName: await decryptNullable(patient.ashaName),
    ashaPhone: await decryptNullable(patient.ashaPhone),
  };
}

async function encodeVisit(visit: LocalVisit): Promise<LocalVisit> {
  if (!hasDataKey()) return visit;
  return { ...visit, notes: await encryptNullable(visit.notes) };
}

async function decodeVisit(visit: LocalVisit): Promise<LocalVisit> {
  if (!hasDataKey()) return visit;
  return { ...visit, notes: await decryptNullable(visit.notes) };
}

async function encodeFollowUp(followUp: LocalFollowUp): Promise<LocalFollowUp> {
  if (!hasDataKey()) return followUp;
  return { ...followUp, notes: await encryptNullable(followUp.notes) };
}

async function decodeFollowUp(followUp: LocalFollowUp): Promise<LocalFollowUp> {
  if (!hasDataKey()) return followUp;
  return { ...followUp, notes: await decryptNullable(followUp.notes) };
}

export const patientRepo = {
  async get(id: string): Promise<LocalPatient | undefined> {
    assertLocalDataUsable();
    const row = await db.patients.get(id);
    return row ? decodePatient(row) : undefined;
  },
  async list(): Promise<LocalPatient[]> {
    assertLocalDataUsable();
    const rows = await db.patients.toArray();
    return Promise.all(rows.map(decodePatient));
  },
  /**
   * Exact-name lookup through the HMAC index. Used before registering a case
   * so an ANM can see that the woman is already in this facility's cohort
   * without decrypting every row.
   */
  async findByExactName(facilityId: string, name: string): Promise<LocalPatient[]> {
    assertLocalDataUsable();
    if (!hasDataKey()) {
      const rows = await db.patients.where("facilityId").equals(facilityId).toArray();
      const needle = normaliseName(name);
      return rows.filter((row) => normaliseName(row.name) === needle);
    }
    const index = await blindIndex(`${facilityId}|${normaliseName(name)}`);
    const rows = await db.patients.where("nameIndex").equals(index).toArray();
    return Promise.all(rows.map(decodePatient));
  },
  async upsert(patient: LocalPatient): Promise<void> {
    assertLocalDataUsable();
    await db.patients.put(await encodePatient(patient));
  },
  async remove(id: string): Promise<void> {
    await db.patients.delete(id);
  },
  async pendingCount(): Promise<number> {
    return db.patients.where("syncStatus").equals("pending").count();
  },
};

export const visitRepo = {
  async get(id: string): Promise<LocalVisit | undefined> {
    assertLocalDataUsable();
    const row = await db.visits.get(id);
    return row ? decodeVisit(row) : undefined;
  },
  async list(): Promise<LocalVisit[]> {
    assertLocalDataUsable();
    const rows = await db.visits.toArray();
    return Promise.all(rows.map(decodeVisit));
  },
  async byPatient(patientId: string): Promise<LocalVisit[]> {
    assertLocalDataUsable();
    const rows = await db.visits.where("patientId").equals(patientId).toArray();
    return Promise.all(rows.map(decodeVisit));
  },
  async upsert(visit: LocalVisit): Promise<void> {
    assertLocalDataUsable();
    await db.visits.put(await encodeVisit(visit));
  },
  async pendingCount(): Promise<number> {
    return db.visits.where("syncStatus").equals("pending").count();
  },
};

export const followUpRepo = {
  async get(id: string): Promise<LocalFollowUp | undefined> {
    assertLocalDataUsable();
    const row = await db.followUps.get(id);
    return row ? decodeFollowUp(row) : undefined;
  },
  async list(): Promise<LocalFollowUp[]> {
    assertLocalDataUsable();
    const rows = await db.followUps.toArray();
    return Promise.all(rows.map(decodeFollowUp));
  },
  async byPatient(patientId: string): Promise<LocalFollowUp[]> {
    assertLocalDataUsable();
    const rows = await db.followUps.where("patientId").equals(patientId).toArray();
    return Promise.all(rows.map(decodeFollowUp));
  },
  async listPending(): Promise<LocalFollowUp[]> {
    assertLocalDataUsable();
    const rows = await db.followUps.where("status").equals("PENDING").toArray();
    return Promise.all(rows.map(decodeFollowUp));
  },
  async upsert(followUp: LocalFollowUp): Promise<void> {
    assertLocalDataUsable();
    await db.followUps.put(await encodeFollowUp(followUp));
  },
  async pendingCount(): Promise<number> {
    return db.followUps.where("syncStatus").equals("pending").count();
  },
};

export const opRepo = {
  async enqueue(op: Omit<PendingOp, "seq">): Promise<number> {
    assertLocalDataUsable();
    const payload = hasDataKey() ? await encryptJson(op.payload) : op.payload;
    return (await db.pendingOps.add({ ...op, payload } as PendingOp)) as number;
  },
  async list(): Promise<PendingOp[]> {
    assertLocalDataUsable();
    const rows = await db.pendingOps.orderBy("seq").toArray();
    return Promise.all(
      rows.map(async (row) => ({ ...row, payload: await decryptJson(row.payload) }))
    );
  },
  async remove(seq: number): Promise<void> {
    await db.pendingOps.delete(seq);
  },
  async markFailed(seq: number, error: string, nextAttemptAt: number): Promise<void> {
    const op = await db.pendingOps.get(seq);
    const attempts = (op?.attempts ?? 0) + 1;
    await db.pendingOps.update(seq, { lastError: error, nextAttemptAt, attempts });
  },
  async count(): Promise<number> {
    return db.pendingOps.count();
  },
};

export const conflictRepo = {
  async add(conflict: Omit<ConflictRecord, "id">): Promise<void> {
    assertLocalDataUsable();
    if (!hasDataKey()) {
      await db.conflicts.add(conflict as ConflictRecord);
      return;
    }
    await db.conflicts.add({
      ...conflict,
      serverVersion: await encryptJson(conflict.serverVersion),
      clientVersion: await encryptJson(conflict.clientVersion),
    } as ConflictRecord);
  },
  async list(): Promise<ConflictRecord[]> {
    assertLocalDataUsable();
    const rows = await db.conflicts.toArray();
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        serverVersion: await decryptJson(row.serverVersion),
        clientVersion: await decryptJson(row.clientVersion),
      }))
    );
  },
  async count(): Promise<number> {
    return db.conflicts.count();
  },
};

export const metaRepo = {
  async get(key: string): Promise<string | null> {
    const row = await db.meta.get(key);
    return row?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    await db.meta.put({ key, value });
  },
};

/**
 * Rewrite rows written before field encryption (or before the PIN was set)
 * under the current data key. Safe to call on every unlock: each table is
 * checked and only plaintext rows are rewritten.
 */
export async function migrateLocalData(): Promise<void> {
  if (!hasDataKey()) return;

  const patients = await db.patients.toArray();
  for (const row of patients) {
    if (isEncryptedValue(row.name)) continue;
    await patientRepo.upsert(await decodePatient(row));
  }

  const visits = await db.visits.toArray();
  for (const row of visits) {
    if (row.notes === null || isEncryptedValue(row.notes)) continue;
    await visitRepo.upsert(await decodeVisit(row));
  }

  const followUps = await db.followUps.toArray();
  for (const row of followUps) {
    if (row.notes === null || isEncryptedValue(row.notes)) continue;
    await followUpRepo.upsert(await decodeFollowUp(row));
  }

  const ops = await db.pendingOps.toArray();
  for (const op of ops) {
    if (isEncryptedValue(op.payload)) continue;
    await db.pendingOps.put({ ...op, payload: await encryptJson(op.payload) });
  }

  const conflicts = await db.conflicts.toArray();
  for (const conflict of conflicts) {
    if (isEncryptedValue(conflict.serverVersion)) continue;
    await db.conflicts.put({
      ...conflict,
      serverVersion: await encryptJson(conflict.serverVersion),
      clientVersion: await encryptJson(conflict.clientVersion),
    });
  }
}

export async function clearAllLocalData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.patients, db.visits, db.followUps, db.pendingOps, db.conflicts, db.meta],
    async () => {
      await db.patients.clear();
      await db.visits.clear();
      await db.followUps.clear();
      await db.pendingOps.clear();
      await db.conflicts.clear();
      await db.meta.clear();
    }
  );
}
