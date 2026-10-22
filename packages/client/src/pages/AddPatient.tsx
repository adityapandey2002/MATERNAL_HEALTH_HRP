import { type CreatePatient, HRP_REASONS, type HrpReason } from "@hrp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FormField, Select } from "../components/ui";
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
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["visits", "dashboard"] });
      navigate(`/patients/${saved.id}`);
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-green-700 hover:text-green-800">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Add HRP Woman</h1>
        <p className="text-gray-500">
          Register a high-risk pregnancy in under a minute. Only the name and reason are needed.
        </p>
      </div>

      {createMutation.isError && (
        <div className="card border border-red-200 bg-red-50 p-4" role="alert" aria-live="polite">
          <p className="text-sm font-medium text-red-700">
            Could not save the registration. Check the details and try again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Who is she?</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="sm:col-span-2">
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
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Referral</h2>
          </div>
          <div className="card-body space-y-3">
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">
                Is she being referred to a higher facility?
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={form.referred}
                  onClick={() => update("referred", true)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    form.referred
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Yes, referred
                </button>
                <button
                  type="button"
                  aria-pressed={!form.referred}
                  onClick={() => update("referred", false)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    !form.referred
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  No, not referred
                </button>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">ASHA worker</h2>
          </div>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>

        <details className="card">
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-gray-700">
            Add clinical detail (optional)
          </summary>
          <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100">
            <FormField
              label="LMP (last menstrual period)"
              id="patient-lmp"
              hint="Used to work out gestational age and follow-up dates"
            >
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.lmp}
                onChange={(e) => update("lmp", e.target.value)}
              />
            </FormField>
          </div>
        </details>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link to="/" className="btn btn-outline justify-center">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary btn-lg justify-center"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Saving…" : "Save HRP registration"}
          </button>
        </div>
      </form>
    </div>
  );
}
