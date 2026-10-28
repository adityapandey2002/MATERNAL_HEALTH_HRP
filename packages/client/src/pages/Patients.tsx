import { type RiskLevel, gestationalAgeWeeks } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PatientList } from "../components/PatientList";
import { EmptyState } from "../components/ui/EmptyState";
import { PlusIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Pagination } from "../components/ui/Table";
import { api } from "../lib/api";
import { latestVisitByPatient } from "../lib/clinical";
import { useCanWriteClinical } from "../lib/session";

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", "list", { page, search, riskFilter, anmFilter }],
    queryFn: () =>
      api.patients.list({
        page,
        limit,
        search: search || undefined,
        riskLevel: riskFilter || undefined,
        anmName: anmFilter.trim() || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: visitsData } = useQuery({
    queryKey: ["visits", "register", { limit: 100 }],
    queryFn: () => api.visits.list({ page: 1, limit: 100 }),
    staleTime: 60 * 1000,
  });

  const patients = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const latestVisits = latestVisitByPatient(visitsData?.data ?? []);

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

        {isLoading ? (
          <PatientListSkeleton />
        ) : error ? (
          <EmptyState
            title="Could not load patients"
            description="Check the connection and try again."
          />
        ) : (
          <PatientList
            patients={patients}
            latestVisits={latestVisits}
            emptyTitle="No patients found"
            emptyDescription="Try a different search, risk level or ANM name."
          />
        )}

        {!isLoading && !error && total > 0 ? (
          <Pagination
            page={page}
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

function PatientListSkeleton() {
  return (
    <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading patients">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded bg-line-soft" />
      ))}
    </div>
  );
}
