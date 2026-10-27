import type { Pagination, Referral, ReferralFilter, RiskLevel } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { api } from "../lib/api";

function RiskBadge({ level }: { level: RiskLevel }) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-500">Manage patient referrals to higher facilities</p>
      </div>

      <div className="card">
        <div className="card-body p-4">
          <select
            className="input w-auto"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Referral["status"]);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>From → To</th>
                    <th>Reason</th>
                    <th className="text-center">Urgency</th>
                    <th className="text-center">Status</th>
                    <th>Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.length > 0 ? (
                    referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.patientId}</td>
                        <td>
                          {r.fromFacilityId} → {r.toFacilityId}
                        </td>
                        <td className="max-w-xs truncate">{r.reason}</td>
                        <td className="text-center">
                          <RiskBadge level={r.urgency} />
                        </td>
                        <td className="text-center">
                          <StatusBadge status={r.status} />
                        </td>
                        <td>{format(new Date(r.createdAt), "MMM d, HH:mm")}</td>
                        <td className="text-right">
                          {r.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() =>
                                  updateMutation.mutate({ id: r.id, data: { status: "ACCEPTED" } })
                                }
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() =>
                                  updateMutation.mutate({ id: r.id, data: { status: "REJECTED" } })
                                }
                              >
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        No referrals
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
