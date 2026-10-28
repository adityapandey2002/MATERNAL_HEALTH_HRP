import { type FollowUpStatus, getFollowUpPlan } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { CalendarIcon, CheckIcon, ClipboardIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { StatTile } from "../components/ui/Stat";
import { api } from "../lib/api";
import { gaLabel } from "../lib/clinical";

const statusOrder: Record<FollowUpStatus, number> = { OVERDUE: 0, DUE: 1, UPCOMING: 2 };

const statusConfig: Record<FollowUpStatus, { label: string; badge: string }> = {
  OVERDUE: { label: "Overdue", badge: "badge-red" },
  DUE: { label: "Due", badge: "badge-amber" },
  UPCOMING: { label: "Upcoming", badge: "badge-gray" },
};

type StatusFilter = FollowUpStatus | "ALL";

export default function FollowUpsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "follow-ups"],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
  });

  const { data: visitsData, isLoading: visitsLoading } = useQuery({
    queryKey: ["visits", "follow-ups"],
    queryFn: () => api.visits.list({ page: 1, limit: 100 }),
  });

  const patients = patientsData?.data ?? [];
  const visits = visitsData?.data ?? [];

  const completedByPatient = new Map<string, number>();
  for (const visit of visits) {
    completedByPatient.set(visit.patientId, (completedByPatient.get(visit.patientId) ?? 0) + 1);
  }

  const followUps = patients
    .flatMap((patient) =>
      getFollowUpPlan(patient, completedByPatient.get(patient.id) ?? 0, 1).map((item) => ({
        patient,
        ...item,
      }))
    )
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] || a.dueDate.getTime() - b.dueDate.getTime()
    );

  const counts = {
    OVERDUE: followUps.filter((item) => item.status === "OVERDUE").length,
    DUE: followUps.filter((item) => item.status === "DUE").length,
    UPCOMING: followUps.filter((item) => item.status === "UPCOMING").length,
  };

  const visible =
    statusFilter === "ALL" ? followUps : followUps.filter((item) => item.status === statusFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Field work"
        title="Follow Ups"
        description="ANC contacts that need action, most urgent first"
        actions={
          <Link to="/patients" className="btn btn-secondary">
            Open register
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <StatTile
          label="Overdue"
          value={counts.OVERDUE}
          hint="Past the ANC window"
          tone="red"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Due now"
          value={counts.DUE}
          hint="Inside the window"
          tone="amber"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <div className="col-span-2 sm:col-span-1">
          <StatTile
            label="Upcoming"
            value={counts.UPCOMING}
            hint="Next scheduled contact"
            icon={<CheckIcon className="h-4 w-4" />}
          />
        </div>
      </div>

      <Panel aria-label="Follow-ups to do">
        <PanelHeader
          title="Follow-ups to do"
          description="One row per woman with the next ANC contact"
          action={
            <SegmentedControl
              label="Filter by follow-up status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All", count: followUps.length },
                { value: "OVERDUE", label: "Overdue", count: counts.OVERDUE },
                { value: "DUE", label: "Due", count: counts.DUE },
                { value: "UPCOMING", label: "Upcoming", count: counts.UPCOMING },
              ]}
            />
          }
        />

        {patientsLoading || visitsLoading ? (
          <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading follow-ups">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No follow-ups to do"
            description="Every woman in this list is inside her ANC window. New contacts appear as they come due."
            action={
              <Link to="/patients" className="btn btn-secondary btn-sm">
                Review the register
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-2 p-3 xl:hidden">
              {visible.map(({ patient, visitNumber, dueDate, status }) => (
                <li
                  key={`${patient.id}-${visitNumber}`}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/patients/${patient.id}`}
                        className="block truncate text-sm font-semibold text-ink"
                      >
                        {patient.name}
                      </Link>
                      <p className="tnum mt-0.5 text-2xs text-ink-subtle">
                        {gaLabel(patient)} · ANC {visitNumber}
                      </p>
                    </div>
                    <span className={`badge ${statusConfig[status].badge}`}>
                      {statusConfig[status].label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="tnum text-xs text-ink-muted">
                      Due {format(dueDate, "d MMM yyyy")}
                    </p>
                    <Link
                      to={`/patients/${patient.id}/visit`}
                      className="btn btn-secondary btn-sm"
                      aria-label={`Record visit for ${patient.name}`}
                    >
                      <ClipboardIcon className="h-3.5 w-3.5" />
                      Record visit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="table-container hidden xl:block">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">ANM</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Tests</th>
                    <th scope="col" className="text-center">
                      Status
                    </th>
                    <th scope="col" className="text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ patient, visitNumber, dueDate, tests, status }) => (
                    <tr key={`${patient.id}-${visitNumber}`}>
                      <td>
                        <Link
                          to={`/patients/${patient.id}`}
                          className="font-medium text-ink hover:text-primary hover:underline"
                        >
                          {patient.name}
                        </Link>
                        <p className="tnum text-2xs text-ink-subtle">
                          {gaLabel(patient)} · ANC {visitNumber}
                        </p>
                      </td>
                      <td className="text-ink-muted">{patient.anmName ?? "—"}</td>
                      <td className="whitespace-nowrap">
                        <span className="tnum text-sm">{format(dueDate, "d MMM yyyy")}</span>
                        <p className="text-2xs text-ink-subtle">Visit {visitNumber}</p>
                      </td>
                      <td className="max-w-64 truncate text-ink-muted">
                        {tests.slice(0, 2).join(", ")}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${statusConfig[status].badge}`}>
                          {statusConfig[status].label}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/patients/${patient.id}/visit`}
                          className="btn btn-secondary btn-sm"
                        >
                          <ClipboardIcon className="h-3.5 w-3.5" />
                          Record visit
                        </Link>
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
