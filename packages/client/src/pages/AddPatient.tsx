import { type CreatePatient, HRP_REASONS, type HrpReason } from "@hrp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FormField, Select } from "../components/ui";
import { ArrowLeftIcon, ClipboardIcon, PhoneIcon, UserPlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { api } from "../lib/api";

interface FormState {
  name: string;
  age: string;
  hrpReason: HrpReason | "";
  referred: boolean;
  ashaName: string;
  ashaPhone: string;
  lmp: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  age: "",
  hrpReason: "",
  referred: false,
  ashaName: "",
  ashaPhone: "",
  lmp: "",
};

const REASON_OPTIONS = HRP_REASONS.map((reason) => ({
  value: reason.value,
  label: reason.label,
}));

export default function AddPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreatePatient) => api.patients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["visits", "dashboard"] });
      navigate("/dashboard");
    },
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Enter the woman's name";
    const age = Number(form.age);
    if (!form.age.trim() || Number.isNaN(age)) next.age = "Enter her age";
    else if (age < 15 || age > 55) next.age = "Age must be between 15 and 55";
    if (!form.hrpReason) next.hrpReason = "Select the reason this pregnancy is high-risk";
    if (form.ashaPhone.trim() && form.ashaPhone.replace(/\D/g, "").length !== 10) {
      next.ashaPhone = "Enter a 10-digit mobile number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    createMutation.mutate({
      name: form.name.trim(),
      age: Number(form.age),
      hrpReason: form.hrpReason || null,
      referred: form.referred,
      isHrp: false,
      followUpStatus: "PENDING",
      ashaName: form.ashaName.trim() || null,
      ashaPhone: form.ashaPhone.replace(/\D/g, "") || null,
      lmp: form.lmp ? new Date(form.lmp) : null,
      gravida: 0,
      para: 0,
      abortions: 0,
      riskFactors: [],
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="High-risk register"
        title="Add HRP Woman"
        description="Register a woman in the high-risk pregnancy cohort. Fields marked * are required."
        actions={
          <Link to="/patients" className="btn btn-secondary">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to register
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
              title="Identity"
              description="The name and age recorded in the ANC register"
              action={<UserPlusIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Name" id="patient-name" required error={errors.name}>
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Full name"
                  />
                </FormField>
              </div>

              <FormField
                label="Age"
                id="patient-age"
                required
                error={errors.age}
                hint="Years, between 15 and 55"
              >
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

              <FormField
                label="LMP (last menstrual period)"
                id="patient-lmp"
                hint="Optional — used for gestational age and follow-up dates"
              >
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.lmp}
                  onChange={(e) => update("lmp", e.target.value)}
                />
              </FormField>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Clinical reason"
              description="Why this pregnancy needs high-risk follow-up"
              action={<ClipboardIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="space-y-5">
              <Select
                label="Reason for high-risk pregnancy"
                id="patient-reason"
                required
                placeholder="Select a reason"
                options={REASON_OPTIONS}
                value={form.hrpReason}
                onChange={(e) => update("hrpReason", e.target.value as HrpReason)}
                error={errors.hrpReason}
              />

              <fieldset>
                <legend className="label">Is she being referred to a higher facility?</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={form.referred}
                    onClick={() => update("referred", true)}
                    className={`min-h-touch rounded border px-4 text-sm font-semibold transition-colors ${
                      form.referred
                        ? "border-triage-red-solid bg-triage-red-bg text-triage-red"
                        : "border-line bg-surface text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    Yes, referred
                  </button>
                  <button
                    type="button"
                    aria-pressed={!form.referred}
                    onClick={() => update("referred", false)}
                    className={`min-h-touch rounded border px-4 text-sm font-semibold transition-colors ${
                      !form.referred
                        ? "border-primary bg-primary-light text-primary-dark"
                        : "border-line bg-surface text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    No, not referred
                  </button>
                </div>
              </fieldset>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Village follow-up"
              description="Who the ANM coordinates with for home visits"
              action={<PhoneIcon className="h-4 w-4 text-ink-subtle" />}
            />
            <PanelBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="ASHA name" id="asha-name" hint="Who follows up in the village">
                <input
                  type="text"
                  autoComplete="off"
                  value={form.ashaName}
                  onChange={(e) => update("ashaName", e.target.value)}
                  placeholder="ASHA worker's name"
                />
              </FormField>

              <FormField label="ASHA mobile number" id="asha-phone" error={errors.ashaPhone}>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={form.ashaPhone}
                  onChange={(e) => update("ashaPhone", e.target.value)}
                  placeholder="10-digit mobile"
                />
              </FormField>
            </PanelBody>
          </Panel>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link to="/patients" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Add"}
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
                  The woman appears in the high-risk register and your field dashboard.
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  An LMP date generates the ANC follow-up schedule automatically.
                </li>
                <li className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  Record the first visit from her patient record to start vitals tracking.
                </li>
              </ul>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody>
              <h2 className="text-sm font-semibold text-ink">Data quality</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                Register the name exactly as written in the ANC card so the ASHA and CHO can match
                records during a referral.
              </p>
            </PanelBody>
          </Panel>
        </aside>
      </form>
    </div>
  );
}
