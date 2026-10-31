import { HRP_FOLLOW_UP_TRACKS, getHrpTrackShortLabel } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ListChecksIcon,
  SyncIcon,
  UsersIcon,
} from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { StatTile } from "../components/ui/Stat";
import { api } from "../lib/api";
import {
  type FollowUpRow,
  type FollowUpSummary,
  buildFollowUpLineList,
  formatShortDate,
  summariseFollowUps,
} from "../lib/hrp";
import { canProvisionStaff, isBlockRole } from "../lib/nav";
import { useUserRole } from "../lib/session";
import { onOnlineChange } from "../utils/sw";

function lastSyncLabel(): string | null {
  const raw = localStorage.getItem("lastSyncTime");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return format(new Date(value), "d MMM, HH:mm");
}

/**
 * Stage breakdown for the repeating 15-day cycle.
 *
 * A referred woman's first window belongs to the block helpdesk; every later
 * window belongs to the field team but stays visible here. Showing both stages
 * side by side is what makes "whose turn is it" obvious at a glance.
 */
function StageBreakdown({ summary }: { summary: FollowUpSummary }) {
  return (
    <section aria-labelledby="stage-breakdown-heading">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2
            id="stage-breakdown-heading"
            className="text-base font-semibold tracking-tight text-ink"
          >
            The 15-day cycle
          </h2>
          <p className="text-xs text-ink-subtle">
            Where the block's contacts sit across the block review and field stages
          </p>
        </div>
        <Link
          to="/follow-ups"
          className="hidden text-2xs font-semibold uppercase tracking-wide text-primary hover:underline sm:block"
        >
          Review rows
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {HRP_FOLLOW_UP_TRACKS.map((option) => {
          const counters = summary.byStage[option.value];
          const completion =
            counters.total === 0 ? 0 : Math.round((counters.complete / counters.total) * 100);

          return (
            <Panel key={option.value}>
              <PanelBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-primary">
                      {getHrpTrackShortLabel(option.value)}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-ink">{option.label}</h3>
                  </div>
                  <span className="tnum text-2xl font-semibold text-ink">{counters.total}</span>
                </div>
                <p className="text-xs leading-relaxed text-ink-subtle">{option.description}</p>

                <div
                  className="h-1.5 overflow-hidden rounded-full bg-line-soft"
                  role="img"
                  aria-label={`${completion}% of the ${option.shortLabel} stage complete`}
                >
                  <span
                    className="block h-full rounded-full bg-triage-green-solid"
                    style={{ width: `${completion}%` }}
                  />
                </div>

                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-triage-amber-bg px-2 py-1.5">
                    <dt className="text-2xs font-medium text-ink-subtle">Pending</dt>
                    <dd className="tnum text-sm font-semibold text-triage-amber">
                      {counters.pending}
                    </dd>
                  </div>
                  <div className="rounded bg-triage-green-bg px-2 py-1.5">
                    <dt className="text-2xs font-medium text-ink-subtle">Complete</dt>
                    <dd className="tnum text-sm font-semibold text-triage-green">
                      {counters.complete}
                    </dd>
                  </div>
                  <div className="rounded bg-canvas px-2 py-1.5">
                    <dt className="text-2xs font-medium text-ink-subtle">No contact</dt>
                    <dd className="tnum text-sm font-semibold text-ink-muted">
                      {counters.notReachable}
                    </dd>
                  </div>
                </dl>
              </PanelBody>
            </Panel>
          );
        })}
      </div>
    </section>
  );
}

interface DispatchBoxProps {
  canDispatch: boolean;
  pendingRows: FollowUpRow[];
  assignable: Array<{ id: string; name: string; role: string; facilityName?: string | null }>;
}

function DispatchBox({ canDispatch, pendingRows, assignable }: DispatchBoxProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");

  const allPendingSelected =
    pendingRows.length > 0 && pendingRows.every((row) => selected.has(row.patientId));

  const toggleSelected = (patientId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allPendingSelected ? new Set() : new Set(pendingRows.map((row) => row.patientId)));
  };

  const dispatchMutation = useMutation({
    mutationFn: () =>
      api.hrp.followUps.dispatch({
        patientIds: [...selected],
        assignedToUserId: assigneeId,
      }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["hrp", "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  const dispatchDisabled =
    !canDispatch || selected.size === 0 || !assigneeId || dispatchMutation.isPending;

  return (
    <Panel aria-labelledby="dispatch-heading">
      <PanelHeader
        id="dispatch-heading"
        title="Push AWC / ANM dispatch box"
        description="Select pending women, choose a field worker and start their next 15-day window"
        action={<span className="badge badge-info">{selected.size} selected</span>}
      />

      {!canDispatch ? (
        <PanelBody>
          <p className="text-sm text-ink-muted">
            Only the block dashboard can push lists to field workers. Open the shared line list to
            close contacts.
          </p>
        </PanelBody>
      ) : dispatchMutation.isSuccess ? (
        <PanelBody className="space-y-3">
          <div className="flex items-start gap-2.5 rounded border border-triage-green-line bg-triage-green-bg px-3 py-2.5">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-triage-green" />
            <p className="text-sm text-ink">
              List pushed. The selected women now have a 15-day field follow-up in the worker's
              panel.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => dispatchMutation.reset()}
          >
            Push another list
          </button>
        </PanelBody>
      ) : pendingRows.length === 0 ? (
        <EmptyState
          title="Nothing pending to dispatch"
          description="Every woman on the line list has a closed contact. New HRP registrations appear here."
        />
      ) : (
        <PanelBody className="space-y-4">
          <label className="block space-y-1.5">
            <span className="label">Assign to ANM / CHO</span>
            <select
              className="input"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Select a field worker</option>
              {assignable.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                  {member.facilityName ? ` · ${member.facilityName}` : ""}
                </option>
              ))}
            </select>
          </label>

          <p className="rounded border border-line-soft bg-canvas px-3 py-2 text-xs text-ink-muted">
            Every dispatch starts a 15-day field window. The block helpdesk keeps seeing the same
            row and can close it too.
          </p>

          {assignable.length === 0 ? (
            <p className="rounded border border-triage-amber-line bg-triage-amber-bg px-3 py-2 text-xs text-ink-muted">
              No active ANM or CHO account is in this block yet.
            </p>
          ) : null}

          <div className="rounded border border-line">
            <div className="flex items-center justify-between gap-3 border-b border-line-soft bg-canvas px-3 py-2">
              <p className="text-xs font-semibold text-ink">Pending women</p>
              <button
                type="button"
                className="text-2xs font-semibold uppercase tracking-wide text-primary hover:underline"
                onClick={toggleAll}
              >
                {allPendingSelected ? "Clear all" : "Select all pending"}
              </button>
            </div>
            <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto">
              {pendingRows.map((row) => (
                <li key={row.key}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-canvas">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line-strong text-primary focus:ring-primary-ring"
                      checked={selected.has(row.patientId)}
                      onChange={() => toggleSelected(row.patientId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {row.patientName}
                      </span>
                      <span className="tnum block truncate text-2xs text-ink-subtle">
                        {row.village ?? "Village not recorded"} · {getHrpTrackShortLabel(row.track)}{" "}
                        · due {formatShortDate(row.scheduledDate)}
                      </span>
                    </span>
                    {row.status === "NOT_REACHABLE" ? (
                      <span className="badge badge-gray">Not reachable</span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {dispatchMutation.isError ? (
            <p
              className="rounded border border-triage-red-line bg-triage-red-bg px-3 py-2 text-sm text-triage-red"
              role="alert"
            >
              The list could not be pushed. Check the field worker and try again.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-2xs text-ink-subtle">
              <AlertTriangleIcon className="h-3.5 w-3.5" />
              Dispatch moves each selected woman to a new 15-day field cycle.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={dispatchDisabled}
              onClick={() => dispatchMutation.mutate()}
            >
              <ArrowRightIcon className="h-4 w-4" />
              {dispatchMutation.isPending ? "Pushing…" : "Push list to field"}
            </button>
          </div>
        </PanelBody>
      )}
    </Panel>
  );
}

/**
 * Block dashboard for the BHM and the Block HRP Helpdesk.
 *
 * Counters, the stage breakdown and the dispatch box all read from the same
 * line list, so the tiles and the table can never disagree. District roles get
 * `DistrictDashboard` instead.
 */
export default function NodalDashboard() {
  const role = useUserRole();
  const canDispatch = isBlockRole(role);
  const canManageTeam = canProvisionStaff(role);
  const [online, setOnline] = useState(true);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setSyncedAt(lastSyncLabel());
    return onOnlineChange(setOnline);
  }, []);

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError,
  } = useQuery({
    queryKey: ["hrp", "follow-ups", "dashboard"],
    queryFn: () => api.hrp.followUps.list({ page: 1, limit: 100 }),
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["hrp", "patients", "dashboard"],
    queryFn: () => api.hrp.patients.list({ page: 1, limit: 100 }),
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff", "assignable"],
    queryFn: () => api.staff.list(),
    enabled: canDispatch,
    retry: false,
  });

  const records = recordsData?.data ?? [];
  const patients = patientsData?.data ?? [];
  const rows = buildFollowUpLineList(patients, records);
  const summary = summariseFollowUps(rows);

  const totalHrps = patientsData?.total ?? patients.length;
  const pendingRows = rows.filter((row) => row.status !== "COMPLETE");
  const assignable = (staffData?.data ?? []).filter(
    (member) => member.isActive && (member.role === "ANM" || member.role === "CHO")
  );

  const loading = recordsLoading || patientsLoading;
  const fieldPending = summary.byStage.FIELD_15_DAY.pending;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${format(new Date(), "EEEE d MMMM")} · Araria block`}
        title="Block dashboard"
        description="High-risk pregnancies, the 15-day cycle and dispatch in one view"
        actions={
          <Link to="/follow-ups" className="btn btn-primary">
            <ListChecksIcon className="h-4 w-4" />
            Open line list
          </Link>
        }
      />

      <Panel className={online ? "bg-surface" : "border-triage-amber-line bg-triage-amber-bg"}>
        <PanelBody className="flex flex-wrap items-center gap-3 py-3">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${
              online ? "bg-triage-green-solid" : "bg-triage-amber-solid"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {online ? "Live sync · normal" : "Offline · showing the last synced block data"}
            </p>
            <p className="text-2xs text-ink-subtle">
              {syncedAt
                ? `Last field sync ${syncedAt}. The line list refreshes automatically.`
                : "No field sync recorded on this device yet."}
            </p>
          </div>
          <span className={`badge ${online ? "badge-green" : "badge-amber"}`}>
            <SyncIcon className="h-3 w-3" />
            {online ? "Live" : "Offline"}
          </span>
        </PanelBody>
      </Panel>

      {isError ? (
        <div
          className="rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-triage-red">
            The block line list could not load. Counters below may be incomplete.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <StatTile
          label="Total HRPs"
          value={loading ? "…" : totalHrps}
          hint="Registered in the block"
          icon={<UsersIcon className="h-4 w-4" />}
          tone="primary"
        />
        <StatTile
          label="Block review"
          value={loading ? "…" : summary.awaitingBlockReview}
          hint="First cycle with the helpdesk"
          icon={<ListChecksIcon className="h-4 w-4" />}
          tone="amber"
        />
        <StatTile
          label="Field pending"
          value={loading ? "…" : fieldPending}
          hint={summary.breached > 0 ? `${summary.breached} past the window` : "Inside the window"}
          icon={<CalendarIcon className="h-4 w-4" />}
          tone={summary.breached > 0 ? "red" : "amber"}
        />
        <StatTile
          label="Escalated"
          value={loading ? "…" : summary.escalated}
          hint="Open past the due date"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
          tone={summary.escalated > 0 ? "red" : "green"}
        />
        <StatTile
          label="Compliance"
          value={`${summary.complianceRate}%`}
          hint="Complete ÷ line list"
          icon={<CheckIcon className="h-4 w-4" />}
          tone="green"
          compact
        />
      </div>

      <StageBreakdown summary={summary} />

      <DispatchBox canDispatch={canDispatch} pendingRows={pendingRows} assignable={assignable} />

      {canManageTeam ? (
        <Link
          to="/team"
          className="panel flex items-center gap-3 p-3 transition-colors hover:bg-canvas sm:p-4"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded bg-primary-light text-primary-dark"
          >
            <ActivityIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Team &amp; access</span>
            <span className="block text-2xs text-ink-subtle">
              Create ANM, CHO and block HRP Helpdesk accounts
            </span>
          </span>
          <ArrowRightIcon className="h-4 w-4 text-ink-subtle" />
        </Link>
      ) : null}
    </div>
  );
}
