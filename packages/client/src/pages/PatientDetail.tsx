import {
  type CreatePatient,
  type DangerSign,
  type FollowUpItem,
  type FollowUpStatus,
  HRP_REASONS,
  type HrpReason,
  type Patient,
  type UpdatePatient,
  type Visit,
  gestationalAgeWeeks,
  getFollowUpPlan,
  getHrpReasonLabel,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField, Select } from "../components/ui/FormField";
import {
  AlertTriangleIcon,
  ClipboardIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  UserIcon,
} from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { RiskBadge, RiskStripe } from "../components/ui/RiskBadge";
import { api } from "../lib/api";
import {
  bpTone,
  dangerSignLabel,
  formatBp,
  formatHb,
  gaLabel,
  hbTone,
  toneTextClass,
  villageLabel,
} from "../lib/clinical";
import { useCanWriteClinical } from "../lib/session";

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

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";
  const [editing, setEditing] = useState(isNew);
  const canWrite = useCanWriteClinical();

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
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading patient record">
        <div className="h-16 animate-pulse rounded-lg bg-line-soft" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-lg bg-line-soft lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-lg bg-line-soft" />
        </div>
      </div>
    );
  }

  if (!isNew && !patient) {
    return (
      <EmptyState
        title="Patient not found"
        description="This record may have been removed or the link is incomplete."
        action={
          <Link to="/patients" className="btn btn-secondary btn-sm">
            Back to register
          </Link>
        }
      />
    );
  }

  const p = patient ?? ({ ...form } as Patient);
  const visits = visitsData ?? [];
  const followUpPlan = isNew ? [] : getFollowUpPlan(p, visits.length, 3);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={isNew ? "High-risk register" : "Patient record"}
        title={isNew ? "Register new patient" : p.name}
        description={
          isNew
            ? "Enter patient details and risk factors"
            : `Age ${p.age} · ${p.phone ?? "No phone"} · ${villageLabel(p)}`
        }
        actions={
          !isNew && !editing && canWrite ? (
            <>
              <Link to={`/patients/${p.id}/visit`} className="btn btn-primary">
                <PlusIcon className="h-4 w-4" />
                Record visit
              </Link>
              <button type="button" onClick={startEditing} className="btn btn-secondary">
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
            </>
          ) : null
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isNew && !editing ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <RiskPanel patient={p} />
              <VisitHistory visits={visits} />
              <FollowUpPlanCard plan={followUpPlan} />
            </div>
            <div className="space-y-4">
              <PatientDetailsCard patient={p} />
              {canWrite ? (
                <Panel className="bg-primary-light">
                  <PanelBody className="space-y-2">
                    <h2 className="text-sm font-semibold text-primary-dark">Next action</h2>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      Record the next ANC contact to update this woman's vitals and recompute her
                      triage level.
                    </p>
                    <Link to={`/patients/${p.id}/visit`} className="btn btn-primary btn-sm">
                      <ClipboardIcon className="h-3.5 w-3.5" />
                      Record ANC visit
                    </Link>
                  </PanelBody>
                </Panel>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel>
                <PanelHeader
                  title="Basic Information"
                  description="Identity and obstetric history"
                  action={<UserIcon className="h-4 w-4 text-ink-subtle" />}
                />
                <PanelBody className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Name" id="field-name" required>
                    <input
                      id="field-name"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Age" id="field-age" required>
                    <input
                      id="field-age"
                      type="number"
                      min="15"
                      max="55"
                      value={form.age}
                      onChange={(e) => handleChange("age", e.target.value)}
                      required
                    />
                  </FormField>
                  <FormField label="Phone" id="field-phone">
                    <input
                      id="field-phone"
                      type="tel"
                      value={form.phone ?? ""}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+91 9XXXXXXXXX"
                    />
                  </FormField>
                  <FormField label="Address" id="field-address">
                    <textarea
                      id="field-address"
                      rows={2}
                      value={form.address ?? ""}
                      onChange={(e) => handleChange("address", e.target.value)}
                    />
                  </FormField>
                  <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                    <FormField label="Gravida" id="field-gravida">
                      <input
                        id="field-gravida"
                        type="number"
                        min="0"
                        value={form.gravida}
                        onChange={(e) => handleChange("gravida", e.target.value)}
                      />
                    </FormField>
                    <FormField label="Para" id="field-para">
                      <input
                        id="field-para"
                        type="number"
                        min="0"
                        value={form.para}
                        onChange={(e) => handleChange("para", e.target.value)}
                      />
                    </FormField>
                    <FormField label="Abortions" id="field-abortions">
                      <input
                        id="field-abortions"
                        type="number"
                        min="0"
                        value={form.abortions}
                        onChange={(e) => handleChange("abortions", e.target.value)}
                      />
                    </FormField>
                  </div>
                  <FormField label="LMP (Last Menstrual Period)" id="field-lmp">
                    <input
                      id="field-lmp"
                      type="date"
                      value={form.lmp ? format(new Date(form.lmp), "yyyy-MM-dd") : ""}
                      onChange={(e) =>
                        handleChange("lmp", e.target.value ? new Date(e.target.value) : null)
                      }
                    />
                  </FormField>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader
                  title="HRP Details"
                  description="Reason and village follow-up contacts"
                  action={<PhoneIcon className="h-4 w-4 text-ink-subtle" />}
                />
                <PanelBody className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
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
                  <FormField label="ASHA name" id="field-asha-name">
                    <input
                      id="field-asha-name"
                      value={form.ashaName ?? ""}
                      onChange={(e) => handleChange("ashaName", e.target.value)}
                    />
                  </FormField>
                  <FormField label="ASHA mobile number" id="field-asha-phone">
                    <input
                      id="field-asha-phone"
                      type="tel"
                      value={form.ashaPhone ?? ""}
                      onChange={(e) => handleChange("ashaPhone", e.target.value)}
                    />
                  </FormField>
                  <label
                    htmlFor="field-referred"
                    className="flex min-h-touch cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 hover:bg-canvas sm:col-span-2"
                  >
                    <input
                      id="field-referred"
                      type="checkbox"
                      checked={form.referred ?? false}
                      onChange={(e) => handleChange("referred", e.target.checked)}
                      className="h-4 w-4 rounded-sm border-line-strong text-primary focus:ring-primary-ring"
                    />
                    <span className="text-sm font-medium text-ink">
                      Referred to a higher facility
                    </span>
                  </label>
                </PanelBody>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel>
                <PanelHeader
                  title="Risk Factors (Danger Signs)"
                  description="Select all that apply. The risk score recalculates automatically."
                  action={<AlertTriangleIcon className="h-4 w-4 text-ink-subtle" />}
                />
                <PanelBody className="space-y-2">
                  {DANGER_SIGNS.map((s) => (
                    <label
                      key={s.value}
                      className={`flex min-h-touch cursor-pointer items-center gap-3 rounded border px-3 py-2 text-sm transition-colors ${
                        form.riskFactors?.includes(s.value)
                          ? "border-triage-red-line bg-triage-red-bg text-triage-red"
                          : "border-line bg-surface text-ink-muted hover:bg-canvas"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.riskFactors?.includes(s.value) ?? false}
                        onChange={() => toggleRiskFactor(s.value)}
                        className="h-4 w-4 shrink-0 rounded-sm border-line-strong text-triage-red-solid focus:ring-triage-red-line"
                      />
                      <span className="font-medium">{s.label}</span>
                    </label>
                  ))}
                </PanelBody>
              </Panel>

              {saveMutation.isError && (
                <div
                  className="rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
                  role="alert"
                >
                  <p className="text-sm font-medium text-triage-red">
                    Could not save the changes. Check the details and try again.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {editing && (
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">
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

function RiskPanel({ patient }: { patient: Patient }) {
  return (
    <Panel className="relative overflow-hidden">
      <RiskStripe level={patient.riskLevel} />
      <PanelBody className="space-y-3 pl-5">
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge level={patient.riskLevel} size="lg" />
          <span className="tnum text-sm text-ink-subtle">
            Risk score <span className="font-semibold text-ink">{patient.riskScore}</span>
          </span>
          {patient.isHighRisk && <span className="badge badge-red">High-risk pregnancy</span>}
        </div>

        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Reason for high-risk
          </p>
          <p className="mt-0.5 text-sm font-medium text-ink">
            {getHrpReasonLabel(patient.hrpReason)}
          </p>
        </div>

        {patient.riskFactors.length > 0 ? (
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
              Danger signs on record
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {patient.riskFactors.map((sign) => (
                <li key={sign} className="badge badge-red">
                  {dangerSignLabel(sign)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-ink-subtle">No danger signs recorded at registration.</p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line-soft pt-3 text-xs text-ink-muted">
          <span className="tnum">
            <span className="text-ink-subtle">GA </span>
            {gaLabel(patient)}
          </span>
          <span className="tnum">
            <span className="text-ink-subtle">
              G{patient.gravida}P{patient.para}A{patient.abortions}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="h-3.5 w-3.5 text-ink-subtle" />
            {villageLabel(patient)}
          </span>
        </div>
      </PanelBody>
    </Panel>
  );
}

function VisitHistory({ visits }: { visits: Visit[] }) {
  const ordered = [...visits].sort(
    (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
  );

  return (
    <Panel aria-label="Visit history">
      <PanelHeader
        title="Visit history"
        description={`${visits.length} ${visits.length === 1 ? "contact" : "contacts"} recorded`}
        action={<ClipboardIcon className="h-4 w-4 text-ink-subtle" />}
      />
      {ordered.length === 0 ? (
        <EmptyState
          title="No visits recorded"
          description="Record the first ANC contact to start the vitals chart."
        />
      ) : (
        <ol className="divide-y divide-line-soft">
          {ordered.map((visit) => (
            <li key={visit.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-ink">
                  Visit {visit.visitNumber}
                  <span className="ml-2 text-xs font-normal text-ink-subtle">
                    {format(new Date(visit.visitDate), "d MMM yyyy")}
                  </span>
                </p>
                <p className="tnum text-2xs text-ink-subtle">GA {visit.gestationalWeeks} weeks</p>
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded bg-canvas px-2.5 py-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-ink-subtle">BP</dt>
                  <dd className={`tnum text-sm font-semibold ${toneTextClass(bpTone(visit))}`}>
                    {formatBp(visit)}
                  </dd>
                </div>
                <div className="rounded bg-canvas px-2.5 py-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-ink-subtle">Hb</dt>
                  <dd className={`tnum text-sm font-semibold ${toneTextClass(hbTone(visit.hb))}`}>
                    {formatHb(visit)}
                  </dd>
                </div>
                <div className="rounded bg-canvas px-2.5 py-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-ink-subtle">Weight</dt>
                  <dd className="tnum text-sm font-semibold text-ink">
                    {visit.weight ?? "—"}
                    {visit.weight ? <span className="ml-0.5 text-2xs font-normal">kg</span> : null}
                  </dd>
                </div>
                <div className="rounded bg-canvas px-2.5 py-1.5">
                  <dt className="text-2xs uppercase tracking-wide text-ink-subtle">Fetal HR</dt>
                  <dd className="tnum text-sm font-semibold text-ink">
                    {visit.fetalHeartRate ?? "—"}
                    {visit.fetalHeartRate ? (
                      <span className="ml-0.5 text-2xs font-normal">bpm</span>
                    ) : null}
                  </dd>
                </div>
              </dl>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {visit.dangerSigns.length > 0 ? (
                  visit.dangerSigns.map((sign) => (
                    <span key={sign} className="badge badge-red">
                      {dangerSignLabel(sign)}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-green">No danger signs</span>
                )}
                {visit.ifaGiven && <span className="badge badge-gray">IFA</span>}
                {visit.calciumGiven && <span className="badge badge-gray">Calcium</span>}
                {visit.albendazoleGiven && <span className="badge badge-gray">Albendazole</span>}
                {visit.referred && <span className="badge badge-amber">Referred</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PatientDetailsCard({ patient }: { patient: Patient }) {
  const asha = [patient.ashaName, patient.ashaPhone].filter(Boolean).join(" · ") || "Not recorded";
  const ga = gestationalAgeWeeks(patient);

  return (
    <Panel aria-label="Patient details">
      <PanelHeader title="Patient Details" description="Registration and obstetric record" />
      <PanelBody>
        <dl>
          <DetailRow label="Name" value={patient.name} />
          <DetailRow label="Age" value={`${patient.age} years`} />
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
            value={patient.lmp ? format(new Date(patient.lmp), "d MMM yyyy") : "Not set"}
          />
          <DetailRow
            label="EDD"
            value={patient.edd ? format(new Date(patient.edd), "d MMM yyyy") : "Not set"}
          />
          <DetailRow label="GA" value={ga === null ? "Unknown" : `${ga} weeks`} />
          <DetailRow
            label="Registered"
            value={patient.createdAt ? format(new Date(patient.createdAt), "d MMM yyyy") : "—"}
          />
        </dl>
      </PanelBody>
    </Panel>
  );
}

function FollowUpPlanCard({ plan }: { plan: FollowUpItem[] }) {
  return (
    <Panel aria-label="Follow-up plan">
      <PanelHeader
        title="Follow-up Plan"
        description="Generated from the recorded LMP"
        action={<AlertTriangleIcon className="h-4 w-4 text-ink-subtle" />}
      />
      <PanelBody>
        {plan.length === 0 ? (
          <p className="text-sm text-ink-subtle">
            Add an LMP date to generate follow-up dates for this pregnancy.
          </p>
        ) : (
          <ol className="space-y-2">
            {plan.map((item) => (
              <li
                key={item.visitNumber}
                className="flex flex-col gap-2 rounded border border-line px-3 py-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className={`badge ${FOLLOW_UP_BADGE[item.status]} shrink-0`}>
                  {FOLLOW_UP_LABEL[item.status]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    Visit {item.visitNumber} · due {format(item.dueDate, "d MMM yyyy")}
                  </p>
                  <p className="text-xs text-ink-subtle">{item.tests.join(", ")}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}
