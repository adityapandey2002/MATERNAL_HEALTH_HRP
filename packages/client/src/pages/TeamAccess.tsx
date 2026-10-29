import type { StaffMember } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { CheckIcon, InfoIcon, ShieldCheckIcon, UserPlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { type ApiError, api } from "../lib/api";
import { ROLE_LABEL, useIsNodalRole } from "../lib/session";

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const INITIAL_FORM: FormState = { name: "", email: "", phone: "", password: "" };

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter the operator's full name";

  if (!form.email.trim()) errors.email = "Enter the email address she will sign in with";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address";

  if (form.phone.replace(/\D/g, "").length !== 10)
    errors.phone = "Enter a 10-digit mobile number";
  if (form.password.length < 8) errors.password = "Use at least 8 characters";

  return errors;
}

/**
 * Page 4 of the oversight app: provision the HRP Helpdesk.
 *
 * The block officer sets an email and password for the operator. Those
 * credentials — not a shared block login — are what grant the helpdesk account
 * access, so every status change on the shared line list carries her name.
 */
export default function TeamAccessPage() {
  const queryClient = useQueryClient();
  const nodalRole = useIsNodalRole();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [created, setCreated] = useState<StaffMember | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.staff.list(),
    enabled: nodalRole,
    retry: false,
  });

  const staff = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      api.staff.create({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
        role: "HELPDESK",
      }),
    onSuccess: (member) => {
      setCreated(member);
      setForm(INITIAL_FORM);
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.staff.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Team & access"
        description="Provision the HRP Helpdesk with an email and password only she holds"
      />

      {!nodalRole ? (
        <Panel>
          <EmptyState
            title="Nodal access required"
            description="Only a Block Nodal officer or district officer can create HRP Helpdesk accounts."
          />
        </Panel>
      ) : (
        <>
          {created ? (
            <Panel className="border-triage-green-line bg-triage-green-bg">
              <PanelBody className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-triage-green" />
                  <div>
                    <h2 className="text-sm font-semibold text-ink">
                      Helpdesk login created for {created.name}
                    </h2>
                    <p className="mt-1 text-xs text-ink-muted">
                      Hand over only these credentials. They are the account's access — no shared
                      block login works.
                    </p>
                  </div>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded border border-line bg-surface px-3 py-2">
                    <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      Email
                    </dt>
                    <dd className="mt-0.5 break-all font-medium text-ink">{created.email}</dd>
                  </div>
                  <div className="rounded border border-line bg-surface px-3 py-2">
                    <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      Employee ID
                    </dt>
                    <dd className="tnum mt-0.5 font-medium text-ink">{created.employeeId}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCreated(null)}
                >
                  Create another account
                </button>
              </PanelBody>
            </Panel>
          ) : (
            <Panel aria-labelledby="create-helpdesk-heading">
              <PanelHeader
                id="create-helpdesk-heading"
                title="Create HRP Helpdesk account"
                description="Email + password credentials"
                action={<UserPlusIcon className="h-4 w-4 text-ink-subtle" />}
              />
              <PanelBody>
                <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
                  <FormField
                    label="Full name"
                    id="staff-name"
                    required
                    error={errors.name}
                    hint="The name that appears in the line list attribution"
                  >
                    <input
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      placeholder="e.g. Amit Kumar"
                    />
                  </FormField>

                  <FormField
                    label="Login email"
                    id="staff-email"
                    required
                    error={errors.email}
                    hint="She signs in with this email instead of an employee ID"
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="helpdesk.daskroi@araria.gov.in"
                    />
                  </FormField>

                  <div className="space-y-1.5">
                    <label htmlFor="staff-phone" className="label">
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
                        id="staff-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        className={`input rounded-l-none ${errors.phone ? "input-error" : ""}`}
                        aria-invalid={errors.phone ? "true" : "false"}
                        aria-describedby={errors.phone ? "staff-phone-error" : undefined}
                        value={form.phone}
                        onChange={(event) => update("phone", event.target.value)}
                        placeholder="10-digit mobile"
                      />
                    </div>
                    {errors.phone ? (
                      <p
                        id="staff-phone-error"
                        className="error-text"
                        role="alert"
                        aria-live="polite"
                      >
                        {errors.phone}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-subtle">Used for callback coordination</p>
                    )}
                  </div>

                  <FormField
                    label="Password"
                    id="staff-password"
                    required
                    error={errors.password}
                    hint="At least 8 characters. Share it once, then ask her to change it."
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) => update("password", event.target.value)}
                      placeholder="Set a temporary password"
                    />
                  </FormField>

                  {createMutation.isError ? (
                    <p
                      className="rounded border border-triage-red-line bg-triage-red-bg px-3 py-2 text-sm text-triage-red sm:col-span-2"
                      role="alert"
                    >
                      {(createMutation.error as ApiError | null)?.message ??
                        "Could not create the account. Check the email and try again."}
                    </p>
                  ) : null}

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={createMutation.isPending}
                    >
                      <ShieldCheckIcon className="h-4 w-4" />
                      {createMutation.isPending ? "Creating account…" : "Create helpdesk login"}
                    </button>
                  </div>
                </form>
              </PanelBody>
            </Panel>
          )}

          <Panel aria-labelledby="team-list-heading">
            <PanelHeader
              id="team-list-heading"
              title="Team accounts"
              description="HRP Helpdesk logins in this block"
              action={<span className="badge badge-gray">{staff.length} accounts</span>}
            />
            {isLoading ? (
              <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading team">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-12 animate-pulse rounded bg-line-soft" />
                ))}
              </div>
            ) : isError ? (
              <EmptyState
                title="Team list could not load"
                description="The account directory is unavailable right now."
              />
            ) : staff.length === 0 ? (
              <EmptyState
                title="No accounts yet"
                description="Create the first HRP Helpdesk login with the form above."
              />
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Login</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((member) => (
                      <tr key={member.id} className={member.isActive ? "" : "opacity-60"}>
                        <td>
                          <p className="font-medium text-ink">{member.name}</p>
                          <p className="tnum text-2xs text-ink-subtle">{member.employeeId}</p>
                        </td>
                        <td className="break-all text-xs text-ink-muted">
                          {member.email ?? "—"}
                        </td>
                        <td>
                          <span className="badge badge-gray">{ROLE_LABEL[member.role]}</span>
                        </td>
                        <td>
                          {member.isActive ? (
                            <span className="badge badge-green">Active</span>
                          ) : (
                            <span className="badge badge-red">Inactive</span>
                          )}
                        </td>
                        <td className="text-right">
                          {member.role === "HELPDESK" && member.isActive ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              aria-label={`Deactivate ${member.name}`}
                              disabled={deactivateMutation.isPending}
                              onClick={() => deactivateMutation.mutate(member.id)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span className="text-2xs text-ink-subtle">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="flex items-start gap-2 rounded border border-info-line bg-info-bg px-4 py-3">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p className="text-xs leading-relaxed text-ink-muted">
              Helpdesk accounts can close follow-ups and work the shared line list, but cannot
              create other logins or change clinical records. ANM and CHO accounts stay on the
              district provisioning process.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
