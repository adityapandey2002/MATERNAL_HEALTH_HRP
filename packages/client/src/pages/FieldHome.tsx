import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  SyncIcon,
} from "../components/ui/Icons";
import { Panel, PanelBody } from "../components/ui/Panel";
import { useLocalFollowUpItems, useLocalPatients } from "../lib/db/queries";
import { buildFollowUpLineList, isBreached } from "../lib/hrp";
import { syncNow, useSyncStatus } from "../lib/sync/engine";
import { pullCohort } from "../lib/sync/pull";
import { isOnline, onOnlineChange } from "../utils/sw";

/**
 * One sentence pair for the status strip. Kept out of the JSX so the screen
 * stays readable and the wording lives in one place.
 */
function describeSyncStrip({
  online,
  pendingChanges,
  pendingContacts,
}: {
  online: boolean;
  pendingChanges: number;
  pendingContacts: number;
}): { title: string; detail: string } {
  const pluralChanges = pendingChanges === 1 ? "change" : "changes";
  if (!online) {
    const title = "Offline — records are saved on this device";
    const detail =
      pendingChanges > 0
        ? `${pendingChanges} ${pluralChanges} will sync when the connection returns.`
        : "Everything recorded here stays on this device until the connection returns.";
    return { title, detail };
  }
  if (pendingChanges > 0) {
    return {
      title: `${pendingChanges} ${pluralChanges} waiting to sync`,
      detail: "They will be sent automatically. You can also send them now.",
    };
  }
  return {
    title: "All follow-ups on track",
    detail: `${pendingContacts} pending contact${pendingContacts === 1 ? "" : "s"} in your village list.`,
  };
}

/**
 * First screen for ANM and CHO.
 *
 * The whole screen is one action: register a case. The only other thing on it
 * is the critical instruction strip at the bottom — an urgent follow-up or a
 * sync prompt — because that is the one message a field worker must not miss.
 *
 * Everything is read from the device cache, so the screen and its counts are
 * correct with no connection.
 */
export default function FieldHome() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const patients = useLocalPatients();
  const records = useLocalFollowUpItems();
  const sync = useSyncStatus();

  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || navigator.onLine) void pullCohort();
  }, []);

  const rows = buildFollowUpLineList(patients ?? [], records ?? []);
  const urgent = rows.filter(
    (row) => row.status !== "COMPLETE" && (row.riskLevel === "RED" || isBreached(row))
  );
  const pending = rows.filter((row) => row.status !== "COMPLETE").length;
  const pendingChanges = sync?.pending ?? 0;

  const lastSync = sync?.lastSync ? new Date(sync.lastSync) : null;
  const strip = describeSyncStrip({ online, pendingChanges, pendingContacts: pending });

  const runSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      await syncNow();
      setMessage("Sync finished.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col gap-4">
      <Link
        to="/patients/new"
        className="group flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border-2 border-primary bg-primary-light px-6 py-14 text-center transition-colors hover:bg-primary/10 focus-visible:bg-primary/10"
        aria-label="Add HRP case — open the registration form"
      >
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:scale-105"
        >
          <PlusIcon className="h-10 w-10" />
        </span>
        <span className="text-2xl font-semibold tracking-tight text-primary-dark sm:text-3xl">
          Add HRP case
        </span>
        <span className="btn btn-primary mt-2">
          <PlusIcon className="h-4 w-4" />
          Start registration
        </span>
      </Link>

      <section aria-live="polite" aria-label="Critical instruction">
        {urgent.length > 0 ? (
          <Panel className="border-triage-red-line bg-triage-red-bg">
            <PanelBody className="flex flex-wrap items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface text-triage-red"
              >
                <AlertTriangleIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-triage-red">
                  {urgent.length} {urgent.length === 1 ? "HRP needs" : "HRPs need"} follow-up
                  urgently
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {urgent
                    .slice(0, 2)
                    .map((row) => row.patientName)
                    .join(", ")}
                  {urgent.length > 2 ? ` and ${urgent.length - 2} more` : ""} — red triage or past
                  the 15-day due date.
                </p>
              </div>
              <Link to="/follow-ups" className="btn btn-danger btn-sm">
                Open follow-ups
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </PanelBody>
          </Panel>
        ) : (
          <Panel className={online ? "" : "border-triage-amber-line bg-triage-amber-bg"}>
            <PanelBody className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${
                  online ? "bg-triage-green-bg text-triage-green" : "bg-surface text-triage-amber"
                }`}
              >
                {online ? <CheckIcon className="h-5 w-5" /> : <SyncIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-ink">{strip.title}</h2>
                <p className="mt-0.5 text-xs text-ink-subtle">{strip.detail}</p>
                {message ? (
                  <output className="mt-1 block text-xs text-ink-muted">{message}</output>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {lastSync ? (
                  <span className={online ? "badge badge-green" : "badge badge-amber"}>
                    {online ? "Synced" : "As of"} {format(lastSync, "HH:mm")}
                  </span>
                ) : null}
                {online ? (
                  <button
                    type="button"
                    onClick={() => void runSync()}
                    disabled={syncing}
                    className="btn btn-secondary btn-sm"
                  >
                    <SyncIcon className="h-3.5 w-3.5" />
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                ) : null}
              </div>
            </PanelBody>
          </Panel>
        )}
      </section>
    </div>
  );
}
