import { type Patient, type Visit, getHrpReasonLabel } from "@hrp/shared";
import { Link } from "react-router-dom";
import { bpTone, formatBp, formatHb, gaLabel, hbTone, toneTextClass } from "../lib/clinical";
import { EmptyState } from "./ui/EmptyState";
import { ChevronRightIcon } from "./ui/Icons";
import { RiskBadge, RiskStripe } from "./ui/RiskBadge";

interface PatientListProps {
  patients: Patient[];
  latestVisits: Map<string, Visit>;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Dense clinical line list for facility desktops. */
export function PatientTable({
  patients,
  latestVisits,
  emptyTitle = "No patients found",
  emptyDescription,
}: PatientListProps) {
  return (
    <div className="hidden w-full overflow-x-auto xl:block">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Risk</th>
            <th scope="col">Mother</th>
            <th scope="col">GA</th>
            <th scope="col">Reason</th>
            <th scope="col">Latest vitals</th>
            <th scope="col">ANM</th>
            <th scope="col" className="text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState variant="row" title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            patients.map((patient) => {
              const visit = latestVisits.get(patient.id);
              return (
                <tr key={patient.id}>
                  <td>
                    <RiskBadge level={patient.riskLevel} size="sm" />
                  </td>
                  <td>
                    <Link
                      to={`/patients/${patient.id}`}
                      className="font-medium text-ink hover:text-primary hover:underline"
                    >
                      {patient.name}
                    </Link>
                    <p className="tnum text-2xs text-ink-subtle">
                      {patient.age} yrs · G{patient.gravida}P{patient.para}
                    </p>
                  </td>
                  <td className="tnum whitespace-nowrap font-medium">{gaLabel(patient)}</td>
                  <td className="max-w-56 truncate text-ink-muted">
                    {getHrpReasonLabel(patient.hrpReason)}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`tnum font-semibold ${toneTextClass(bpTone(visit))}`}>
                      {formatBp(visit)}
                    </span>
                    <span className="text-line-strong"> · </span>
                    <span className={`tnum ${toneTextClass(hbTone(visit?.hb))}`}>
                      Hb {formatHb(visit)}
                    </span>
                  </td>
                  <td className="text-ink-muted">{patient.anmName ?? "—"}</td>
                  <td className="text-right">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="btn btn-secondary btn-sm"
                      aria-label={`Open ${patient.name}'s record`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Card stack used below 1024px, where a seven-column table cannot be read. */
export function PatientCards({
  patients,
  latestVisits,
  emptyTitle = "No patients found",
  emptyDescription,
}: PatientListProps) {
  if (patients.length === 0) {
    return (
      <div className="xl:hidden">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <ul className="space-y-2 xl:hidden">
      {patients.map((patient) => {
        const visit = latestVisits.get(patient.id);
        return (
          <li
            key={patient.id}
            className="relative overflow-hidden rounded-lg border border-line bg-surface"
          >
            <RiskStripe level={patient.riskLevel} />
            <div className="py-3 pl-4 pr-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/patients/${patient.id}`}
                    className="block truncate text-sm font-semibold text-ink"
                  >
                    {patient.name}
                  </Link>
                  <p className="tnum mt-0.5 truncate text-2xs text-ink-subtle">
                    {patient.age} yrs · {gaLabel(patient)} · {getHrpReasonLabel(patient.hrpReason)}
                  </p>
                </div>
                <RiskBadge level={patient.riskLevel} size="sm" />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="tnum text-xs">
                  <span className="text-ink-subtle">BP </span>
                  <span className={`font-semibold ${toneTextClass(bpTone(visit))}`}>
                    {formatBp(visit)}
                  </span>
                  <span className="text-line-strong"> · </span>
                  <span className="text-ink-subtle">Hb </span>
                  <span className={`font-semibold ${toneTextClass(hbTone(visit?.hb))}`}>
                    {formatHb(visit)}
                  </span>
                </p>
                <Link
                  to={`/patients/${patient.id}`}
                  className="btn btn-secondary btn-sm"
                  aria-label={`Open ${patient.name}'s record`}
                >
                  Open
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Table on desktop, cards on phones and tablets. */
export function PatientList(props: PatientListProps) {
  return (
    <>
      <PatientTable {...props} />
      <PatientCards {...props} />
    </>
  );
}
