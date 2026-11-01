import {
  type FollowUpStatus,
  type Patient,
  type RiskLevel,
  type SupervisionAlert,
  type UserRole,
  type Visit,
  getFollowUpPlan,
  getHrpReasonLabel,
} from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PatientList } from "../components/PatientList";
import { EmptyState } from "../components/ui/EmptyState";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClipboardIcon,
  PhoneIcon,
  PlusIcon,
  SyncIcon,
  UsersIcon,
} from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelHeader } from "../components/ui/Panel";
import { RiskBadge, RiskStripe } from "../components/ui/RiskBadge";
import { StatTile } from "../components/ui/Stat";
import { api } from "../lib/api";
import {
  bpTone,
  formatBp,
  formatHb,
  gaLabel,
  hbTone,
  latestVisitByPatient,
  toneTextClass,
} from "../lib/clinical";
import { useLocalFollowUpItems, useLocalPatients, useLocalVisits } from "../lib/db/queries";
import { buildFollowUpLineList, summariseFollowUps } from "../lib/hrp";
import { useUserRole } from "../lib/session";
import { useSyncStatus } from "../lib/sync/engine";
import { pullCohort } from "../lib/sync/pull";
import type { SyncStatusSummary } from "../lib/sync/queue";
import { isOnline, onOnlineChange } from "../utils/sw";

const RISK_ORDER: Record<RiskLevel, number> = { RED: 0, AMBER: 1, GREEN: 2 };

/**
 * Server rows are authoritative once they arrive, but a change made on this
 * device that has not been sent yet must not disappear from the screen.
 */
function mergePatients(server: Patient[] | undefined, local: Patient[] | undefined): Patient[] {
  const byId = new Map<string, Patient>((server ?? []).map((patient) => [patient.id, patient]));
  for (const row of local ?? []) {
    const current = byId.get(row.id);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime()) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function mergeVisits(server: Visit[] | undefined, local: Visit[] | undefined): Visit[] {
  const byId = new Map<string, Visit>((server ?? []).map((visit) => [visit.id, visit]));
  for (const row of local ?? []) {
    const current = byId.get(row.id);
    if (!current || row.updatedAt.getTime() > current.updatedAt.getTime()) byId.set(row.id, row);
  }
  return [...byId.values()];
}

type DataStatusTone = "neutral" | "primary" | "red" | "amber" | "green";

/** Honest device status for the field dashboard tile. */
function describeDataStatus({
  online,
  pendingChanges,
  conflicts,
  lastSync,
}: {
  online: boolean;
  pendingChanges: number;
  conflicts: number;
  lastSync: string | null;
}): { value: string; hint: string; tone: DataStatusTone } {
  const asOf = lastSync ? `as of ${format(new Date(lastSync), "HH:mm")}` : null;
  if (conflicts > 0) {
    return {
      value: "Review",
      hint: `${conflicts} conflict${conflicts === 1 ? "" : "s"} in Settings`,
      tone: "red",
    };
  }
  if (!online) {
    const saved =
      pendingChanges > 0 ? `${pendingChanges} saved on this device` : "Saved on this device";
    return {
      value: "Offline",
      hint: asOf ? `${saved} · ${asOf}` : saved,
      tone: "amber",
    };
  }
  if (pendingChanges > 0) {
    return {
      value: `${pendingChanges} waiting`,
      hint: "Sending automatically",
      tone: "amber",
    };
  }
  return { value: "Synced", hint: asOf ?? "All changes sent", tone: "green" };
}

export default function Dashboard() {
  const role = useUserRole();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || navigator.onLine) void pullCohort();
  }, []);

  const localPatients = useLocalPatients();
  const localVisits = useLocalVisits();

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "dashboard"],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
    enabled: online,
  });

  const { data: visitsData, isLoading: visitsLoading } = useQuery({
    queryKey: ["visits", "dashboard"],
    queryFn: () => api.visits.list({ page: 1, limit: 100 }),
    enabled: online,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["supervision", "alerts"],
    queryFn: () => api.supervision.alerts({ page: 1, limit: 10, acknowledged: false }),
    enabled: online,
  });

  const patients = mergePatients(patientsData?.data, localPatients);
  const visits = mergeVisits(visitsData?.data, localVisits);
  const alerts = (alertsData?.data as SupervisionAlert[]) ?? [];
  const latestVisits = latestVisitByPatient(visits);
  const sync = useSyncStatus();

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
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const dueFollowUps = followUps.filter((item) => item.status !== "UPCOMING");
  const duePatientIds = new Set(dueFollowUps.map((item) => item.patient.id));

  const counts = {
    total: patients.length,
    red: patients.filter((p) => p.riskLevel === "RED").length,
    amber: patients.filter((p) => p.riskLevel === "AMBER").length,
    green: patients.filter((p) => p.riskLevel === "GREEN").length,
    due: duePatientIds.size,
  };

  // A warm device cache paints immediately; only a cold start waits on the
  // network (and offline it never does).
  if ((patientsLoading || visitsLoading || alertsLoading) && localPatients === undefined) {
    return <DashboardSkeleton />;
  }

  if (role === "ANM") {
    return (
      <FieldDashboard
        patients={patients}
        latestVisits={latestVisits}
        dueFollowUps={dueFollowUps}
        counts={counts}
        online={online}
        sync={sync}
      />
    );
  }

  return (
    <OversightDashboard
      role={role}
      patients={patients}
      latestVisits={latestVisits}
      alerts={alerts}
      counts={counts}
    />
  );
}

interface DashboardCounts {
  total: number;
  red: number;
  amber: number;
  green: number;
  due: number;
}

type DueFollowUp = {
  patient: Patient;
  visitNumber: number;
  dueDate: Date;
  status: FollowUpStatus;
  tests: string[];
};

interface FieldDashboardProps {
  patients: Patient[];
  latestVisits: Map<string, Visit>;
  dueFollowUps: DueFollowUp[];
  counts: DashboardCounts;
  online: boolean;
  sync: SyncStatusSummary | null;
}

function FieldDashboard({
  patients,
  latestVisits,
  dueFollowUps,
  counts,
  online,
  sync,
}: FieldDashboardProps) {
  const urgent = [...patients]
    .filter((patient) => patient.riskLevel !== "GREEN")
    .sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel])
    .slice(0, 4);

  const urgentIds = new Set(urgent.map((patient) => patient.id));
  const routine = dueFollowUps.filter((item) => !urgentIds.has(item.patient.id)).slice(0, 5);

  const pendingChanges = sync?.pending ?? 0;
  const conflicts = sync?.conflicts ?? 0;
  const dataStatus = describeDataStatus({
    online,
    pendingChanges,
    conflicts,
    lastSync: sync?.lastSync ?? null,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${format(new Date(), "EEEE d MMMM")} · Araria`}
        title="Today"
        description={`${counts.due} ANC contacts due · ${counts.red} high-risk ${
          counts.red === 1 ? "woman needs" : "women need"
        } attention`}
        actions={
          <Link to="/patients/new" className="btn btn-primary">
            <PlusIcon className="h-4 w-4" />
            Register woman
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile
          label="Due visits"
          value={counts.due}
          hint="Today and overdue"
          icon={<CalendarIcon className="h-4 w-4" />}
          tone="primary"
        />
        <StatTile
          label="High risk"
          value={counts.red}
          hint="Red triage"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
          tone="red"
        />
        <StatTile
          label="Active mothers"
          value={counts.total}
          hint="In your register"
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Data status"
          value={dataStatus.value}
          hint={dataStatus.hint}
          icon={<SyncIcon className="h-4 w-4" />}
          tone={dataStatus.tone}
          compact
        />
      </div>

      <Panel aria-labelledby="urgent-heading">
        <PanelHeader
          id="urgent-heading"
          title={`Urgent attention (${urgent.length})`}
          description="Danger signs recorded at the last contact"
          action={
            <Link
              to="/follow-ups"
              className="text-2xs font-semibold uppercase tracking-wide text-primary hover:underline"
            >
              Needs visit
            </Link>
          }
        />
        {urgent.length === 0 ? (
          <EmptyState
            title="No high-risk patients"
            description="No woman in your register is currently flagged red or amber."
          />
        ) : (
          <ul className="space-y-2 p-3 sm:p-4">
            {urgent.map((patient) => (
              <li key={patient.id}>
                <UrgentPatientCard patient={patient} visit={latestVisits.get(patient.id)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel aria-labelledby="routine-heading">
        <PanelHeader
          id="routine-heading"
          title="Routine ANC due"
          description="Scheduled for today"
          action={
            <span className="tnum text-2xs font-semibold text-ink-subtle">{routine.length}</span>
          }
        />
        {routine.length === 0 ? (
          <EmptyState title="No follow-ups due" description="Nothing scheduled for today." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {routine.map(({ patient, visitNumber, status }) => (
              <li
                key={`${patient.id}-${visitNumber}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-ink-muted sm:flex"
                >
                  {patient.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
                  <p className="tnum truncate text-2xs text-ink-subtle">
                    {gaLabel(patient)} · ANC {visitNumber}
                    {status === "OVERDUE" ? " · overdue" : ""}
                  </p>
                </div>
                <Link
                  to={`/patients/${patient.id}/visit`}
                  className="btn btn-secondary btn-sm"
                  aria-label={`Record visit for ${patient.name}`}
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  Checkup
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Link
        to="/follow-ups"
        className="panel flex items-center gap-3 p-3 transition-colors hover:bg-canvas sm:p-4"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded bg-primary-light text-primary-dark"
        >
          <ClipboardIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Review all follow-ups</span>
          <span className="block text-2xs text-ink-subtle">
            Every ANC contact that needs action
          </span>
        </span>
        <ArrowRightIcon className="h-4 w-4 text-ink-subtle" />
      </Link>
    </div>
  );
}

function UrgentPatientCard({ patient, visit }: { patient: Patient; visit: Visit | undefined }) {
  const phone = patient.phone?.replace(/\s+/g, "");

  return (
    <article className="relative overflow-hidden rounded border border-line bg-surface">
      <RiskStripe level={patient.riskLevel} />
      <div className="py-3 pl-4 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{patient.name}</p>
            <p className="tnum truncate text-2xs text-ink-subtle">
              {gaLabel(patient)} · {patient.age} yrs · G{patient.gravida}P{patient.para}
            </p>
          </div>
          <RiskBadge level={patient.riskLevel} size="sm" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-canvas px-2.5 py-1.5 text-xs">
          <span className="inline-flex items-center gap-1">
            <ActivityIcon className="h-3.5 w-3.5 text-ink-subtle" />
            <span className="text-ink-subtle">BP</span>
            <span className={`tnum font-semibold ${toneTextClass(bpTone(visit))}`}>
              {formatBp(visit)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-ink-subtle">Hb</span>
            <span className={`tnum font-semibold ${toneTextClass(hbTone(visit?.hb))}`}>
              {formatHb(visit)}
            </span>
          </span>
          <span className="min-w-0 truncate text-2xs font-medium text-triage-red">
            {getHrpReasonLabel(patient.hrpReason)}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {phone ? (
            <a href={`tel:${phone}`} className="btn btn-secondary btn-sm">
              <PhoneIcon className="h-3.5 w-3.5" />
              Call
            </a>
          ) : (
            <span className="btn btn-secondary btn-sm opacity-50" aria-disabled="true">
              <PhoneIcon className="h-3.5 w-3.5" />
              No phone
            </span>
          )}
          <Link
            to={`/patients/${patient.id}/visit`}
            className="btn btn-primary btn-sm"
            aria-label={`Start checkup for ${patient.name}`}
          >
            <ClipboardIcon className="h-3.5 w-3.5" />
            Checkup
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Compact HRP cycle view for the CHO.
 *
 * The full line list lives on `/follow-ups`; this is the "is anything slipping"
 * summary: field pending, women still waiting on the block helpdesk's first
 * check-up, open cycles past their due date and overall compliance.
 */
function HrpCycleSection() {
  const patients = useLocalPatients() ?? [];
  const records = useLocalFollowUpItems() ?? [];

  const rows = buildFollowUpLineList(patients, records);
  const summary = summariseFollowUps(rows);
  const fieldPending = summary.byStage.FIELD_15_DAY.pending;

  return (
    <Panel aria-labelledby="cho-hrp-heading">
      <PanelHeader
        id="cho-hrp-heading"
        title="HRP 15-day follow-ups"
        description="Your field cycle plus the first check-up owned by the block helpdesk"
        action={
          <Link to="/follow-ups" className="btn btn-secondary btn-sm">
            Open follow-ups
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-4 sm:p-4">
        <div className="rounded border border-line-soft bg-canvas px-3 py-2">
          <dt className="text-2xs font-medium text-ink-subtle">Field pending</dt>
          <dd className="tnum text-lg font-semibold text-ink">{fieldPending}</dd>
        </div>
        <div className="rounded border border-line-soft bg-canvas px-3 py-2">
          <dt className="text-2xs font-medium text-ink-subtle">Awaiting block review</dt>
          <dd className="tnum text-lg font-semibold text-ink">{summary.awaitingBlockReview}</dd>
        </div>
        <div className="rounded border border-line-soft bg-canvas px-3 py-2">
          <dt className="text-2xs font-medium text-ink-subtle">Escalated</dt>
          <dd
            className={`tnum text-lg font-semibold ${
              summary.escalated > 0 ? "text-triage-red" : "text-triage-green"
            }`}
          >
            {summary.escalated}
          </dd>
        </div>
        <div className="rounded border border-line-soft bg-canvas px-3 py-2">
          <dt className="text-2xs font-medium text-ink-subtle">Compliance</dt>
          <dd className="tnum text-lg font-semibold text-ink">{summary.complianceRate}%</dd>
        </div>
      </dl>
    </Panel>
  );
}

function OversightDashboard({
  role,
  patients,
  latestVisits,
  alerts,
  counts,
}: {
  role: UserRole;
  patients: Patient[];
  latestVisits: Map<string, Visit>;
  alerts: SupervisionAlert[];
  counts: DashboardCounts;
}) {
  const title = role === "CHO" ? "Triage line list" : "District overview";
  const sorted = [...patients].sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${format(new Date(), "d MMMM yyyy")} · Araria district`}
        title={title}
        description="High-risk maternal cohort, ordered by triage level"
        actions={
          // Only ANM and CHO hold patient:write on the server; nodal officers
          // read the cohort, so a Register button would only earn them a 403.
          role === "CHO" ? (
            <Link to="/patients/new" className="btn btn-primary">
              <PlusIcon className="h-4 w-4" />
              Register woman
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatTile label="Total cohort" value={counts.total} hint="Active registrations" />
        <StatTile
          label="High risk"
          value={counts.red}
          hint="Red triage"
          tone="red"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Moderate"
          value={counts.amber}
          hint="Active monitoring"
          tone="amber"
          icon={<AlertTriangleIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Visits due"
          value={counts.due}
          hint="Today and overdue"
          tone="primary"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
      </div>

      {role === "CHO" ? <HrpCycleSection /> : null}

      <Panel aria-labelledby="cohort-heading">
        <PanelHeader
          id="cohort-heading"
          title="Clinical triage"
          description={`${counts.total} women in cohort`}
          action={
            <Link to="/patients" className="btn btn-secondary btn-sm">
              Full register
            </Link>
          }
        />
        <PatientList patients={sorted} latestVisits={latestVisits} />
      </Panel>

      <Panel aria-labelledby="alerts-heading">
        <PanelHeader
          id="alerts-heading"
          title="Supervision alerts"
          description="Unacknowledged signals from the field"
          action={
            <Link to="/supervision" className="btn btn-secondary btn-sm">
              Open supervision
            </Link>
          }
        />
        {alerts.length === 0 ? (
          <EmptyState title="No alerts" description="No unacknowledged supervision signals." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {alerts.slice(0, 5).map((alert) => (
              <li key={alert.id} className="flex items-start gap-3 px-4 py-3">
                <RiskBadge level={alert.severity} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{alert.message}</p>
                  <p className="text-2xs text-ink-subtle">
                    {alert.type.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {format(new Date(alert.createdAt), "d MMM, HH:mm")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-16 animate-pulse rounded-lg bg-line-soft" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-line-soft" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-line-soft" />
    </div>
  );
}
