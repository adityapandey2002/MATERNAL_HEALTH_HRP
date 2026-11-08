import { api } from "../api";
import { canUseLocalData } from "../crypto";
import type { PendingOp } from "../db/local-db";
import {
  conflictRepo,
  followUpRepo,
  metaRepo,
  opRepo,
  patientRepo,
  visitRepo,
} from "../db/repositories";
import { hasAccessToken } from "../token-store";

export type SyncStatusSummary = {
  pending: number;
  conflicts: number;
  lastSync: string | null;
  lastError: string | null;
  online: boolean;
};

let draining = false;
let lastError: string | null = null;
const listeners = new Set<(s: SyncStatusSummary) => void>();

/** A rejected row waits this long before the next attempt. */
const REJECTED_RETRY_MS = 5 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

async function summary(): Promise<SyncStatusSummary> {
  return {
    pending: await opRepo.count(),
    conflicts: await conflictRepo.count(),
    lastSync: await metaRepo.get("lastSyncAt"),
    lastError,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  };
}

async function notify(): Promise<void> {
  const s = await summary();
  for (const cb of listeners) cb(s);
}

export function onSyncStatus(cb: (s: SyncStatusSummary) => void): () => void {
  listeners.add(cb);
  void notify();
  return () => {
    listeners.delete(cb);
  };
}

export async function enqueueOp(
  op: Omit<PendingOp, "seq" | "attempts" | "lastError" | "nextAttemptAt" | "createdAt"> & {
    payload: unknown;
  }
): Promise<void> {
  await opRepo.enqueue({
    ...op,
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: nowIso(),
  });
  void drain();
  await notify();
}

async function applyServerResponse(res: {
  patients?: unknown[];
  visits?: unknown[];
  followUps?: unknown[];
  serverTimestamp?: string | Date;
  conflicts?: {
    entityType: string;
    entityId: string;
    serverVersion: unknown;
    clientVersion: unknown;
  }[];
}): Promise<void> {
  // Upsert returned (authoritative) entities into the local store as synced.
  for (const p of res.patients ?? []) {
    const row = p as Record<string, unknown>;
    await patientRepo.upsert({ ...row, syncStatus: "synced" } as unknown as never);
  }
  for (const v of res.visits ?? []) {
    const row = v as Record<string, unknown>;
    await visitRepo.upsert({ ...row, syncStatus: "synced" } as unknown as never);
  }
  for (const f of (res.followUps ?? []) as Record<string, unknown>[]) {
    await followUpRepo.upsert({ ...f, syncStatus: "synced" } as unknown as never);
  }

  // Record conflicts and remove their ops; mark the local entity as conflict.
  for (const c of res.conflicts ?? []) {
    await conflictRepo.add({
      entityType: c.entityType,
      entityId: c.entityId,
      serverVersion: c.serverVersion,
      clientVersion: c.clientVersion,
      seenAt: nowIso(),
    });
    const ops = await opRepo.list();
    for (const op of ops) {
      if (op.entityType === c.entityType.toLowerCase() && op.entityId === c.entityId) {
        if (op.seq !== undefined) await opRepo.remove(op.seq);
      }
    }
    if (c.entityType === "PATIENT") {
      const existing = await patientRepo.get(c.entityId);
      if (existing) await patientRepo.upsert({ ...existing, syncStatus: "conflict" });
    } else if (c.entityType === "VISIT") {
      const existing = await visitRepo.get(c.entityId);
      if (existing) await visitRepo.upsert({ ...existing, syncStatus: "conflict" });
    } else if (c.entityType === "FOLLOWUP" || c.entityType === "FOLLOW_UP") {
      const existing = await followUpRepo.get(c.entityId);
      if (existing) await followUpRepo.upsert({ ...existing, syncStatus: "conflict" });
    }
  }

  if (res.serverTimestamp) {
    await metaRepo.set("lastSyncAt", new Date(res.serverTimestamp).toISOString());
  }
}

export async function drain(): Promise<void> {
  if (draining) return;
  // Before sign-in there is nothing to authenticate with; a queued push would
  // only 401. The queue survives and syncs right after the next login.
  if (!hasAccessToken()) return;
  // A locked pilot build has no data key: reading a queued payload would throw
  // and writing it back would leave plaintext. Resume after unlock.
  if (!canUseLocalData()) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    // Retry any ops whose backoff window has passed.
    const ops = await opRepo.list();
    const now = Date.now();
    const ready = ops.filter((o) => (o.nextAttemptAt ?? 0) <= now);
    if (ready.length === 0) {
      await notify();
      return;
    }

    // Group by entity type, cap at 100 per type per request.
    const patients = ready
      .filter((o) => o.entityType === "patient")
      .slice(0, 100)
      .map((o) => o.payload);
    const visits = ready
      .filter((o) => o.entityType === "visit")
      .slice(0, 100)
      .map((o) => o.payload);
    const followUps = ready
      .filter((o) => o.entityType === "followUp")
      .slice(0, 100)
      .map((o) => o.payload);

    const sentOps = ready.filter((o) => {
      if (o.entityType === "patient") return patients.includes(o.payload);
      if (o.entityType === "visit") return visits.includes(o.payload);
      if (o.entityType === "followUp") return followUps.includes(o.payload);
      return false;
    });

    if (patients.length === 0 && visits.length === 0 && followUps.length === 0) {
      await notify();
      return;
    }

    try {
      const res = await api.sync.push({
        patients: patients as never,
        visits: visits as never,
        followUps: followUps as never,
      });
      await applyServerResponse(res as never);

      // The server answers item by item: a conflict keeps the local version,
      // and a rejection means the row was NOT stored (a validation failure, a
      // missing parent record, a permission gap). Dropping a rejected op would
      // leave the change visible only on this phone, forever, with no error —
      // exactly how an ANM's registration went missing at block level. Keep it
      // queued, record why, and show the reason on the device.
      const rejected = res.rejected ?? [];
      const rejectionFor = (op: (typeof sentOps)[number]): string | undefined => {
        const wanted = op.entityType.toUpperCase();
        const match = rejected.find(
          (item) =>
            item.entityType.toUpperCase() === wanted &&
            (item.entityId === undefined || item.entityId === op.entityId)
        );
        return match?.reason;
      };

      const conflictIds = new Set(
        (res.conflicts ?? []).map((c: { entityId: string }) => c.entityId)
      );
      let firstRejection: string | null = null;
      for (const op of sentOps) {
        if (conflictIds.has(op.entityId)) continue;
        const reason = rejectionFor(op);
        if (reason) {
          firstRejection ??= reason;
          if (op.seq !== undefined) {
            await opRepo.markFailed(op.seq, reason, Date.now() + REJECTED_RETRY_MS);
          }
          continue;
        }
        if (op.seq !== undefined) await opRepo.remove(op.seq);
      }
      lastError = firstRejection;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Exponential backoff per op.
      const base = 5_000;
      for (const op of sentOps) {
        if (op.seq === undefined) continue;
        const attempts = (op.attempts ?? 0) + 1;
        const delay = Math.min(base * 2 ** (attempts - 1), 5 * 60 * 1000);
        await opRepo.markFailed(op.seq, lastError, Date.now() + delay);
      }
    }
  } finally {
    draining = false;
    await notify();
    // If more ops remain, schedule another drain.
    const remaining = await opRepo.count();
    if (remaining > 0 && (typeof navigator === "undefined" || navigator.onLine)) {
      setTimeout(() => void drain(), 100);
    }
  }
}

// Triggers
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void drain());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void drain();
  });
}

export async function pendingCount(): Promise<number> {
  return opRepo.count();
}
