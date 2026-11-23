import {
  ANEMIA_GRADE_BADGE,
  ANEMIA_GRADE_LABEL,
  type CreatePatient,
  HRP_COMPLICATIONS,
  type HrpComplication,
  anemiaGradeFromHb,
  getPatientDisplayId,
  hrpReasonForComplication,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FormField, Select } from "../components/ui";
import { ArrowLeftIcon, CalendarIcon, UserPlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { api } from "../lib/api";
import type { LocalPatient } from "../lib/db/local-db";
import { patientRepo } from "../lib/db/repositories";
import { eddFromLmp, gestationalAgeLabel } from "../lib/hrp";
import { useUnsavedChangesGuard } from "../lib/native";
import { useUserRole } from "../lib/session";
import { getCachedSession } from "../lib/session-cache";
import { enqueueOp } from "../lib/sync/queue";

interface FormState {
  name: string;
  phone: string;
  age: string;
  villageId: string;
  lmp: string;
  complications: HrpComplication[];
  referred: boolean;
  referralFacilityType: "CHC_FRU" | "DH";
  /** Haemoglobin reading in g/dL — required when complication includes ANEMIA */
  hb: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  age: "",
  villageId: "",
  lmp: "",
  complications: [],
  referred: false,
  referralFacilityType: "CHC_FRU",
  hb: "",
};

const VILLAGE_LEVELS = new Set(["VILLAGE", "HSC", "HWC"]);

function ComplicationsMultiSelect({
  selected,
  onToggle,
  error,
}: {
  selected: HrpComplication[];
  onToggle: (comp: HrpComplication) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="label">
        Complications{" "}
        <span className="ml-0.5 text-triage-red-solid" aria-hidden="true">
          *
        </span>
        <span className="ml-2 text-xs font-normal text-ink-subtle">(Select all that apply)</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {HRP_COMPLICATIONS.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded border p-2.5 transition-colors ${
                isChecked
                  ? "border-primary bg-primary-light shadow-xs"
                  : "border-line bg-surface hover:bg-canvas"
              }`}
            >
              <input
                type="checkbox"
                value={option.value}
                checked={isChecked}
                onChange={() => onToggle(option.value)}
                className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary-ring"
              />
              <div className="min-w-0">
                <span
                  className={`block text-xs font-semibold ${
                    isChecked ? "text-primary" : "text-ink"
                  }`}
                >
                  {option.label}
                </span>
                <span className="block text-2xs text-ink-subtle leading-tight">{option.hint}</span>
              </div>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="error-text mt-1" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function AnemiaHbSection({
  hb,
  onChangeHb,
  error,
}: {
  hb: string;
  onChangeHb: (val: string) => void;
  error?: string;
}) {
  const hbNum = hb.trim() ? Number(hb) : null;
  const grade = hbNum !== null && !Number.isNaN(hbNum) ? anemiaGradeFromHb(hbNum) : null;

  return (
    <div className="rounded border border-line bg-canvas p-4 space-y-2">
      <FormField label="Haemoglobin (Hb) — g/dL" id="patient-hb" required error={error}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={1}
          max={20}
          value={hb}
          onChange={(e) => onChangeHb(e.target.value)}
          placeholder="e.g. 7.2"
          aria-describedby="hb-hint"
        />
      </FormField>
      <p id="hb-hint" className="text-xs text-ink-subtle">
        Read from the MCP card or latest lab report
      </p>

      {grade && (
        <div className="flex items-center gap-2 pt-1" aria-live="polite">
          <span className={`badge ${ANEMIA_GRADE_BADGE[grade]} text-xs font-semibold`}>
            {ANEMIA_GRADE_LABEL[grade]}
          </span>
        </div>
      )}
    </div>
  );
}

function ReferralSection({
  referred,
  referralFacilityType,
  onSetReferred,
  onSetFacilityType,
}: {
  referred: boolean;
  referralFacilityType: "CHC_FRU" | "DH";
  onSetReferred: (ref: boolean) => void;
  onSetFacilityType: (type: "CHC_FRU" | "DH") => void;
}) {
  return (
    <fieldset>
      <legend className="label">Referring or not?</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded border px-3 py-3 transition-colors ${
            referred
              ? "border-triage-red-solid bg-triage-red-bg"
              : "border-line bg-surface hover:bg-canvas"
          }`}
        >
          <input
            type="radio"
            name="referred"
            value="yes"
            checked={referred}
            onChange={() => onSetReferred(true)}
            className="mt-0.5 h-4 w-4 text-triage-red-solid focus:ring-triage-red-line"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Yes — Refer case</span>
            <span className="block text-xs text-ink-subtle">
              Helpdesk will be notified to complete 15-day follow-up
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded border px-3 py-3 transition-colors ${
            !referred ? "border-primary bg-primary-light" : "border-line bg-surface hover:bg-canvas"
          }`}
        >
          <input
            type="radio"
            name="referred"
            value="no"
            checked={!referred}
            onChange={() => onSetReferred(false)}
            className="mt-0.5 h-4 w-4 text-primary focus:ring-primary-ring"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              No — Routine Field Management
            </span>
            <span className="block text-xs text-ink-subtle">Managed at local HSC cluster</span>
          </span>
        </label>
      </div>

      {referred && (
        <div className="mt-3 rounded border border-line bg-canvas p-3 space-y-2">
          <label
            htmlFor="patient-referral-facility"
            className="label text-xs font-semibold text-ink"
          >
            Referral destination <span className="text-triage-red-solid">*</span>
          </label>
          <select
            id="patient-referral-facility"
            aria-label="Referral destination facility"
            className="input min-h-control"
            value={referralFacilityType}
            onChange={(e) => onSetFacilityType(e.target.value as "CHC_FRU" | "DH")}
          >
            <option value="CHC_FRU">CHC / FRU (Block HRP Helpdesk follow-up)</option>
            <option value="DH">DH / Sadar Hospital (District HRP Helpdesk follow-up)</option>
          </select>
          <p className="text-2xs text-ink-subtle">
            {referralFacilityType === "DH"
              ? "District HRP Helpdesk will be notified to conduct the repeating 15-day contact."
              : "Block HRP Helpdesk will be notified to conduct the repeating 15-day contact."}
          </p>
        </div>
      )}
    </fieldset>
  );
}

export default function AddPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useUserRole();
  const [patientId] = useState(() => crypto.randomUUID());
  const displayId = getPatientDisplayId(patientId);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [duplicate, setDuplicate] = useState<LocalPatient | null>(null);

  useUnsavedChangesGuard(JSON.stringify(form) !== JSON.stringify(INITIAL_FORM));

  const { data: facilities } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.facilities.list(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const villageOptions = useMemo(() => {
    const list = Array.isArray(facilities) ? facilities : [];
    return list
      .filter((facility) => VILLAGE_LEVELS.has(facility.level))
      .map((facility) => ({ value: facility.id, label: facility.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facilities]);

  const isAnemiaSelected = form.complications.includes("ANEMIA");

  const createMutation = useMutation({
    mutationFn: async (data: CreatePatient & { id?: string }) => {
      const id = data.id || patientId;
      const cached = getCachedSession();
      let user = cached?.user;
      if (!user) {
        try {
          user = await api.auth.me();
        } catch {
          throw new Error("Sign in once with a connection before adding a case offline.");
        }
      }
      const facilityId = user?.facilityId ?? "";
      const anmName = user?.name ?? null;
      const now = new Date().toISOString();

      const registrationHb = typeof data.registrationHb === "number" ? data.registrationHb : null;
      const anemiaGrade = anemiaGradeFromHb(registrationHb);

      await patientRepo.upsert({
        id,
        abhaId: data.abhaId ?? null,
        facilityId,
        registeredBy: user?.id ?? "",
        anmName,
        name: data.name,
        age: data.age,
        phone: data.phone ?? null,
        address: data.address ?? null,
        hrpReason: (data.hrpReason ?? null) as string | null,
        hrpComplication: (data.hrpComplication ?? null) as string | null,
        hrpComplications: form.complications,
        registrationHb,
        anemiaGrade,
        ashaName: data.ashaName ?? null,
        ashaPhone: data.ashaPhone ?? null,
        referred: data.referred,
        referralFacilityType: form.referred ? form.referralFacilityType : null,
        isHrp: data.isHrp ?? true,
        followUpTrack: null,
        followUpScheduledDate: null,
        followUpStatus: data.followUpStatus ?? "PENDING",
        lmp: data.lmp ? new Date(data.lmp).toISOString() : null,
        edd: data.edd ? new Date(data.edd).toISOString() : null,
        gravida: data.gravida ?? 0,
        para: data.para ?? 0,
        abortions: data.abortions ?? 0,
        riskFactors: data.riskFactors ?? [],
        riskLevel: "AMBER",
        riskScore: 0,
        isHighRisk: true,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      });
      await enqueueOp({
        entityType: "patient",
        entityId: id,
        op: "create",
        payload: {
          ...data,
          id,
          hrpComplication: form.complications.includes("ANEMIA")
            ? "ANEMIA"
            : (form.complications[0] ?? null),
          hrpComplications: form.complications,
          referralFacilityType: form.referred ? form.referralFacilityType : null,
        },
        clientUpdatedAt: now,
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["hrp"] });
      navigate("/follow-ups");
    },
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "name") setDuplicate(null);
  };

  const toggleComplication = (comp: HrpComplication) => {
    setForm((prev) => {
      const next = prev.complications.includes(comp)
        ? prev.complications.filter((c) => c !== comp)
        : [...prev.complications, comp];
      const hb = next.includes("ANEMIA") ? prev.hb : "";
      return { ...prev, complications: next, hb };
    });
    setErrors((prev) => ({ ...prev, complications: undefined, hb: undefined }));
  };

  const checkForDuplicate = async (name: string) => {
    const facilityId = getCachedSession()?.user.facilityId;
    if (!facilityId || name.trim().length < 3) {
      setDuplicate(null);
      return;
    }
    try {
      const matches = await patientRepo.findByExactName(facilityId, name);
      setDuplicate(matches[0] ?? null);
    } catch {
      setDuplicate(null);
    }
  };

  const lmpDate = form.lmp ? new Date(`${form.lmp}T00:00:00`) : null;
  const validLmp = lmpDate && !Number.isNaN(lmpDate.getTime()) ? lmpDate : null;
  const edd = validLmp ? eddFromLmp(validLmp) : null;

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Enter the mother's full name";

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!phoneDigits) next.phone = "Enter her 10-digit mobile number";
    else if (phoneDigits.length !== 10) next.phone = "Enter a 10-digit mobile number";

    const age = Number(form.age);
    if (!form.age.trim() || Number.isNaN(age) || !Number.isInteger(age)) {
      next.age = "Enter her age in completed years";
    } else if (age < 15 || age > 55) {
      next.age = "Age must be between 15 and 55";
    }

    if (villageOptions.length > 0 && !form.villageId) next.villageId = "Select the village / HWC";
    if (!validLmp) next.lmp = "Enter the last menstrual period date";
    else if (validLmp.getTime() > Date.now()) next.lmp = "LMP cannot be in the future";
    if (form.complications.length === 0)
      next.complications = "Select at least one HRP complication";

    if (isAnemiaSelected) {
      const hbNum = Number(form.hb);
      if (!form.hb.trim() || Number.isNaN(hbNum)) {
        next.hb = "Enter the Hb value (g/dL) from the MCP card";
      } else if (hbNum < 1 || hbNum > 20) {
        next.hb = "Hb must be between 1 and 20 g/dL";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || !validLmp || form.complications.length === 0) return;

    const villageName = villageOptions.find((option) => option.value === form.villageId)?.label;
    const hbNum = form.hb.trim() ? Number(form.hb) : null;
    const primaryComplication = form.complications.includes("ANEMIA")
      ? "ANEMIA"
      : (form.complications[0] ?? null);

    createMutation.mutate({
      id: patientId,
      name: form.name.trim(),
      age: Number(form.age),
      phone: form.phone.replace(/\D/g, ""),
      address: villageName ?? null,
      hrpComplication: primaryComplication,
      hrpComplications: form.complications,
      hrpReason: hrpReasonForComplication(primaryComplication),
      registrationHb: isAnemiaSelected && hbNum !== null && !Number.isNaN(hbNum) ? hbNum : null,
      isHrp: true,
      referred: form.referred,
      referralFacilityType: form.referred ? form.referralFacilityType : null,
      followUpStatus: "PENDING",
      lmp: validLmp,
      edd: eddFromLmp(validLmp),
      ashaName: null,
      ashaPhone: null,
      gravida: 0,
      para: 0,
      abortions: 0,
      riskFactors: [],
    });
  };

  const isBlockRole =
    role === "HRP_HELPDESK_BLOCK" ||
    role === "BHM" ||
    role === "HRP_HELPDESK_DISTRICT" ||
    role === "DHS";
  const title = isBlockRole ? "Add HRP case" : "Add case";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HRP intake"
        title={title}
        description={
          <span className="text-sm text-ink-subtle">
            Unique Patient ID:{" "}
            <span className="badge badge-gray font-mono font-semibold text-ink">{displayId}</span>
          </span>
        }
        actions={
          <Link to="/" className="btn btn-secondary">
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>
        }
      />

      {createMutation.isError && (
        <div
          className="rounded border border-triage-red-line bg-triage-red-bg px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-semibold text-triage-red">Could not save registration</p>
          <p className="text-xs text-ink-muted">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "Check the values and try again"}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-5">
          <Panel className="!border-0">
            <PanelHeader
              title="Mother"
              action={
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light sm:h-14 sm:w-14"
                >
                  <UserPlusIcon className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                </span>
              }
            />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField
                  label="Mother's full name"
                  id="patient-name"
                  required
                  error={errors.name}
                >
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    onBlur={(e) => void checkForDuplicate(e.target.value)}
                    placeholder="Full name"
                  />
                </FormField>
                {duplicate && (
                  <output className="mt-1.5 block text-xs text-triage-amber">
                    A woman named{" "}
                    <Link to={`/patients/${duplicate.id}`} className="font-semibold underline">
                      {duplicate.name}
                    </Link>{" "}
                    is already registered at this facility. Open that case before adding a
                    duplicate.
                  </output>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="patient-phone" className="label">
                  Mobile number
                  <span className="ml-0.5 text-triage-red-solid" aria-hidden="true">
                    *
                  </span>
                </label>
                <div className="flex">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center rounded-l border border-r-0 border-line-strong bg-canvas px-3 text-sm text-ink-muted"
                  >
                    +91
                  </span>
                  <input
                    type="tel"
                    id="patient-phone"
                    required
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="input rounded-l-none"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
                {errors.phone ? (
                  <p
                    id="patient-phone-error"
                    className="error-text"
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.phone}
                  </p>
                ) : (
                  <p className="text-xs text-ink-subtle">
                    Used by the ANM and helpdesk to call back
                  </p>
                )}
              </div>

              <FormField label="Age (completed years)" id="patient-age" required error={errors.age}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={15}
                  max={55}
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                  placeholder="e.g. 24"
                />
              </FormField>

              <Select
                label="Village / HWC"
                id="patient-village"
                required
                placeholder={villageOptions.length === 0 ? "Your facility" : "Select a village"}
                options={villageOptions}
                value={form.villageId}
                onChange={(e) => update("villageId", e.target.value)}
                error={errors.villageId}
              />
            </PanelBody>
          </Panel>

          <Panel className="!border-0">
            <PanelHeader
              title="Pregnancy"
              action={<CalendarIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="space-y-5">
              <div>
                <FormField
                  label="LMP (last menstrual period)"
                  id="patient-lmp"
                  required
                  error={errors.lmp}
                >
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.lmp}
                    onChange={(e) => update("lmp", e.target.value)}
                  />
                </FormField>
                {validLmp && edd ? (
                  <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
                    <span className="badge badge-info">
                      <CalendarIcon className="h-3 w-3" />
                      EDD {format(edd, "d MMM yyyy")}
                    </span>
                    <span className="badge badge-gray">
                      Gestational age {gestationalAgeLabel(validLmp)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* ── Multi-select complications picker ───────────────────────── */}
              <ComplicationsMultiSelect
                selected={form.complications}
                onToggle={toggleComplication}
                error={errors.complications}
              />

              {/* ── Hb field: appears only when Anemia is selected ──────────── */}
              {isAnemiaSelected && (
                <AnemiaHbSection
                  hb={form.hb}
                  onChangeHb={(val) => {
                    setForm((prev) => ({ ...prev, hb: val }));
                    setErrors((prev) => ({ ...prev, hb: undefined }));
                  }}
                  error={errors.hb}
                />
              )}

              {/* ── Referral Section: CHC/FRU or DH dropdown on Yes ────────── */}
              <ReferralSection
                referred={form.referred}
                referralFacilityType={form.referralFacilityType}
                onSetReferred={(ref) => update("referred", ref)}
                onSetFacilityType={(type) => update("referralFacilityType", type)}
              />
            </PanelBody>
          </Panel>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to="/" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add to HRP register"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
