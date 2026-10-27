import {
  type CreatePatient,
  type DangerSign,
  type FollowUpItem,
  type FollowUpStatus,
  HRP_REASONS,
  type HrpReason,
  type Patient,
  RiskLevel,
  type UpdatePatient,
  Visit,
  getFollowUpPlan,
  getHrpReasonLabel,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RiskBadge, Select } from "../components/ui";
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

  const [form, setForm] = useState<Partial<CreatePatient>>({
    name: "",
    age: 25,
    phone: "",
    address: "",
    hrpReason: null,
    ashaName: "",
    ashaPhone: "",
    referred: false,
    lmp: null,
    gravida: 0,
    para: 0,
    abortions: 0,
    riskFactors: [],
  });

  const startEditing = () => {
    if (patient) {
      setForm({
        name: patient.name,
        age: patient.age,
        phone: patient.phone ?? "",
        address: patient.address ?? "",
        hrpReason: patient.hrpReason ?? null,
        ashaName: patient.ashaName ?? "",
        ashaPhone: patient.ashaPhone ?? "",
        referred: patient.referred,
        lmp: patient.lmp ?? null,
        gravida: patient.gravida,
        para: patient.para,
        abortions: patient.abortions,
        riskFactors: patient.riskFactors,
      });
    }
    setEditing(true);
  };

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
    // The facility and the registering user are derived from the access
    // token on the server, so they are not sent by the client.
    const payload = {
      ...form,
      age: Number(form.age),
      gravida: Number(form.gravida),
      para: Number(form.para),
      abortions: Number(form.abortions),
      ashaName: form.ashaName?.trim() || null,
      ashaPhone: form.ashaPhone?.replace(/\D/g, "") || null,
      hrpReason: form.hrpReason || null,
      lmp: form.lmp ? new Date(form.lmp) : null,
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
  const followUpPlan = isNew ? [] : getFollowUpPlan(p, visits.length, 3);

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
            <button type="button" onClick={startEditing} className="btn btn-outline">
              Edit
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
                    <span className="text-sm text-red-700 font-medium">⚠ High-Risk Pregnancy</span>
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

            <PatientDetailsCard patient={p} />
            <FollowUpPlanCard plan={followUpPlan} />
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
                <h2 className="text-lg font-semibold">HRP Details</h2>
              </div>
              <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Select
                    label="Reason for high-risk pregnancy"
                    id="field-hrp-reason"
                    options={[
                      { value: "", label: "Not recorded" },
                      ...HRP_REASONS.map((reason) => ({
                        value: reason.value,
                        label: reason.label,
                      })),
                    ]}
                    value={form.hrpReason ?? ""}
                    onChange={(e) =>
                      handleChange("hrpReason", (e.target.value || null) as HrpReason | null)
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-asha-name">
                    ASHA name
                  </label>
                  <input
                    id="field-asha-name"
                    className="input"
                    value={form.ashaName ?? ""}
                    onChange={(e) => handleChange("ashaName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-asha-phone">
                    ASHA mobile number
                  </label>
                  <input
                    id="field-asha-phone"
                    type="tel"
                    className="input"
                    value={form.ashaPhone ?? ""}
                    onChange={(e) => handleChange("ashaPhone", e.target.value)}
                  />
                </div>
                <label className="md:col-span-2 flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="checkbox"
                    checked={form.referred ?? false}
                    onChange={(e) => handleChange("referred", e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    Referred to a higher facility
                  </span>
                </label>
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

function PatientDetailsCard({ patient }: { patient: Patient }) {
  const asha = [patient.ashaName, patient.ashaPhone].filter(Boolean).join(" · ") || "Not recorded";
  const ga = patient.edd
    ? `${Math.max(0, Math.round((new Date(patient.edd).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)))} weeks`
    : "Unknown";

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Patient Details</h2>
      </div>
      <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailRow label="Name" value={patient.name} />
        <DetailRow label="Age" value={`${patient.age} years`} />
        <DetailRow label="Reason for High-Risk" value={getHrpReasonLabel(patient.hrpReason)} />
        <DetailRow label="Referred" value={patient.referred ? "Yes" : "No"} />
        <DetailRow label="ASHA Worker" value={asha} />
        <DetailRow label="Registered By (ANM)" value={patient.anmName ?? "—"} />
        <DetailRow label="Phone" value={patient.phone ?? "Not provided"} />
        <DetailRow label="Address" value={patient.address ?? "Not provided"} />
        <DetailRow label="Gravida" value={String(patient.gravida)} />
        <DetailRow label="Para" value={String(patient.para)} />
        <DetailRow label="Abortions" value={String(patient.abortions)} />
        <DetailRow
          label="LMP"
          value={patient.lmp ? format(new Date(patient.lmp), "MMM d, yyyy") : "Not set"}
        />
        <DetailRow
          label="EDD"
          value={patient.edd ? format(new Date(patient.edd), "MMM d, yyyy") : "Not set"}
        />
        <DetailRow label="GA" value={ga} />
        <DetailRow
          label="Registered"
          value={patient.createdAt ? format(new Date(patient.createdAt), "MMM d, yyyy") : "—"}
        />
      </div>
    </div>
  );
}

const FOLLOW_UP_BADGE: Record<FollowUpStatus, string> = {
  OVERDUE: "badge-red",
  DUE: "badge-amber",
  UPCOMING: "badge-gray",
};

const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  OVERDUE: "Overdue",
  DUE: "Due",
  UPCOMING: "Upcoming",
};

function FollowUpPlanCard({ plan }: { plan: FollowUpItem[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold">Follow-up Plan</h2>
      </div>
      <div className="card-body">
        {plan.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add an LMP date to generate follow-up dates for this pregnancy.
          </p>
        ) : (
          <ol className="space-y-3">
            {plan.map((item) => (
              <li
                key={item.visitNumber}
                className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 rounded-lg border border-gray-200 p-3"
              >
                <span className={`badge ${FOLLOW_UP_BADGE[item.status]}`}>
                  {FOLLOW_UP_LABEL[item.status]}
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    Visit {item.visitNumber} · due {format(item.dueDate, "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-gray-500">{item.tests.join(", ")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
