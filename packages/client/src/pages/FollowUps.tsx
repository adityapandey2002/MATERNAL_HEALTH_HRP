import { type FollowUpStatus, getFollowUpPlan } from "@hrp/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const statusOrder: Record<FollowUpStatus, number> = { OVERDUE: 0, DUE: 1, UPCOMING: 2 };

const statusConfig: Record<FollowUpStatus, { label: string; badge: string }> = {
  OVERDUE: { label: "Overdue", badge: "badge-red" },
  DUE: { label: "Due", badge: "badge-amber" },
  UPCOMING: { label: "Upcoming", badge: "badge-gray" },
};

export default function FollowUpsPage() {
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

  if (patientsLoading || visitsLoading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-gray-500">Loading follow-ups…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Follow Ups</h1>
        <p className="text-gray-500">ANC contacts that need action, most urgent first</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Overdue</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{counts.OVERDUE}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Due Now</p>
          <p className="mt-1 text-3xl font-bold text-amber-800">{counts.DUE}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500">Upcoming</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{counts.UPCOMING}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Follow-ups to do</h2>
        </div>
        <div className="card-body p-0">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>ANM</th>
                  <th>Contact</th>
                  <th>Tests</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {followUps.length > 0 ? (
                  followUps.map(({ patient, visitNumber, dueDate, tests, status }) => (
                    <tr key={patient.id}>
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
                        Visit {visitNumber} · {format(dueDate, "MMM d, yyyy")}
                      </td>
                      <td className="max-w-xs truncate">{tests.slice(0, 2).join(", ")}</td>
                      <td className="text-center">
                        <span className={`badge ${statusConfig[status].badge}`}>
                          {statusConfig[status].label}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/patients/${patient.id}/visit`}
                          className="btn btn-outline btn-sm"
                        >
                          Record visit
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No follow-ups to do
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
