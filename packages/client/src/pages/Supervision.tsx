import type { Pagination, RiskLevel, SupervisionAlert } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { BellIcon, CheckIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { StatTile } from "../components/ui/Stat";
import { Pagination as PaginationControls } from "../components/ui/Table";
import { api } from "../lib/api";

function SeverityBadge({ level }: { level: RiskLevel }) {
  const config = {
    RED: { class: "badge-red", label: "Critical" },
    AMBER: { class: "badge-amber", label: "Warning" },
    GREEN: { class: "badge-green", label: "Info" },
  };
  const c = config[level];
  return <span className={`badge ${c.class}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: SupervisionAlert["type"] }) {
  const labels: Record<SupervisionAlert["type"], string> = {
    ANM_OFFLINE: "ANM Offline",
    VISIT_OVERDUE: "Visit Overdue",
    SYNC_FAILED: "Sync Failed",
    HIGH_RISK_UNATTENDED: "High-Risk Unattended",
  };
  return <span className="badge badge-gray">{labels[type]}</span>;
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

type AckFilter = "OPEN" | "ACKED" | "ALL";

export default function SupervisionPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<SupervisionAlert["type"] | "">("");
  const [severityFilter, setSeverityFilter] = useState<RiskLevel | "">("");
  const [ackFilter, setAckFilter] = useState<AckFilter>("OPEN");
  const limit = 20;

  const acknowledged = ackFilter === "ALL" ? undefined : ackFilter === "ACKED";

  const { data, isLoading } = useQuery({
    queryKey: ["supervision", "alerts", { page, typeFilter, severityFilter, ackFilter }],
    queryFn: () =>
      api.supervision.alerts({
        page,
        limit,
        type: typeFilter || undefined,
        severity: severityFilter || undefined,
        acknowledged,
      }),
    placeholderData: (prev) => prev,
  });

  const alerts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const ackMutation = useMutation({
    mutationFn: api.supervision.acknowledge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supervision"] }),
  });

  const openOnPage = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Oversight"
        title="Supervision Alerts"
        description="Monitor ANM activity and high-risk case follow-up"
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <StatTile
          label="Matching alerts"
          value={total}
          hint="Current filter"
          icon={<BellIcon className="h-4 w-4" />}
          tone="primary"
        />
        <StatTile
          label="Open on this page"
          value={openOnPage}
          hint="Not yet acknowledged"
          tone={openOnPage > 0 ? "amber" : "green"}
          icon={<CheckIcon className="h-4 w-4" />}
        />
        <div className="col-span-2 lg:col-span-1">
          <div className="panel h-full p-3 sm:p-4">
            <p className="text-xs font-medium text-ink-subtle">Acknowledgement state</p>
            <SegmentedControl
              className="mt-2"
              label="Filter by acknowledgement state"
              value={ackFilter}
              onChange={(value) => {
                setAckFilter(value);
                setPage(1);
              }}
              options={[
                { value: "OPEN", label: "Open" },
                { value: "ACKED", label: "Acknowledged" },
                { value: "ALL", label: "All" },
              ]}
            />
          </div>
        </div>
      </div>

      <Panel aria-label="Supervision alerts">
        <PanelHeader
          title="Alert queue"
          description="Signals raised by the field sync and follow-up rules"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="input min-h-control w-auto py-1.5"
                aria-label="Filter by alert type"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as SupervisionAlert["type"] | "");
                  setPage(1);
                }}
              >
                <option value="">All Types</option>
                <option value="ANM_OFFLINE">ANM Offline</option>
                <option value="VISIT_OVERDUE">Visit Overdue</option>
                <option value="SYNC_FAILED">Sync Failed</option>
                <option value="HIGH_RISK_UNATTENDED">High-Risk Unattended</option>
              </select>
              <select
                className="input min-h-control w-auto py-1.5"
                aria-label="Filter by severity"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value as RiskLevel | "");
                  setPage(1);
                }}
              >
                <option value="">All Severities</option>
                <option value="RED">Critical</option>
                <option value="AMBER">Warning</option>
                <option value="GREEN">Info</option>
              </select>
            </div>
          }
        />

        {isLoading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading alerts">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No alerts"
            description="No supervision alert matches the current filters."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Message</th>
                  <th scope="col" className="hidden md:table-cell">
                    Facility
                  </th>
                  <th scope="col" className="text-center">
                    Severity
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    Time
                  </th>
                  <th scope="col" className="text-center">
                    Status
                  </th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className={a.acknowledged ? "opacity-60" : ""}>
                    <td>
                      <TypeBadge type={a.type} />
                    </td>
                    <td className="max-w-md">
                      <p className="text-sm text-ink">{a.message}</p>
                    </td>
                    <td className="tnum hidden text-2xs text-ink-subtle md:table-cell">
                      <span title={a.facilityId}>{shortId(a.facilityId)}</span>
                    </td>
                    <td className="text-center">
                      <SeverityBadge level={a.severity} />
                    </td>
                    <td className="tnum hidden whitespace-nowrap text-ink-muted sm:table-cell">
                      {format(new Date(a.createdAt), "d MMM, HH:mm")}
                    </td>
                    <td className="text-center">
                      {a.acknowledged ? (
                        <span className="badge badge-green">Acknowledged</span>
                      ) : (
                        <span className="badge badge-amber">Pending</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!a.acknowledged && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => ackMutation.mutate(a.id)}
                          disabled={ackMutation.isPending}
                        >
                          Acknowledge
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
