import {
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
import {
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  ListChecksIcon,
  PhoneIcon,
  SyncIcon,
} from "../ui/Icons";
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
 * The server scopes the list to the signed-in user's facility (ANM) or
 * facility subtree (CHO). A referred woman's first cycle belongs to the Block
 * HRP Helpdesk, so it shows in a read-only "Awaiting block review" section
 * until the block closes it; every cycle after that is the field team's.
 */
export default function FieldFollowUpPanel() {
  const queryClient = useQueryClient();

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
  const rows = buildFollowUpLineList(patients, records);

  const awaitingBlock = rows.filter((row) => row.isBlockStage);
  const fieldRows = rows.filter((row) => !row.isBlockStage);
  const summary = summariseFollowUps(fieldRows);
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
        description="Your 15-day HRP contacts. The block helpdesk takes the first check-up for referred women."
        actions={
          <Link to="/patients" className="btn btn-secondary">
            <ClipboardIcon className="h-4 w-4" />
            Open register
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting block review"
          value={awaitingBlock.length}
          hint="Read-only until the block closes it"
          icon={<ListChecksIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Field pending"
          value={summary.pending}
          hint={summary.breached > 0 ? `${summary.breached} past the window` : "Inside the window"}
          tone={summary.breached > 0 ? "red" : "amber"}
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Complete"
          value={summary.complete}
          hint="Closed on this device"
          tone="green"
          icon={<CheckIcon className="h-4 w-4" />}
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
            description="When a woman in your facility is registered as an HRP, her 15-day contact appears here."
            action={
              <Link to="/patients/new" className="btn btn-primary btn-sm">
                Add an HRP case
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel aria-labelledby="awaiting-block-heading">
            <PanelHeader
              id="awaiting-block-heading"
              title={
                <span className="flex items-center gap-2">
                  Awaiting block review
                  <span className="badge badge-gray">{awaitingBlock.length}</span>
                </span>
              }
              description="Referred women whose first 15-day check-up belongs to the Block HRP Helpdesk"
            />
            {awaitingBlock.length === 0 ? (
              <PanelBody>
                <p className="text-sm text-ink-subtle">
                  No woman is waiting on the block helpdesk right now.
                </p>
              </PanelBody>
            ) : (
              <ul className="divide-y divide-line-soft">
                {awaitingBlock.map((row) => (
                  <li key={row.key}>
                    <BlockReviewCard row={row} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel aria-labelledby="field-follow-ups-heading">
            <PanelHeader
              id="field-follow-ups-heading"
              title={
                <span className="flex items-center gap-2">
                  Your 15-day follow-ups
                  <span className="badge badge-gray">{fieldRows.length}</span>
                </span>
              }
              description="ANM and CHO contact every 15 days. The block helpdesk sees the same row."
            />
            {fieldRows.length === 0 ? (
              <PanelBody>
                <p className="text-sm text-ink-subtle">
                  Nothing in the field cycle yet. Contacts appear here as each 15-day window opens.
                </p>
              </PanelBody>
            ) : (
              <ul className="divide-y divide-line-soft">
                {fieldRows.map((row) => (
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
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <SyncIcon className="h-3.5 w-3.5" />
        Updates save immediately and sync to the block line list.
      </p>
    </div>
  );
}

function BlockReviewCard({ row }: { row: FollowUpRow }) {
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

      <p className="mt-2 rounded bg-canvas px-2.5 py-1.5 text-2xs text-ink-muted">
        The Block HRP Helpdesk completes the first check-up before this row becomes active for you.
      </p>
    </article>
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
          This contact has no follow-up record yet, so it cannot be closed from here.
        </p>
      ) : null}
    </article>
  );
}
