import {
  type CreatePatient,
  HRP_COMPLICATIONS,
  type HrpComplication,
  hrpReasonForComplication,
} from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FormField, Select } from "../components/ui";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClipboardIcon,
  MapPinIcon,
  PhoneIcon,
  UserPlusIcon,
} from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { api } from "../lib/api";
import { eddFromLmp, gestationalAgeLabel } from "../lib/hrp";
import { useUserRole } from "../lib/session";

interface FormState {
  name: string;
  phone: string;
  age: string;
  villageId: string;
  lmp: string;
  complication: HrpComplication | "";
  referred: boolean;
}

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  age: "",
  villageId: "",
  lmp: "",
  complication: "",
  referred: false,
};

const COMPLICATION_OPTIONS = HRP_COMPLICATIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

const VILLAGE_LEVELS = new Set(["VILLAGE", "HSC", "HWC"]);

export default function AddPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useUserRole();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

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

  const createMutation = useMutation({
    mutationFn: (data: CreatePatient) => api.hrp.patients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["hrp", "patients"] });
      queryClient.invalidateQueries({ queryKey: ["hrp", "follow-ups"] });
      navigate("/follow-ups");
    },
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
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
    if (!form.complication) next.complication = "Select the HRP complication";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || !validLmp || !form.complication) return;

    const villageName = villageOptions.find((option) => option.value === form.villageId)?.label;

    createMutation.mutate({
      name: form.name.trim(),
      age: Number(form.age),
      phone: form.phone.replace(/\D/g, ""),
      address: villageName ?? null,
      hrpComplication: form.complication,
      hrpReason: hrpReasonForComplication(form.complication),
      isHrp: true,
      referred: form.referred,
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

  const isBlockRole = role === "HELPDESK" || role === "BHM" || role === "DHS";
  const title = isBlockRole ? "Add HRP case" : "Add case";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HRP intake"
        title={title}
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
          aria-live="polite"
        >
          <p className="text-sm font-medium text-triage-red">
            Could not save the registration. Check the details and try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader
              title="Woman and household"
              action={<UserPlusIcon className="h-4 w-4 text-ink-subtle" />}
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
                    placeholder="Full name"
                  />
                </FormField>
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
                    id="patient-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className={`input rounded-l-none ${errors.phone ? "input-error" : ""}`}
                    aria-invalid={errors.phone ? "true" : "false"}
                    aria-describedby={errors.phone ? "patient-phone-error" : undefined}
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

          <Panel>
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

              <Select
                label="Complication"
                id="patient-complication"
                required
                placeholder="Select the HRP complication"
                options={COMPLICATION_OPTIONS}
                value={form.complication}
                onChange={(e) => update("complication", e.target.value as HrpComplication)}
                error={errors.complication}
              />

              <fieldset>
                <legend className="label">Referring or not?</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded border px-3 py-3 transition-colors ${
                      form.referred
                        ? "border-triage-red-solid bg-triage-red-bg"
                        : "border-line bg-surface hover:bg-canvas"
                    }`}
                  >
                    <input
                      type="radio"
                      name="referred"
                      value="yes"
                      checked={form.referred}
                      onChange={() => update("referred", true)}
                      className="mt-0.5 h-4 w-4 text-triage-red-solid focus:ring-triage-red-line"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        {isBlockRole ? "Refer to Sadar hospital" : "Yes — Refer to CHC/FRU"}
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        {isBlockRole
                          ? "Escalates to District Sadar Hospital for specialist care"
                          : "Escalates to the Block Nodal HRP Helpdesk and the BHM panel"}
                      </span>
                    </span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded border px-3 py-3 transition-colors ${
                      !form.referred
                        ? "border-primary bg-primary-light"
                        : "border-line bg-surface hover:bg-canvas"
                    }`}
                  >
                    <input
                      type="radio"
                      name="referred"
                      value="no"
                      checked={!form.referred}
                      onChange={() => update("referred", false)}
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-primary-ring"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        {isBlockRole ? "Not needed" : "No — Routine Field Management"}
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        {isBlockRole
                          ? "Managed at block CHC / routine follow-up"
                          : "Managed at the village HSC cluster"}
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
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
              {createMutation.isPending ? "Saving…" : "Add to HRP register"}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel className="bg-primary-light">
            <PanelBody className="space-y-2">
              <h2 className="text-sm font-semibold text-primary-dark">What happens after saving</h2>
              <ul className="space-y-2 text-sm text-ink-muted">
                <li className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  She joins the HRP register for your village cluster.
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  The earliest track — 7-day MO review, next PMSMA, or VHSND — is scheduled for her.
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {isBlockRole
                    ? "Referred cases escalate to the District Sadar Hospital panel."
                    : "Referred cases appear on the Block Nodal helpdesk and BHM panel."}
                </li>
              </ul>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <MapPinIcon className="h-4 w-4 text-ink-subtle" />
                Village mapping
              </h2>
              <p className="text-xs leading-relaxed text-ink-subtle">
                The village you pick maps the woman to her Health & Wellness Sub-Center, so
                follow-up lists reach the right ANM.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <PhoneIcon className="h-4 w-4 text-ink-subtle" />
                Call-back number
              </h2>
              <p className="text-xs leading-relaxed text-ink-subtle">
                The mobile number is what the ANM and HRP Helpdesk dial when a contact is not
                reachable.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ClipboardIcon className="h-4 w-4 text-ink-subtle" />
                Complication drives risk
              </h2>
              <p className="text-xs leading-relaxed text-ink-subtle">
                Every complication scores her AMBER or above, so no HRP registration is silently
                marked low risk.
              </p>
            </PanelBody>
          </Panel>
        </aside>
      </form>
    </div>
  );
}
