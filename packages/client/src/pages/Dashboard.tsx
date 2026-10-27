import {
  Patient,
  type RiskLevel,
  type SupervisionAlert,
  gestationalAgeWeeks,
  getFollowUpPlan,
} from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import PatientsSection from "./Patients";

function StatCard({
  label,
  value,
  icon,
  color,
}: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

const riskColors: Record<RiskLevel, string> = {
  RED: "text-red-700",
  AMBER: "text-amber-800",
  GREEN: "text-green-700",
};

const riskBgColors: Record<RiskLevel, string> = {
  RED: "bg-red-100",
  AMBER: "bg-amber-100",
  GREEN: "bg-green-100",
};

function RiskIcon({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskBgColors[level]} ${riskColors[level]} ${className ?? ""}`}
    >
      {level === "RED" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {level === "AMBER" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {level === "GREEN" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {level}
    </span>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export default function Dashboard() {
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", "dashboard"],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
  });

  const { data: visitsData, isLoading: visitsLoading } = useQuery({
    queryKey: ["visits", "dashboard"],
    queryFn: () => api.visits.list({ page: 1, limit: 100 }),
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ["supervision", "alerts"],
    queryFn: () => api.supervision.alerts({ page: 1, limit: 10, acknowledged: false }),
  });

  const patients = patientsData?.data ?? [];
  const visits = visitsData?.data ?? [];
  const alerts = (alertsData?.data as SupervisionAlert[]) ?? [];

  const highRiskCount = patients.filter((p) => p.riskLevel === "RED").length;
  const mediumRiskCount = patients.filter((p) => p.riskLevel === "AMBER").length;
  const _lowRiskCount = patients.filter((p) => p.riskLevel === "GREEN").length;

  // Count recorded visits per woman so the follow-up plan starts at her next
  // ANC contact rather than repeating contacts already done.
  const completedByPatient = new Map<string, number>();
  for (const visit of visits) {
    completedByPatient.set(visit.patientId, (completedByPatient.get(visit.patientId) ?? 0) + 1);
  }

  const allFollowUps = patients.flatMap((patient) =>
    getFollowUpPlan(patient, completedByPatient.get(patient.id) ?? 0, 1).map((item) => ({
      patient,
      ...item,
    }))
  );
  const followUpsDueCount = allFollowUps.filter((item) => item.status !== "UPCOMING").length;
  const followUps = allFollowUps
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 6);

  if (patientsLoading || visitsLoading || alertsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="p-4 border-b border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your high-risk pregnancy cases</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={patients.length}
          icon={<UsersIcon className="w-8 h-8 text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          label="High Risk (Red)"
          value={highRiskCount}
          icon={<AlertTriangleIcon className="w-8 h-8 text-red-600" />}
          color="bg-red-100"
        />
        <StatCard
          label="Medium Risk (Amber)"
          value={mediumRiskCount}
          icon={<AlertTriangleIcon className="w-8 h-8 text-amber-600" />}
          color="bg-amber-100"
        />
        <StatCard
          label="Follow-ups Due"
          value={followUpsDueCount}
          icon={<CalendarIcon className="w-8 h-8 text-green-600" />}
          color="bg-green-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">High-Risk Patients</h2>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>GA (wks)</th>
                    <th className="text-center">Risk</th>
                    <th>Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {patients
                    .filter((p) => p.riskLevel !== "GREEN")
                    .sort((a, b) => {
                      const riskOrder: Record<RiskLevel, number> = { RED: 0, AMBER: 1, GREEN: 2 };
                      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
                    })
                    .slice(0, 10)
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td>{p.age}</td>
                        <td>{gestationalAgeWeeks(p) ?? "—"}</td>
                        <td className="text-center">
                          <RiskIcon level={p.riskLevel} />
                        </td>
                        <td>{p.updatedAt ? format(new Date(p.updatedAt), "MMM d") : "—"}</td>
                      </tr>
                    ))}
                  {patients.filter((p) => p.riskLevel !== "GREEN").length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No high-risk patients
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Follow-ups Due</h2>
            <Link to="/follow-ups" className="text-sm text-green-700 hover:text-green-800">
              View all
            </Link>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>ANM</th>
                    <th>Next Contact</th>
                    <th>Tests</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {followUps.length > 0 ? (
                    followUps.map(({ patient, visitNumber, dueDate, status, tests }) => (
                      <tr key={`${patient.id}-${visitNumber}`}>
                        <td className="font-medium">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="text-green-700 hover:text-green-800"
                          >
                            {patient.name}
                          </Link>
                        </td>
                        <td>{patient.anmName ?? "—"}</td>
                        <td>
                          Visit {visitNumber} · {format(dueDate, "MMM d")}
                        </td>
                        <td className="max-w-xs truncate">{tests.slice(0, 2).join(", ")}</td>
                        <td className="text-center">
                          <span
                            className={`badge ${
                              status === "OVERDUE"
                                ? "badge-red"
                                : status === "DUE"
                                  ? "badge-amber"
                                  : "badge-gray"
                            }`}
                          >
                            {status === "OVERDUE"
                              ? "Overdue"
                              : status === "DUE"
                                ? "Due"
                                : "Upcoming"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No follow-ups due
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Supervision Alerts</h2>
            <a href="/supervision" className="text-sm text-green-700 hover:text-green-800">
              View all
            </a>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Facility</th>
                    <th>Severity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length > 0 ? (
                    alerts.slice(0, 10).map((a) => (
                      <tr key={a.id}>
                        <td className="text-sm font-medium capitalize">
                          {a.type.replace(/_/g, " ")}
                        </td>
                        <td className="max-w-xs truncate">{a.message}</td>
                        <td>{a.facilityId}</td>
                        <td className="text-center">
                          <RiskIcon level={a.severity} />
                        </td>
                        <td>{format(new Date(a.createdAt), "MMM d, HH:mm")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No alerts
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <PatientsSection />
    </div>
  );
}
