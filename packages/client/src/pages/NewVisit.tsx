import {
  type CreateVisit,
  type DangerSign,
  type Patient,
  gestationalAgeWeeks,
  getHrpReasonLabel,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  ClipboardIcon,
  DropletIcon,
  PhoneIcon,
} from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { RiskBadge } from "../components/ui/RiskBadge";
import { api } from "../lib/api";
import { gaLabel, villageLabel } from "../lib/clinical";

const VITALS = [
  { key: "bpSystolic", label: "BP Systolic", min: 70, max: 250, unit: "mmHg", step: 1 },
  { key: "bpDiastolic", label: "BP Diastolic", min: 40, max: 150, unit: "mmHg", step: 1 },
  { key: "hb", label: "Hemoglobin", min: 3, max: 18, unit: "g/dL", step: 0.1 },
  { key: "weight", label: "Weight", min: 30, max: 150, unit: "kg", step: 0.1 },
  { key: "fundalHeight", label: "Fundal Height", min: 10, max: 50, unit: "cm", step: 1 },
  { key: "fetalHeartRate", label: "Fetal HR", min: 60, max: 200, unit: "bpm", step: 1 },
] as const;

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
  { key: "ifaGiven", label: "IFA given" },
  { key: "calciumGiven", label: "Calcium given" },
  { key: "albendazoleGiven", label: "Albendazole given" },
] as const;

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
    if (!visitsData || visitsData.length === 0) return;
    const lastVisit = [...visitsData].sort((a, b) => b.visitNumber - a.visitNumber)[0];
    if (lastVisit) setVisitNumber(lastVisit.visitNumber + 1);
  }, [visitsData]);

  useEffect(() => {
    if (!patient) return;
    const weeks = gestationalAgeWeeks(patient);
    if (weeks !== null) setGestationalWeeks(weeks);
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
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading patient">
        <div className="h-16 animate-pulse rounded-lg bg-line-soft" />
        <div className="h-64 animate-pulse rounded-lg bg-line-soft" />
      </div>
    );
  }

  if (!patient) {
    return (
      <EmptyState
        title="Patient not found"
        description="This record may have been removed or the link is incomplete."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={patient.name}
        title="Record ANC visit"
        description={`Age ${patient.age} · ${gaLabel(patient)} · ${getHrpReasonLabel(patient.hrpReason)}`}
        actions={
          <button
            type="button"
            onClick={() => navigate(`/patients/${id}`)}
            className="btn btn-secondary"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to record
          </button>
        }
      />

      <PatientStrip patient={patient} />

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader
              title="Visit details"
              description="Contact number, gestational age and date"
              action={<CalendarBadge date={visitDate} />}
            />
            <PanelBody className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="visit-number">
                  Visit Number *
                </label>
                <input
                  id="visit-number"
                  type="number"
                  className="input mt-1.5"
                  min="1"
                  value={visitNumber}
                  onChange={(e) => setVisitNumber(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="visit-ga">
                  Gestational Age (weeks) *
                </label>
                <input
                  id="visit-ga"
                  type="number"
                  className="input mt-1.5"
                  min="0"
                  max="45"
                  value={gestationalWeeks}
                  onChange={(e) => setGestationalWeeks(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="visit-date">
                  Visit Date *
                </label>
                <input
                  id="visit-date"
                  type="date"
                  className="input mt-1.5"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  required
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Vitals"
              description="Leave a field blank when it was not measured"
              action={<ActivityIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VITALS.map((v) => (
                <div key={v.key}>
                  <label className="label" htmlFor={`vital-${v.key}`}>
                    {v.label}{" "}
                    <span className="font-normal normal-case text-ink-subtle">({v.unit})</span>
                  </label>
                  <input
                    id={`vital-${v.key}`}
                    type="number"
                    inputMode="decimal"
                    className="input mt-1.5 tnum"
                    min={v.min}
                    max={v.max}
                    step={v.step}
                    value={vitals[v.key] ?? ""}
                    onChange={(e) => setVitals((prev) => ({ ...prev, [v.key]: e.target.value }))}
                    placeholder={v.unit}
                  />
                </div>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Danger signs observed"
              description="Select every sign present at this contact"
              action={
                dangerSigns.length > 0 ? (
                  <span className="badge badge-red">{dangerSigns.length} selected</span>
                ) : (
                  <AlertTriangleIcon className="h-4 w-4 text-ink-subtle" />
                )
              }
            />
            <PanelBody>
              <div className="grid gap-2 sm:grid-cols-2">
                {DANGER_SIGNS.map((s) => (
                  <label
                    key={s.value}
                    className={`flex min-h-touch cursor-pointer items-center gap-3 rounded border px-3 py-2 text-sm transition-colors ${
                      dangerSigns.includes(s.value)
                        ? "border-triage-red-line bg-triage-red-bg text-triage-red"
                        : "border-line bg-surface text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={dangerSigns.includes(s.value)}
                      onChange={() => toggleDangerSign(s.value)}
                      className="h-4 w-4 shrink-0 rounded-sm border-line-strong text-triage-red-solid focus:ring-triage-red-line"
                    />
                    <span className="font-medium">{s.label}</span>
                  </label>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Supplements"
              description="Given at this contact"
              action={<DropletIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="space-y-2">
              {SUPPLEMENTS.map((s) => (
                <label
                  key={s.key}
                  className="flex min-h-touch cursor-pointer items-center justify-between gap-3 rounded border border-line px-3 py-2 text-sm font-medium text-ink-muted hover:bg-canvas"
                >
                  {s.label}
                  <input
                    type="checkbox"
                    checked={supplements[s.key] ?? false}
                    onChange={() => toggleSupplement(s.key)}
                    className="h-4 w-4 shrink-0 rounded-sm border-line-strong text-primary focus:ring-primary-ring"
                  />
                </label>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Referral"
              description="Escalate to a higher facility"
              action={<ClipboardIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="space-y-4">
              <label
                htmlFor="visit-referred"
                className="flex min-h-touch cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 hover:bg-canvas"
              >
                <input
                  id="visit-referred"
                  type="checkbox"
                  checked={referred}
                  onChange={(e) => setReferred(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded-sm border-line-strong text-primary focus:ring-primary-ring"
                />
                <span className="text-sm font-medium text-ink">Refer to higher facility</span>
              </label>
              {referred && (
                <div>
                  <label className="label" htmlFor="referral-reason">
                    Reason for Referral *
                  </label>
                  <textarea
                    id="referral-reason"
                    className="input mt-1.5"
                    rows={3}
                    value={referralReason}
                    onChange={(e) => setReferralReason(e.target.value)}
                    placeholder="Describe clinical reason for referral…"
                    required
                  />
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Notes" description="Optional clinical notes" />
            <PanelBody>
              <label className="sr-only" htmlFor="visit-notes">
                Clinical notes
              </label>
              <textarea
                id="visit-notes"
                className="input"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional clinical notes…"
              />
            </PanelBody>
          </Panel>

          <div className="space-y-2">
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving…" : "Save Visit"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/patients/${id}`)}
              className="btn btn-secondary btn-block"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PatientStrip({ patient }: { patient: Patient }) {
  return (
    <div className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      <RiskBadge level={patient.riskLevel} size="sm" />
      <span className="tnum text-sm text-ink-muted">
        <span className="text-ink-subtle">GA </span>
        {gaLabel(patient)}
      </span>
      <span className="tnum text-sm text-ink-muted">
        <span className="text-ink-subtle">
          G{patient.gravida}P{patient.para}A{patient.abortions}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
        <PhoneIcon className="h-3.5 w-3.5 text-ink-subtle" />
        {patient.phone ?? "No phone"}
      </span>
      <span className="text-sm text-ink-subtle">{villageLabel(patient)}</span>
      {patient.ashaName && <span className="text-sm text-ink-subtle">ASHA {patient.ashaName}</span>}
    </div>
  );
}

function CalendarBadge({ date }: { date: string }) {
  return (
    <span className="tnum badge badge-gray">
      {format(new Date(`${date}T00:00:00`), "d MMM yyyy")}
    </span>
  );
}
