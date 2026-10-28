import type { Pagination, Referral, ReferralFilter } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { ArrowRightIcon, CheckIcon, XIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { Pagination as PaginationControls } from "../components/ui/Table";
import { api } from "../lib/api";

function UrgencyBadge({ level }: { level: Referral["urgency"] }) {
  const config = {
    RED: { class: "badge-red", label: "Urgent" },
    AMBER: { class: "badge-amber", label: "Within 48h" },
    GREEN: { class: "badge-green", label: "Routine" },
  };
  const c = config[level];
  return <span className={`badge ${c.class}`}>{c.label}</span>;
}

function StatusBadge({ status }: { status: Referral["status"] }) {
  const config = {
    PENDING: { class: "badge-amber", label: "Pending" },
    ACCEPTED: { class: "badge-green", label: "Accepted" },
    REJECTED: { class: "badge-red", label: "Rejected" },
    COMPLETED: { class: "badge-gray", label: "Completed" },
  };
  const c = config[status];
  return <span className={`badge ${c.class}`}>{c.label}</span>;
}

/** Short identifier for a UUID, keeping the full value in the title attribute. */
function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<Referral["status"] | "">("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["referrals", "list", { page, statusFilter }],
    queryFn: () =>
      api.referrals.list({ page, limit, status: statusFilter || undefined } as ReferralFilter &
        Pagination),
    placeholderData: (prev) => prev,
  });

  const referrals = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Referral> }) =>
      api.referrals.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals"] }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Oversight"
        title="Referrals"
        description="Manage patient referrals to higher facilities"
      />

      <Panel aria-label="Referral queue">
        <PanelHeader
          title="Referral queue"
          description={`${total} ${total === 1 ? "referral" : "referrals"} matching the current filter`}
          action={
            <select
              className="input min-h-control w-auto py-1.5"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as Referral["status"] | "");
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
            </select>
          }
        />

        {isLoading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading referrals">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <EmptyState
            title="No referrals"
            description="No referral matches this status filter. Referrals created during an ANC visit appear here."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col" className="hidden md:table-cell">
                    From → To
                  </th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="text-center">
                    Urgency
                  </th>
                  <th scope="col" className="text-center">
                    Status
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="tnum font-medium text-ink" title={r.patientId}>
                        {shortId(r.patientId)}
                      </span>
                      <p className="text-2xs text-ink-subtle">Patient ID</p>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="tnum inline-flex items-center gap-1 text-2xs text-ink-muted">
                        <span title={r.fromFacilityId}>{shortId(r.fromFacilityId)}</span>
                        <ArrowRightIcon className="h-3 w-3 text-ink-subtle" />
                        <span title={r.toFacilityId}>{shortId(r.toFacilityId)}</span>
                      </span>
                    </td>
                    <td className="max-w-64">
                      <p className="truncate text-sm text-ink">{r.reason}</p>
                    </td>
                    <td className="text-center">
                      <UrgencyBadge level={r.urgency} />
                    </td>
                    <td className="text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="tnum hidden whitespace-nowrap text-ink-muted sm:table-cell">
                      {format(new Date(r.createdAt), "d MMM, HH:mm")}
                    </td>
                    <td className="text-right">
                      {r.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() =>
                              updateMutation.mutate({ id: r.id, data: { status: "ACCEPTED" } })
                            }
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              updateMutation.mutate({ id: r.id, data: { status: "REJECTED" } })
                            }
                          >
                            <XIcon className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === "ACCEPTED" && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            updateMutation.mutate({ id: r.id, data: { status: "COMPLETED" } })
                          }
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && total > 0 ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        ) : null}
      </Panel>
    </div>
  );
}
