import { type RiskLevel, gestationalAgeWeeks } from "@hrp/shared";
import { useState } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PatientList } from "../components/PatientList";
import { EmptyState } from "../components/ui/EmptyState";
import { PlusIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Pagination } from "../components/ui/Table";
import { latestVisitByPatient } from "../lib/clinical";
import { useLocalPatients, useLocalVisits } from "../lib/db/queries";
import { useCanWriteClinical } from "../lib/session";
import { pullCohort } from "../lib/sync/pull";

const RISK_OPTIONS: { value: RiskLevel | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "RED", label: "High" },
  { value: "AMBER", label: "Moderate" },
  { value: "GREEN", label: "Routine" },
];

export default function PatientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("");
  const [anmFilter, setAnmFilter] = useState("");
  const canRegister = useCanWriteClinical();
  const limit = 20;

  // Refresh the local cache when online.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void pullCohort();
    }
  }, []);

  const allPatients = useLocalPatients() ?? [];
  const allVisits = useLocalVisits() ?? [];

  const filtered = allPatients.filter((p) => {
    if (riskFilter && p.riskLevel !== riskFilter) return false;
    if (
      anmFilter.trim() &&
      !(p.anmName ?? "").toLowerCase().includes(anmFilter.trim().toLowerCase())
    ) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [p.name, p.ashaPhone ?? "", p.id].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const patients = filtered.slice((safePage - 1) * limit, safePage * limit);
  const latestVisits = latestVisitByPatient(allVisits);

  const resetTo = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Register"
        title="Patients"
        description={`${total} ${total === 1 ? "woman" : "women"} in the high-risk register`}
        actions={
          canRegister ? (
            <Link to="/patients/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              Add HRP woman
            </Link>
          ) : undefined
        }
      />

      <Panel aria-label="Patient register">
        <div className="space-y-3 border-b border-line-soft p-3 sm:p-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              placeholder="Search by name, phone or ID"
              aria-label="Search patients"
              className="input pl-9"
              value={search}
              onChange={(e) => resetTo(setSearch)(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl
              label="Filter by risk level"
              options={RISK_OPTIONS}
              value={riskFilter}
              onChange={resetTo(setRiskFilter)}
            />
            <input
              type="search"
              placeholder="Filter by ANM name"
              className="input sm:w-56"
              aria-label="Filter by ANM name"
              value={anmFilter}
              onChange={(e) => resetTo(setAnmFilter)(e.target.value)}
            />
          </div>
        </div>

        <PatientList
          patients={patients}
          latestVisits={latestVisits}
          emptyTitle="No patients found"
          emptyDescription="Try a different search, risk level or ANM name."
        />

        {total > 0 ? (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        ) : null}
      </Panel>

      <p className="text-2xs text-ink-subtle">
        Gestational age is calculated from the recorded LMP, falling back to the EDD.{" "}
        {patients.filter((p) => gestationalAgeWeeks(p) === null).length > 0
          ? `${patients.filter((p) => gestationalAgeWeeks(p) === null).length} on this page have no dating yet.`
          : ""}
      </p>
    </div>
  );
}
