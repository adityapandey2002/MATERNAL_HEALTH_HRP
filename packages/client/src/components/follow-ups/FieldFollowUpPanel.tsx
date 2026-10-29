import {
  HRP_FOLLOW_UP_TRACKS,
  type HrpFollowUpStatus,
  getHrpComplicationLabel,
  getHrpStatusBadge,
  getHrpStatusLabel,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { CalendarIcon, CheckIcon, ClipboardIcon, PhoneIcon, SyncIcon } from "../ui/Icons";
import { PageHeader } from "../ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../ui/Panel";
import { StatTile } from "../ui/Stat";

interface UpdateStatusVariables {
  followUpId: string;
  status: HrpFollowUpStatus;
}

/**
 * Field panel for ANM and CHO.
 *
 * Only lists pushed to this worker by the block appear here. The three tracks
 * stay separate because they happen at different places — CHC for the 7-day MO
 * review, PHC for PMSMA, and the village for VHSND — and a field worker plans
 * her day by location, not by a single merged queue.
 */
export default function FieldFollowUpPanel() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const {
    data: recordsData,
    isLoading: recordsLoading,
    isError,
  } = useQuery({
    queryKey: ["hrp", "follow-ups", "field-panel"],
    queryFn: () => api.hrp.followUps.list({ page: 1, limit: 100 }),
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "follow-ups"],
    queryFn: () => api.hrp.patients.list({ page: 1, limit: 100 }),
  });

  const records = recordsData?.data ?? [];
  const patients = patientsData?.data ?? [];
  const allRows = buildFollowUpLineList(patients, records);

  // A row belongs to this worker when the block dispatched it to her, when she
  // closed it, or when it is her own registration that has not been dispatched
  // yet. Rows assigned to another tier stay out of her phone.
  const rows = allRows.filter((row) => {
    if (!user) return true;
    if (!row.followUpId) return true;
    if (row.assignedToName === user.name) return true;
    if (row.completedByName === user.name) return true;
    return !row.assignedToName;
  });

  const summary = summariseFollowUps(rows);
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
        eyebrow="Field work"
        title="Follow-up to be done"
        description="Lists pushed to you by the block, one card per contact"
        actions={
          <Link to="/patients" className="btn btn-secondary">
            <ClipboardIcon className="h-4 w-4" />
            Open register
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatTile
          label="Complete"
          value={summary.complete}
          hint="Closed on this device"
          tone="green"
          icon={<CheckIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Pending"
          value={summary.pending}
          hint={summary.breached > 0 ? `${summary.breached} past the window` : "Inside the window"}
          tone={summary.breached > 0 ? "red" : "amber"}
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Not reachable"
          value={summary.notReachable}
          hint="Retry after a failed call"
          icon={<PhoneIcon className="h-4 w-4" />}
        />
      </div>

      {statusMutation.isError ? (
        <div
          className="rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-triage-red">
            Could not update that follow-up. Check the connection and try again.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading follow-ups">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : isError ? (
        <Panel>
          <EmptyState
            title="Follow-ups could not load"
            description="The block list is unavailable right now. Pull to refresh when the network returns."
          />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="No follow-up list assigned yet"
            description="When the Block Nodal officer pushes a list to you, it appears here with the three contact tracks."
            action={
              <Link to="/patients/new" className="btn btn-primary btn-sm">
                Add an HRP case
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {HRP_FOLLOW_UP_TRACKS.map((track) => {
            const trackRows = rows.filter((row) => row.track === track.value);
            return (
              <Panel key={track.value} aria-labelledby={`track-${track.value}`}>
                <PanelHeader
                  id={`track-${track.value}`}
                  title={
                    <span className="flex items-center gap-2">
                      {track.label}
                      <span className="badge badge-gray">{trackRows.length}</span>
                    </span>
                  }
                  description={track.description}
                />
                {trackRows.length === 0 ? (
                  <PanelBody>
                    <p className="text-sm text-ink-subtle">Nothing scheduled on this track.</p>
                  </PanelBody>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {trackRows.map((row) => (
                      <li key={row.key}>
                        <FieldFollowUpCard
                          row={row}
                          pending={statusMutation.isPending}
                          onStatus={setStatus}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <SyncIcon className="h-3.5 w-3.5" />
        Updates save immediately and sync to the block line list.
      </p>
    </div>
  );
}

function FieldFollowUpCard({
  row,
  pending,
  onStatus,
}: {
  row: FollowUpRow;
  pending: boolean;
  onStatus: (row: FollowUpRow, status: HrpFollowUpStatus) => void;
}) {
  const motherPhone = row.phone?.replace(/\D/g, "");
  const ashaPhone = row.ashaPhone?.replace(/\D/g, "");

  return (
    <article className="px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/patients/${row.patientId}`}
            className="block truncate text-sm font-semibold text-ink hover:text-primary hover:underline"
          >
            {row.patientName}
          </Link>
          <p className="tnum mt-0.5 text-2xs text-ink-subtle">
            {row.age} yrs
            {row.village ? ` · ${row.village}` : ""} · due {formatShortDate(row.scheduledDate)}
          </p>
          {row.complication ? (
            <p className="mt-1 text-2xs font-medium text-triage-red">
              {getHrpComplicationLabel(row.complication)}
            </p>
          ) : null}
        </div>
        <span className={`badge shrink-0 ${getHrpStatusBadge(row.status)}`}>
          {getHrpStatusLabel(row.status)}
        </span>
      </div>

      {row.status === "NOT_REACHABLE" ? (
        <p className="mt-2 rounded bg-canvas px-2.5 py-1.5 text-2xs text-ink-muted">
          Not reachable
          {row.lastAttemptAt
            ? ` · last attempt ${format(row.lastAttemptAt, "d MMM, HH:mm")}`
            : " · no attempt time recorded"}
        </p>
      ) : null}

      {row.status === "COMPLETE" ? (
        <p className="mt-2 text-2xs font-medium text-triage-green">{attributionLabel(row)}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={() => onStatus(row, "COMPLETE")}
            disabled={pending || !row.followUpId}
            aria-label={`Mark complete for ${row.patientName}`}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Mark complete
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onStatus(row, "NOT_REACHABLE")}
            disabled={pending || !row.followUpId}
            aria-label={`Mark not reachable for ${row.patientName}`}
          >
            Not reachable
          </button>
          {motherPhone ? (
            <a href={`tel:+91${motherPhone}`} className="btn btn-secondary btn-sm">
              <PhoneIcon className="h-3.5 w-3.5" />
              Call mother
            </a>
          ) : null}
          {ashaPhone ? (
            <a href={`tel:+91${ashaPhone}`} className="btn btn-secondary btn-sm">
              <PhoneIcon className="h-3.5 w-3.5" />
              Call ASHA Sangini
            </a>
          ) : null}
        </div>
      )}

      {!row.followUpId ? (
        <p className="mt-2 text-2xs text-triage-amber">
          Waiting for the block to dispatch this contact before it can be closed.
        </p>
      ) : null}
    </article>
  );
}
