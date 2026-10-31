import { getHrpTrackShortLabel } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
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
  attributionLabel,
  buildFollowUpLineList,
  formatShortDate,
  isEscalated,
  summariseFollowUps,
} from "../lib/hrp";
import { canProvisionStaff } from "../lib/nav";
import { useUserRole } from "../lib/session";
import { onOnlineChange } from "../utils/sw";

interface BlockRollup {
  block: string;
  total: number;
  pending: number;
  complete: number;
  escalated: number;
  complianceRate: number;
}

/**
 * Group the district line list by block.
 *
 * The line list is one row per woman, so a block roll-up is a straight fold.
 * Rows with no block (a facility whose block column is blank) are kept under a
 * named bucket instead of being dropped from the district total.
 */
function rollUpByBlock(rows: FollowUpRow[]): BlockRollup[] {
  const buckets = new Map<string, FollowUpRow[]>();

  for (const row of rows) {
    const block = row.blockName ?? "Block not recorded";
    const bucket = buckets.get(block);
    if (bucket) bucket.push(row);
    else buckets.set(block, [row]);
  }

  return [...buckets.entries()]
    .map(([block, blockRows]) => {
      const complete = blockRows.filter((row) => row.status === "COMPLETE").length;
      return {
        block,
        total: blockRows.length,
        pending: blockRows.filter((row) => row.status === "PENDING").length,
        complete,
        escalated: blockRows.filter((row) => isEscalated(row)).length,
        complianceRate:
          blockRows.length === 0 ? 0 : Math.round((complete / blockRows.length) * 100),
      };
    })
    .sort((a, b) => a.block.localeCompare(b.block));
}

/**
 * District dashboard for the DHS and the District HRP Helpdesk.
 *
 * Everything on this page is a roll-up of the same 15-day line list the block
 * works. The escalation queue is derived from `PENDING`/`NOT_REACHABLE` rows
 * whose due date has passed, so a lapsed first block window shows up here
 * without any stored flag.
 */
export default function DistrictDashboard() {
  const role = useUserRole();
  const canManageTeam = canProvisionStaff(role);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError,
  } = useQuery({
    queryKey: ["hrp", "follow-ups", "district-dashboard"],
    queryFn: () => api.hrp.followUps.list({ page: 1, limit: 100 }),
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["hrp", "patients", "district-dashboard"],
    queryFn: () => api.hrp.patients.list({ page: 1, limit: 100 }),
  });

  const records = recordsData?.data ?? [];
  const patients = patientsData?.data ?? [];
  const rows = buildFollowUpLineList(patients, records);
  const summary = summariseFollowUps(rows);
  const loading = recordsLoading || patientsLoading;

  const totalHrps = patientsData?.total ?? patients.length;
  const blocks = useMemo(() => rollUpByBlock(rows), [rows]);
  const escalations = useMemo(
    () =>
      rows
        .filter((row) => isEscalated(row))
        .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()),
    [rows]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${format(new Date(), "EEEE d MMMM")} · Araria district`}
        title="District dashboard"
        description="Block-wide HRP coverage, the 15-day cycle and every escalated woman"
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
              {online
                ? "District roll-up · live"
                : "Offline · showing the last synced district data"}
            </p>
            <p className="text-2xs text-ink-subtle">
              {online
                ? "Block submissions and field updates roll into this view automatically."
                : "Reconnect to refresh every block before acting on an escalation."}
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
            The district line list could not load. Counters below may be incomplete.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <StatTile
          label="Total HRPs"
          value={loading ? "…" : totalHrps}
          hint="Registered in the district"
          icon={<UsersIcon className="h-4 w-4" />}
          tone="primary"
        />
        <StatTile
          label="Escalated"
          value={loading ? "…" : summary.escalated}
          hint="Open past the due date"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
          tone={summary.escalated > 0 ? "red" : "green"}
        />
        <StatTile
          label="Block review"
          value={loading ? "…" : summary.awaitingBlockReview}
          hint="First cycle with a block helpdesk"
          icon={<ListChecksIcon className="h-4 w-4" />}
          tone="amber"
        />
        <StatTile
          label="Field pending"
          value={loading ? "…" : summary.byStage.FIELD_15_DAY.pending}
          hint={summary.breached > 0 ? `${summary.breached} past the window` : "Inside the window"}
          icon={<CalendarIcon className="h-4 w-4" />}
          tone={summary.breached > 0 ? "red" : "amber"}
        />
        <StatTile
          label="Compliance"
          value={`${summary.complianceRate}%`}
          hint="Complete ÷ district line list"
          icon={<CheckIcon className="h-4 w-4" />}
          tone="green"
          compact
        />
      </div>

      <Panel aria-labelledby="block-rollup-heading">
        <PanelHeader
          id="block-rollup-heading"
          title="Block-wise coverage"
          description="Every block's 15-day cycle, with escalations called out"
          action={
            <span className="badge badge-gray">
              {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
            </span>
          }
        />

        {loading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading blocks">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : blocks.length === 0 ? (
          <EmptyState
            title="No blocks reporting yet"
            description="Block dashboards populate this table as soon as a woman is registered as an HRP."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Block</th>
                  <th scope="col">HRPs</th>
                  <th scope="col">Pending</th>
                  <th scope="col">Complete</th>
                  <th scope="col">Escalated</th>
                  <th scope="col">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.block}>
                    <td className="font-medium text-ink">{block.block}</td>
                    <td className="tnum text-ink-muted">{block.total}</td>
                    <td className="tnum text-ink-muted">{block.pending}</td>
                    <td className="tnum text-ink-muted">{block.complete}</td>
                    <td className="tnum">
                      {block.escalated > 0 ? (
                        <span className="badge badge-red">{block.escalated}</span>
                      ) : (
                        <span className="text-ink-subtle">0</span>
                      )}
                    </td>
                    <td className="tnum text-ink-muted">{block.complianceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel aria-labelledby="escalation-heading">
        <PanelHeader
          id="escalation-heading"
          title={
            <span className="flex items-center gap-2">
              Escalation queue
              <span className={`badge ${escalations.length > 0 ? "badge-red" : "badge-gray"}`}>
                {escalations.length}
              </span>
            </span>
          }
          description="Open cycles whose due date has passed. The district follows up with the owning tier."
          action={
            <Link
              to="/follow-ups"
              className="hidden text-2xs font-semibold uppercase tracking-wide text-primary hover:underline sm:block"
            >
              Open line list
            </Link>
          }
        />

        {loading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading escalations">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <EmptyState
            title="No escalation right now"
            description="Every open 15-day cycle is still inside its window."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {escalations.map((row) => (
              <li key={row.key} className="px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/patients/${row.patientId}`}
                      className="block truncate text-sm font-semibold text-ink hover:text-primary hover:underline"
                    >
                      {row.patientName}
                    </Link>
                    <p className="tnum mt-0.5 text-2xs text-ink-subtle">
                      {row.age} yrs · {row.village ?? "Village not recorded"}
                      {row.blockName ? ` · ${row.blockName}` : ""}
                    </p>
                    <p className="mt-0.5 text-2xs text-ink-muted">
                      {getHrpTrackShortLabel(row.track)} · due {formatShortDate(row.scheduledDate)}{" "}
                      · {attributionLabel(row)}
                    </p>
                  </div>
                  <Link
                    to={`/patients/${row.patientId}`}
                    className="btn btn-secondary btn-sm shrink-0"
                    aria-label={`Open record for ${row.patientName}`}
                  >
                    Open
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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
              Create BHM and district HRP Helpdesk accounts
            </span>
          </span>
          <ArrowRightIcon className="h-4 w-4 text-ink-subtle" />
        </Link>
      ) : null}
    </div>
  );
}
