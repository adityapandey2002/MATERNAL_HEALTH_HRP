import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api } from "../lib/api";
import { buildFollowUpLineList, isBreached } from "../lib/hrp";
import { isOnline, onOnlineChange } from "../utils/sw";

/**
 * First screen for ANM and CHO.
 *
 * The whole screen is one action: register a case. The only other thing on it
 * is the critical instruction strip at the bottom — an urgent follow-up or a
 * sync prompt — because that is the one message a field worker must not miss.
 */
export default function FieldHome() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);

  const { data } = useQuery({
    queryKey: ["patients", "field-home"],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const patients = data?.data ?? [];
  const rows = buildFollowUpLineList(patients, []);
  const urgent = rows.filter(
    (row) => row.status !== "COMPLETE" && (row.riskLevel === "RED" || isBreached(row))
  );
  const pending = rows.filter((row) => row.status !== "COMPLETE").length;

  const syncMutation = useMutation({
    mutationFn: () => api.sync.push({ patients: [], visits: [], referrals: [] }),
    onSuccess: () => {
      const now = new Date();
      localStorage.setItem("lastSyncTime", String(now.getTime()));
      setSyncedAt(format(now, "HH:mm"));
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col gap-4">
      <header className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-primary">
          {format(new Date(), "EEEE d MMMM")} · Field work
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Register a high-risk pregnancy
        </h1>
      </header>

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
        <span className="max-w-sm text-sm leading-relaxed text-ink-muted">
          Seven fields — name, mobile, age, village, LMP, complication and referral. Takes under a
          minute.
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
                  the 7-day window.
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
                <h2 className="text-sm font-semibold text-ink">
                  {online
                    ? "All follow-ups on track"
                    : "Offline — records are saved on this device"}
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {online
                    ? `${pending} pending contact${pending === 1 ? "" : "s"} in your village list.`
                    : "Sync now so the block helpdesk sees today's work."}
                </p>
              </div>
              {syncedAt ? (
                <span className="badge badge-green">Synced {syncedAt}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="btn btn-secondary btn-sm"
                >
                  <SyncIcon className="h-3.5 w-3.5" />
                  {syncMutation.isPending ? "Syncing…" : "Sync now"}
                </button>
              )}
            </PanelBody>
          </Panel>
        )}
      </section>
    </div>
  );
}
