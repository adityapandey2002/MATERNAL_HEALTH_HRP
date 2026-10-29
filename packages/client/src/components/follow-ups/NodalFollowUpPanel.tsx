import {
  HRP_FOLLOW_UP_STATUSES,
  HRP_FOLLOW_UP_TRACKS,
  type HrpFollowUpStatus,
  type HrpFollowUpTrack,
  getHrpComplicationLabel,
  getHrpStatusBadge,
  getHrpStatusLabel,
  getHrpTrackLabel,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import {
  type FollowUpRow,
  attributionLabel,
  buildFollowUpLineList,
  formatShortDate,
  summariseFollowUps,
} from "../../lib/hrp";
import { EmptyState } from "../ui/EmptyState";
import { SearchIcon } from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";
import { Panel, PanelHeader } from "../ui/Panel";
import { SegmentedControl } from "../ui/SegmentedControl";
import { StatTile } from "../ui/Stat";

type StatusFilter = HrpFollowUpStatus | "ALL";
type TrackFilter = HrpFollowUpTrack | "ALL";

interface UpdateStatusVariables {
  followUpId: string;
  status: HrpFollowUpStatus;
}

/**
 * Block and district shared line list.
 *
 * Every woman is one row, regardless of who owns the contact, so the block can
 * see the whole cohort in one place. The status dropdown writes straight to the
 * follow-up record, which stamps the acting user as the completer and leaves an
 * audit trail on the row.
 */
export default function NodalFollowUpPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("ALL");
  const [villageFilter, setVillageFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError,
  } = useQuery({
    queryKey: ["hrp", "follow-ups", "nodal-panel"],
    queryFn: () => api.hrp.followUps.list({ page: 1, limit: 100 }),
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "follow-ups"],
    queryFn: () => api.hrp.patients.list({ page: 1, limit: 100 }),
  });

  const records = recordsData?.data ?? [];
  const patients = patientsData?.data ?? [];
  const rows = buildFollowUpLineList(patients, records);
  const summary = summariseFollowUps(rows);

  const villages = useMemo(
    () =>
      [
        ...new Set(
          rows.map((row) => row.village).filter((value): value is string => Boolean(value))
        ),
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((village) => ({ value: village, label: village })),
    [rows]
  );

  const visible = rows.filter((row) => {
    if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
    if (trackFilter !== "ALL" && row.track !== trackFilter) return false;
    if (villageFilter !== "ALL" && row.village !== villageFilter) return false;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      const matches =
        row.patientName.toLowerCase().includes(term) ||
        (row.village ?? "").toLowerCase().includes(term) ||
        (row.phone ?? "").includes(term);
      if (!matches) return false;
    }
    return true;
  });

  const loading = recordsLoading || patientsLoading;

  const statusMutation = useMutation({
    mutationFn: ({ followUpId, status }: UpdateStatusVariables) =>
      api.hrp.followUps.update(followUpId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hrp", "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  const setStatus = (row: FollowUpRow, status: HrpFollowUpStatus) => {
    if (!row.followUpId) return;
    statusMutation.mutate({ followUpId: row.followUpId, status });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Oversight"
        title="Follow-up to be done"
        description="The shared block line list, with attribution for every contact"
        actions={
          <Link to="/" className="btn btn-secondary">
            Back to dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile label="In the line list" value={summary.total} hint="Women with a contact" />
        <StatTile
          label="Pending"
          value={summary.pending}
          hint={summary.breached > 0 ? `${summary.breached} past the window` : "Inside the window"}
          tone={summary.breached > 0 ? "red" : "amber"}
        />
        <StatTile
          label="Complete"
          value={summary.complete}
          hint="Closed with attribution"
          tone="green"
        />
        <StatTile
          label="Compliance"
          value={`${summary.complianceRate}%`}
          hint="Complete ÷ line list"
          tone="primary"
          compact
        />
      </div>

      {statusMutation.isError ? (
        <div
          className="rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-triage-red">
            Could not save that status change. The audit entry was not written.
          </p>
        </div>
      ) : null}

      <Panel aria-labelledby="line-list-heading">
        <PanelHeader
          id="line-list-heading"
          title="All women"
          description={`${visible.length} of ${rows.length} rows match the filters`}
          action={
            <SegmentedControl
              label="Filter by follow-up status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All", count: summary.total },
                { value: "PENDING", label: "Pending", count: summary.pending },
                { value: "COMPLETE", label: "Complete", count: summary.complete },
                {
                  value: "NOT_REACHABLE",
                  label: "Not reachable",
                  count: summary.notReachable,
                },
              ]}
            />
          }
        />

        <div className="flex flex-col gap-2 border-b border-line-soft bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search women by name, village or phone</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              className="input min-h-control pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, village or phone"
            />
          </label>
          <select
            className="input min-h-control w-full py-1.5 sm:w-auto"
            aria-label="Filter by track"
            value={trackFilter}
            onChange={(event) => setTrackFilter(event.target.value as TrackFilter)}
          >
            <option value="ALL">All tracks</option>
            {HRP_FOLLOW_UP_TRACKS.map((track) => (
              <option key={track.value} value={track.value}>
                {track.shortLabel} — {track.label}
              </option>
            ))}
          </select>
          <select
            className="input min-h-control w-full py-1.5 sm:w-auto"
            aria-label="Filter by village or sub-center"
            value={villageFilter}
            onChange={(event) => setVillageFilter(event.target.value)}
          >
            <option value="ALL">All villages</option>
            {villages.map((village) => (
              <option key={village.value} value={village.value}>
                {village.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading line list">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Line list could not load"
            description="The block register is unavailable. It will reappear when the server responds."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No follow-ups match these filters"
            description="Clear the status, track or village filter to see the rest of the block."
          />
        ) : (
          <>
            <ul className="divide-y divide-line-soft xl:hidden">
              {visible.map((row) => (
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
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-muted">
                        {getHrpTrackLabel(row.track)} · due {formatShortDate(row.scheduledDate)}
                      </p>
                    </div>
                    <span className={`badge shrink-0 ${getHrpStatusBadge(row.status)}`}>
                      {getHrpStatusLabel(row.status)}
                    </span>
                  </div>
                  {row.complication ? (
                    <p className="mt-1 text-2xs font-medium text-triage-red">
                      {getHrpComplicationLabel(row.complication)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-2xs text-ink-subtle">{attributionLabel(row)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="flex-1">
                      <span className="sr-only">Status for {row.patientName}</span>
                      <select
                        className="input min-h-control py-1.5"
                        value={row.status}
                        disabled={!row.followUpId || statusMutation.isPending}
                        onChange={(event) =>
                          setStatus(row, event.target.value as HrpFollowUpStatus)
                        }
                      >
                        {HRP_FOLLOW_UP_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Link
                      to={`/patients/${row.patientId}`}
                      className="btn btn-secondary btn-sm"
                      aria-label={`Open record for ${row.patientName}`}
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="table-container hidden xl:block">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Woman</th>
                    <th scope="col">Village / sub-center</th>
                    <th scope="col">Track</th>
                    <th scope="col">Attribution</th>
                    <th scope="col">Due</th>
                    <th scope="col">Last update</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <Link
                          to={`/patients/${row.patientId}`}
                          className="font-medium text-ink hover:text-primary hover:underline"
                        >
                          {row.patientName}
                        </Link>
                        <p className="tnum text-2xs text-ink-subtle">{row.age} yrs</p>
                      </td>
                      <td className="text-ink-muted">{row.village ?? "—"}</td>
                      <td className="text-ink-muted">{getHrpTrackLabel(row.track)}</td>
                      <td className="max-w-64 text-2xs text-ink-muted">{attributionLabel(row)}</td>
                      <td className="tnum whitespace-nowrap text-ink-muted">
                        {format(row.scheduledDate, "d MMM yyyy")}
                      </td>
                      <td className="tnum whitespace-nowrap text-2xs text-ink-subtle">
                        {row.lastAttemptAt ? format(row.lastAttemptAt, "d MMM, HH:mm") : "—"}
                      </td>
                      <td>
                        <select
                          className="input min-h-control w-auto py-1.5"
                          aria-label={`Follow-up status for ${row.patientName}`}
                          value={row.status}
                          disabled={!row.followUpId || statusMutation.isPending}
                          onChange={(event) =>
                            setStatus(row, event.target.value as HrpFollowUpStatus)
                          }
                        >
                          {HRP_FOLLOW_UP_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
