import {
  type CreatePatient,
  type DangerSign,
  type Patient,
  RiskLevel,
  type UpdatePatient,
  Visit,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RiskBadge } from "../components/ui";
import { api } from "../lib/api";

const DANGER_SIGNS: { value: DangerSign; label: string }[] = [
  { value: "HYPERTENSION", label: "Hypertension / Pre-eclampsia" },
  { value: "GESTATIONAL_DIABETES", label: "Gestational Diabetes (GDM)" },
  { value: "SEVERE_ANEMIA", label: "Severe Anemia (Hb < 7)" },
  { value: "VAGINAL_BLEEDING", label: "Vaginal Bleeding" },
  { value: "REDUCED_FETAL_MOVEMENT", label: "Reduced Fetal Movement" },
  { value: "SEVERE_HEADACHE", label: "Severe Headache" },
  { value: "VISION_DISTURBANCE", label: "Vision Disturbance" },
  { value: "EPILEPSY", label: "Epilepsy / Seizures" },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";
  const [editing, setEditing] = useState(isNew);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patients", id],
    queryFn: () => api.patients.get(id ?? ""),
    enabled: !isNew,
  });

  const { data: visitsData } = useQuery({
    queryKey: ["visits", "byPatient", id],
    queryFn: () => api.visits.byPatient(id ?? ""),
    enabled: !isNew,
  });

  const saveMutation = useMutation({
    mutationFn: isNew
      ? (data: CreatePatient) => api.patients.create(data)
      : (data: UpdatePatient) => api.patients.update(id ?? "", data),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (isNew) navigate(`/patients/${saved.id}`);
      else setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.patients.delete(id ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      navigate("/patients");
    },
  });

  const [form, setForm] = useState<Partial<CreatePatient>>({
    name: "",
    age: 25,
    phone: "",
    address: "",
    lmp: null,
    gravida: 0,
    para: 0,
    abortions: 0,
    riskFactors: [],
  });

  const handleChange = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRiskFactor = (sign: DangerSign) => {
    setForm((prev) => ({
      ...prev,
      riskFactors: prev.riskFactors?.includes(sign)
        ? prev.riskFactors?.filter((s) => s !== sign)
        : [...(prev.riskFactors ?? []), sign],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      age: Number(form.age),
      gravida: Number(form.gravida),
      para: Number(form.para),
      abortions: Number(form.abortions),
      lmp: form.lmp ? new Date(form.lmp) : null,
      facilityId: "current-facility-id", // Would come from user context
      registeredBy: "current-user-id",
    };
    saveMutation.mutate(payload as CreatePatient);
  };

  if (isLoading && !isNew) {
    return <div className="flex h-64 items-center justify-center">Loading…</div>;
  }

  if (!isNew && !patient) {
    return <div className="text-center py-12">Patient not found</div>;
  }

  const p = patient ?? ({ ...form } as Patient);
  const visits = visitsData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? "Register New Patient" : p.name}
          </h1>
          <p className="text-gray-500">
            {isNew
              ? "Enter patient details and risk factors"
              : `Age ${p.age} • ${p.phone ?? "No phone"}`}
          </p>
        </div>
        {!isNew && !editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="btn btn-outline">
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this patient?")) deleteMutation.mutate();
              }}
              className="btn btn-danger"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isNew && !editing ? (
          <>
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Risk Assessment</h2>
              </div>
              <div className="card-body">
                <div className="flex flex-wrap items-center gap-4">
                  <RiskBadge level={p.riskLevel} />
                  <div className="text-sm text-gray-500">
                    Score: <span className="font-medium text-gray-900">{p.riskScore}</span>
                  </div>
                  {p.isHighRisk && (
                    <span className="text-sm text-red-600 font-medium">⚠ High-Risk Pregnancy</span>
                  )}
                </div>
                {p.riskFactors.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.riskFactors.map((s) => (
                      <span key={s} className="badge badge-amber">
                        {DANGER_SIGNS.find((d) => d.value === s)?.label ?? s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Patient Details</h2>
              </div>
              <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailRow label="Name" value={p.name} />
                <DetailRow label="Age" value={`${p.age} years`} />
                <DetailRow label="Phone" value={p.phone ?? "Not provided"} />
                <DetailRow label="Address" value={p.address ?? "Not provided"} />
                <DetailRow label="Gravida" value={String(p.gravida)} />
                <DetailRow label="Para" value={String(p.para)} />
                <DetailRow label="Abortions" value={String(p.abortions)} />
                <DetailRow
                  label="LMP"
                  value={p.lmp ? format(new Date(p.lmp), "MMM d, yyyy") : "Not set"}
                />
                <DetailRow
                  label="EDD"
                  value={p.edd ? format(new Date(p.edd), "MMM d, yyyy") : "Not set"}
                />
                <DetailRow
                  label="GA"
                  value={
                    p.edd
                      ? `${Math.max(0, Math.round((new Date(p.edd).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)))} weeks`
                      : "Unknown"
                  }
                />
                <DetailRow
                  label="Registered"
                  value={p.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "—"}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Basic Information</h2>
              </div>
              <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="field-5">
                    Name *
                  </label>
                  <input
                    id="field-5"
                    className="input"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-6">
                    Age *
                  </label>
                  <input
                    id="field-6"
                    type="number"
                    className="input"
                    min="15"
                    max="55"
                    value={form.age}
                    onChange={(e) => handleChange("age", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-7">
                    Phone
                  </label>
                  <input
                    id="field-7"
                    type="tel"
                    className="input"
                    value={form.phone ?? ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+91 9XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-8">
                    Address
                  </label>
                  <textarea
                    id="field-8"
                    className="input"
                    rows={2}
                    value={form.address ?? ""}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-9">
                    Gravida
                  </label>
                  <input
                    id="field-9"
                    type="number"
                    className="input"
                    min="0"
                    value={form.gravida}
                    onChange={(e) => handleChange("gravida", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-10">
                    Para
                  </label>
                  <input
                    id="field-10"
                    type="number"
                    className="input"
                    min="0"
                    value={form.para}
                    onChange={(e) => handleChange("para", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-11">
                    Abortions
                  </label>
                  <input
                    id="field-11"
                    type="number"
                    className="input"
                    min="0"
                    value={form.abortions}
                    onChange={(e) => handleChange("abortions", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-12">
                    LMP (Last Menstrual Period)
                  </label>
                  <input
                    id="field-12"
                    type="date"
                    className="input"
                    value={form.lmp ? format(new Date(form.lmp), "yyyy-MM-dd") : ""}
                    onChange={(e) =>
                      handleChange("lmp", e.target.value ? new Date(e.target.value) : null)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">Risk Factors (Danger Signs)</h2>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-500 mb-4">
                  Select all that apply. Risk score calculates automatically.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DANGER_SIGNS.map((s) => (
                    <label
                      key={s.value}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                    >
                      <input
                        type="checkbox"
                        checked={form.riskFactors?.includes(s.value) ?? false}
                        onChange={() => toggleRiskFactor(s.value)}
                        className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-900">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {!isNew && !editing && visits.length > 0 && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">Visit History</h2>
              <Link to={`/patients/${p.id}/visit`} className="btn btn-primary btn-sm">
                New Visit
              </Link>
            </div>
            <div className="card-body p-0">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Visit #</th>
                      <th>GA (wks)</th>
                      <th>BP</th>
                      <th>Hb</th>
                      <th>Weight</th>
                      <th>Risk Signs</th>
                      <th>IFA</th>
                      <th>Calcium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td>{format(new Date(v.visitDate), "MMM d, yyyy")}</td>
                        <td>{v.visitNumber}</td>
                        <td>{v.gestationalWeeks}</td>
                        <td>
                          {v.bpSystolic && v.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : "—"}
                        </td>
                        <td>{v.hb ?? "—"}</td>
                        <td>{v.weight ?? "—"}</td>
                        <td>{v.dangerSigns.length > 0 ? v.dangerSigns.join(", ") : "—"}</td>
                        <td>{v.ifaGiven ? "✓" : "—"}</td>
                        <td>{v.calciumGiven ? "✓" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setEditing(false)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : isNew ? "Register Patient" : "Save Changes"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-gray-900">{value}</p>
    </div>
  );
}
