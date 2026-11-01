import {
  type ConflictRecord,
  type LocalFollowUp,
  type LocalPatient,
  type LocalVisit,
  type MetaRecord,
  type PendingOp,
  db,
} from "./local-db";

export const patientRepo = {
  async get(id: string): Promise<LocalPatient | undefined> {
    return db.patients.get(id);
  },
  async list(): Promise<LocalPatient[]> {
    return db.patients.toArray();
  },
  async upsert(patient: LocalPatient): Promise<void> {
    await db.patients.put(patient);
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
    return db.visits.get(id);
  },
  async byPatient(patientId: string): Promise<LocalVisit[]> {
    return db.visits.where("patientId").equals(patientId).toArray();
  },
  async upsert(visit: LocalVisit): Promise<void> {
    await db.visits.put(visit);
  },
  async pendingCount(): Promise<number> {
    return db.visits.where("syncStatus").equals("pending").count();
  },
};

export const followUpRepo = {
  async get(id: string): Promise<LocalFollowUp | undefined> {
    return db.followUps.get(id);
  },
  async byPatient(patientId: string): Promise<LocalFollowUp[]> {
    return db.followUps.where("patientId").equals(patientId).toArray();
  },
  async listPending(): Promise<LocalFollowUp[]> {
    return db.followUps.where("status").equals("PENDING").toArray();
  },
  async upsert(followUp: LocalFollowUp): Promise<void> {
    await db.followUps.put(followUp);
  },
  async pendingCount(): Promise<number> {
    return db.followUps.where("syncStatus").equals("pending").count();
  },
};

export const opRepo = {
  async enqueue(op: Omit<PendingOp, "seq">): Promise<number> {
    return (await db.pendingOps.add(op as PendingOp)) as number;
  },
  async list(): Promise<PendingOp[]> {
    return db.pendingOps.orderBy("seq").toArray();
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
    await db.conflicts.add(conflict as ConflictRecord);
  },
  async list(): Promise<ConflictRecord[]> {
    return db.conflicts.toArray();
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
