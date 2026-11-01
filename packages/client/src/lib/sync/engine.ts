import { useEffect, useState } from "react";
import { pullCohort } from "./pull";
import { type SyncStatusSummary, drain, onSyncStatus } from "./queue";

/**
 * One place that knows how the device is doing: how many records are waiting,
 * whether a conflict needs a human, and when the last successful exchange
 * happened. Screens subscribe here instead of querying Dexie themselves.
 */
export function useSyncStatus(): SyncStatusSummary | null {
  const [status, setStatus] = useState<SyncStatusSummary | null>(null);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

/**
 * Manual "send now".
 *
 * Push first, then pull: the queue holds edits the server has not accepted yet,
 * and pulling first would briefly show the older server copy winning.
 */
export async function syncNow(): Promise<void> {
  await drain();
  await pullCohort();
}
