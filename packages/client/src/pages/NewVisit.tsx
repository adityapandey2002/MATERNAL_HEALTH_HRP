import { type CreateVisit, type DangerSign, Patient, RiskLevel, Visit } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

const VITALS = [
  { key: "bpSystolic", label: "BP Systolic", type: "number", min: 70, max: 250, unit: "mmHg" },
  { key: "bpDiastolic", label: "BP Diastolic", type: "number", min: 40, max: 150, unit: "mmHg" },
  { key: "hb", label: "Hemoglobin", type: "number", step: 0.1, min: 3, max: 18, unit: "g/dL" },
  { key: "weight", label: "Weight", type: "number", step: 0.1, min: 30, max: 150, unit: "kg" },
  { key: "fundalHeight", label: "Fundal Height", type: "number", min: 10, max: 50, unit: "cm" },
  { key: "fetalHeartRate", label: "Fetal HR", type: "number", min: 60, max: 200, unit: "bpm" },
];

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

const SUPPLEMENTS = [
  { key: "ifaGiven", label: "IFA Given" },
  { key: "calciumGiven", label: "Calcium Given" },
  { key: "albendazoleGiven", label: "Albendazole Given" },
];

function toNumber(value?: string): number | null {
  if (!value) return null;
  return Number(value);
}

export default function NewVisitPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patients", id],
    queryFn: () => api.patients.get(id ?? ""),
    enabled: !!id,
  });

  const { data: visitsData } = useQuery({
    queryKey: ["visits", "byPatient", id],
    queryFn: () => api.visits.byPatient(id ?? ""),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateVisit) => api.visits.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["patients", id] });
      navigate(`/patients/${id}`);
    },
  });

  const [visitNumber, setVisitNumber] = useState(1);
  const [gestationalWeeks, setGestationalWeeks] = useState(0);
  const [visitDate, setVisitDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dangerSigns, setDangerSigns] = useState<DangerSign[]>([]);
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [supplements, setSupplements] = useState<Record<string, boolean>>({});
  const [referred, setReferred] = useState(false);
  const [referralReason, setReferralReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visitsData && visitsData.length > 0) {
      const sorted = visitsData.sort((a, b) => b.visitNumber - a.visitNumber);
      const lastVisit = sorted[0];
      if (!lastVisit) return;
      setVisitNumber(lastVisit.visitNumber + 1);
      setGestationalWeeks(lastVisit.gestationalWeeks);
    }
  }, [visitsData]);

  useEffect(() => {
    if (patient?.edd) {
      const edd = new Date(patient.edd);
      const today = new Date();
      const weeks = Math.round((today.getTime() - edd.getTime()) / (1000 * 60 * 60 * 24 * 7)) * -1;
      if (weeks > 0) setGestationalWeeks(weeks);
    }
  }, [patient]);

  const toggleDangerSign = (sign: DangerSign) => {
    setDangerSigns((prev) =>
      prev.includes(sign) ? prev.filter((s) => s !== sign) : [...prev, sign]
    );
  };

  const toggleSupplement = (key: string) => {
    setSupplements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateVisit = {
      patientId: id ?? "",
      visitNumber,
      gestationalWeeks,
      visitDate: new Date(visitDate),
      bpSystolic: toNumber(vitals.bpSystolic),
      bpDiastolic: toNumber(vitals.bpDiastolic),
      hb: toNumber(vitals.hb),
      weight: toNumber(vitals.weight),
      fundalHeight: toNumber(vitals.fundalHeight),
      fetalHeartRate: toNumber(vitals.fetalHeartRate),
      dangerSigns,
      ifaGiven: supplements.ifaGiven ?? false,
      calciumGiven: supplements.calciumGiven ?? false,
      albendazoleGiven: supplements.albendazoleGiven ?? false,
      referred,
      referralReason: referred ? referralReason : null,
      referralFacilityId: null,
      notes: notes || null,
    };
    createMutation.mutate(payload);
  };

  if (patientLoading) {
    return <div className="flex h-64 items-center justify-center">Loading patient…</div>;
  }

  if (!patient) {
    return <div className="text-center py-12">Patient not found</div>;
  }

  const gaWeeks = patient.edd
    ? Math.max(
        0,
        Math.round((new Date(patient.edd).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
      )
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New ANC Visit</h1>
          <p className="text-gray-500">
            {patient.name} • Age {patient.age} • GA ~{gaWeeks} weeks
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/patients/${id}`)}
          className="btn btn-outline"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Visit Details</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="field-1">
                Visit Number *
              </label>
              <input
                id="field-1"
                type="number"
                className="input"
                min="1"
                value={visitNumber}
                onChange={(e) => setVisitNumber(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="field-2">
                Gestational Age (weeks) *
              </label>
              <input
                id="field-2"
                type="number"
                className="input"
                min="0"
                max="45"
                value={gestationalWeeks}
                onChange={(e) => setGestationalWeeks(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="field-3">
                Visit Date *
              </label>
              <input
                id="field-3"
                type="date"
                className="input"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Vitals</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VITALS.map((v) => (
              <div key={v.key}>
                <label className="label" htmlFor={`vital-${v.key}`}>
                  {v.label} <span className="text-gray-400">({v.unit})</span>
                </label>
                <input
                  id={`vital-${v.key}`}
                  type="number"
                  className="input"
                  min={v.min}
                  max={v.max}
                  step={v.step ?? 1}
                  value={vitals[v.key] ?? ""}
                  onChange={(e) => setVitals((prev) => ({ ...prev, [v.key]: e.target.value }))}
                  placeholder={v.unit}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Danger Signs Observed</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DANGER_SIGNS.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={dangerSigns.includes(s.value)}
                    onChange={() => toggleDangerSign(s.value)}
                    className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Supplements Given</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SUPPLEMENTS.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                >
                  <input
                    type="checkbox"
                    checked={supplements[s.key] ?? false}
                    onChange={() => toggleSupplement(s.key)}
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Referral</h2>
          </div>
          <div className="card-body space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={referred}
                onChange={(e) => setReferred(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
              />
              <span className="font-medium text-gray-900">Refer to higher facility</span>
            </label>
            {referred && (
              <div>
                <label className="label" htmlFor="field-4">
                  Reason for Referral *
                </label>
                <textarea
                  id="field-4"
                  className="input"
                  rows={3}
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  placeholder="Describe clinical reason for referral…"
                  required
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Notes</h2>
          </div>
          <div className="card-body">
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional clinical notes…"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(`/patients/${id}`)}
            className="btn btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Saving…" : "Save Visit"}
          </button>
        </div>
      </form>
    </div>
  );
}
