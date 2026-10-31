import type { CreateStaff, Facility, StaffMember } from "@hrp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { FormField } from "../components/ui/FormField";
import { CheckIcon, InfoIcon, ShieldCheckIcon, UserPlusIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { type ApiError, api } from "../lib/api";
import { canProvisionStaff } from "../lib/nav";
import { ROLE_LABEL, useUserRole } from "../lib/session";

type ProvisionableRole = CreateStaff["role"];

/**
 * Facility levels each provisionable role may be attached to.
 *
 * Mirrors `ROLE_FACILITY_LEVELS` on the server. The server is the authority;
 * this only keeps impossible options out of the dropdown.
 */
const ROLE_FACILITY_LEVELS: Record<ProvisionableRole, string[]> = {
  ANM: ["VILLAGE", "HSC", "HWC"],
  CHO: ["HWC", "PHC", "CHC"],
  HRP_HELPDESK_BLOCK: ["BLOCK", "CHC"],
  BHM: ["BLOCK", "CHC"],
  HRP_HELPDESK_DISTRICT: ["DISTRICT"],
};

const PROVISIONABLE_BY_ACTOR: Record<string, ProvisionableRole[]> = {
  DHS: ["BHM", "HRP_HELPDESK_DISTRICT"],
  BHM: ["ANM", "CHO", "HRP_HELPDESK_BLOCK"],
};

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: ProvisionableRole;
  facilityId: string;
}

interface EditState {
  name: string;
  email: string;
  phone: string;
  facilityId: string;
}

function emptyForm(role: ProvisionableRole): FormState {
  return { name: "", email: "", phone: "", password: "", role, facilityId: "" };
}

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter the person's full name";

  if (!form.email.trim()) errors.email = "Enter the email address they will sign in with";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address";

  if (form.phone.replace(/\D/g, "").length !== 10) errors.phone = "Enter a 10-digit mobile number";
  if (form.password.length < 8) errors.password = "Use at least 8 characters";
  if (!form.facilityId) errors.facilityId = "Choose the facility this account belongs to";

  return errors;
}

function facilitiesForRole(facilities: Facility[], role: ProvisionableRole): Facility[] {
  const levels = ROLE_FACILITY_LEVELS[role];
  return facilities.filter((facility) => levels.includes(facility.level));
}

/**
 * Delegated account provisioning.
 *
 * The hierarchy is DHS → BHM → ANM/CHO, with the block and district HRP
 * helpdesk accounts sitting at the same tier as their officer. A creator only
 * sees the roles below them, and the server re-checks both the role matrix and
 * the facility subtree on every write.
 */
export default function TeamAccessPage() {
  const queryClient = useQueryClient();
  const role = useUserRole();
  const allowed = canProvisionStaff(role);
  const roles = PROVISIONABLE_BY_ACTOR[role] ?? [];
  const defaultRole = roles[0];

  const [form, setForm] = useState<FormState>(() =>
    defaultRole ? emptyForm(defaultRole) : emptyForm("ANM")
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [created, setCreated] = useState<StaffMember | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState>({
    name: "",
    email: "",
    phone: "",
    facilityId: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.staff.list(),
    enabled: allowed,
    retry: false,
  });

  const { data: facilitiesData } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.facilities.list(),
    enabled: allowed,
    retry: false,
  });

  const staff = data?.data ?? [];
  const facilities = facilitiesData ?? [];
  const activeRole: ProvisionableRole = roles.includes(form.role)
    ? form.role
    : (defaultRole ?? "ANM");
  const roleFacilities = useMemo(
    () => facilitiesForRole(facilities, activeRole),
    [facilities, activeRole]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      api.staff.create({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, ""),
        password: form.password,
        role: activeRole,
        facilityId: form.facilityId,
      }),
    onSuccess: (member) => {
      setCreated(member);
      setForm(emptyForm(activeRole));
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; changes: EditState }) =>
      api.staff.update(vars.id, {
        name: vars.changes.name.trim(),
        email: vars.changes.email.trim().toLowerCase(),
        phone: vars.changes.phone.replace(/\D/g, ""),
        facilityId: vars.changes.facilityId,
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => {
      setEditError(
        (error as ApiError | null)?.message ?? "Could not save the account. Check the details."
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.staff.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "role") next.facilityId = "";
      return next;
    });
    setErrors((current) => ({ ...current, [field]: undefined, facilityId: undefined }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createMutation.mutate();
  };

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEditError(null);
    setEditForm({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone,
      facilityId: member.facilityId,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  if (!allowed) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Account" title="Team & access" />
        <Panel>
          <EmptyState
            title="Officer access required"
            description="Only a BHM or DHS can create and edit accounts in this hierarchy."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Team & access"
        description={
          role === "DHS"
            ? "Create BHM and district HRP Helpdesk accounts for this district"
            : "Create ANM, CHO and block HRP Helpdesk accounts for this block"
        }
      />

      {created ? (
        <Panel className="border-triage-green-line bg-triage-green-bg">
          <PanelBody className="space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-triage-green" />
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {ROLE_LABEL[created.role]} account created for {created.name}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Hand over only these credentials. They are tied to this person, so every action in
                  the audit trail carries her name.
                </p>
              </div>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded border border-line bg-surface px-3 py-2">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  Login email
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
        <Panel aria-labelledby="create-account-heading">
          <PanelHeader
            id="create-account-heading"
            title="Create an account"
            description="Role decides the tier; the facility decides the scope"
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
                hint="They sign in with this email or their employee ID"
              >
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="name.block@araria.gov.in"
                />
              </FormField>

              <div className="space-y-1.5">
                <label htmlFor="staff-role" className="label">
                  Role
                  <span className="ml-0.5 text-triage-red-solid" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="staff-role"
                  className="input"
                  value={activeRole}
                  onChange={(event) => update("role", event.target.value as ProvisionableRole)}
                >
                  {roles.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABEL[option]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-subtle">
                  Role is fixed after creation. Deactivate and recreate to move someone to another
                  tier.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="staff-facility" className="label">
                  Facility
                  <span className="ml-0.5 text-triage-red-solid" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="staff-facility"
                  className={`input ${errors.facilityId ? "input-error" : ""}`}
                  aria-invalid={errors.facilityId ? "true" : "false"}
                  aria-describedby={errors.facilityId ? "staff-facility-error" : undefined}
                  value={form.facilityId}
                  onChange={(event) => update("facilityId", event.target.value)}
                >
                  <option value="">Select a facility</option>
                  {roleFacilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} · {facility.level}
                    </option>
                  ))}
                </select>
                {errors.facilityId ? (
                  <p
                    id="staff-facility-error"
                    className="error-text"
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.facilityId}
                  </p>
                ) : (
                  <p className="text-xs text-ink-subtle">
                    Only facilities inside your own scope are listed
                  </p>
                )}
              </div>

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
                  <p id="staff-phone-error" className="error-text" role="alert" aria-live="polite">
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
                hint="At least 8 characters. Share it once, then ask them to change it."
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
                    "Could not create the account. Check the role, facility and email."}
                </p>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  {createMutation.isPending ? "Creating account…" : "Create account"}
                </button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      )}

      <TeamTable
        staff={staff}
        isLoading={isLoading}
        isError={isError}
        role={role}
        roles={roles}
        facilities={facilities}
        editingId={editingId}
        editForm={editForm}
        editError={editError}
        updatePending={updateMutation.isPending}
        deactivatePending={deactivateMutation.isPending}
        onEditFormChange={setEditForm}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSave={(id) => updateMutation.mutate({ id, changes: editForm })}
        onDeactivate={(id) => deactivateMutation.mutate(id)}
      />

      <div className="flex items-start gap-2 rounded border border-info-line bg-info-bg px-4 py-3">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-ink-muted">
          {role === "DHS"
            ? "DHS creates the BHM for each block and the district HRP Helpdesk. Field clinicians and the block helpdesk are created by their BHM."
            : "BHM creates the ANM, CHO and block HRP Helpdesk accounts for this block. BHM and district accounts are created by the DHS."}
        </p>
      </div>
    </div>
  );
}

interface TeamTableProps {
  staff: StaffMember[];
  isLoading: boolean;
  isError: boolean;
  role: string;
  roles: ProvisionableRole[];
  facilities: Facility[];
  editingId: string | null;
  editForm: EditState;
  editError: string | null;
  updatePending: boolean;
  deactivatePending: boolean;
  onEditFormChange: (next: EditState) => void;
  onStartEdit: (member: StaffMember) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onDeactivate: (id: string) => void;
}

function TeamTable({
  staff,
  isLoading,
  isError,
  role,
  roles,
  facilities,
  editingId,
  editForm,
  editError,
  updatePending,
  deactivatePending,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
}: TeamTableProps) {
  return (
    <Panel aria-labelledby="team-list-heading">
      <PanelHeader
        id="team-list-heading"
        title="Team accounts"
        description={
          role === "DHS"
            ? "BHM and district helpdesk accounts in this district"
            : "Field and helpdesk accounts in this block"
        }
        action={<span className="badge badge-gray">{staff.length} accounts</span>}
      />

      {isLoading ? (
        <div className="space-y-2 p-3 sm:p-4" aria-busy="true" aria-label="Loading team">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-line-soft" />
          ))}
        </div>
      ) : null}

      {!isLoading && isError ? (
        <EmptyState
          title="Team list could not load"
          description="The account directory is unavailable right now."
        />
      ) : null}

      {!isLoading && !isError && staff.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Create the first account with the form above."
        />
      ) : null}

      {!isLoading && !isError && staff.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Login</th>
                <th scope="col">Role</th>
                <th scope="col">Facility</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <StaffRow
                  key={member.id}
                  member={member}
                  editable={roles.includes(member.role as ProvisionableRole)}
                  editing={editingId === member.id}
                  editForm={editForm}
                  editError={editError}
                  editFacilities={facilitiesForRole(facilities, member.role as ProvisionableRole)}
                  updatePending={updatePending}
                  deactivatePending={deactivatePending}
                  onEditFormChange={onEditFormChange}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSave={onSave}
                  onDeactivate={onDeactivate}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}

interface StaffRowProps {
  member: StaffMember;
  editable: boolean;
  editing: boolean;
  editForm: EditState;
  editError: string | null;
  editFacilities: Facility[];
  updatePending: boolean;
  deactivatePending: boolean;
  onEditFormChange: (next: EditState) => void;
  onStartEdit: (member: StaffMember) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onDeactivate: (id: string) => void;
}

function StaffRow({
  member,
  editable,
  editing,
  editForm,
  editError,
  editFacilities,
  updatePending,
  deactivatePending,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
}: StaffRowProps) {
  return (
    <Fragment>
      <tr className={member.isActive ? "" : "opacity-60"}>
        <td>
          <p className="font-medium text-ink">{member.name}</p>
          <p className="tnum text-2xs text-ink-subtle">{member.employeeId}</p>
        </td>
        <td className="break-all text-xs text-ink-muted">{member.email ?? "—"}</td>
        <td>
          <span className="badge badge-gray">{ROLE_LABEL[member.role]}</span>
        </td>
        <td className="text-xs text-ink-muted">{member.facilityName ?? "—"}</td>
        <td>
          {member.isActive ? (
            <span className="badge badge-green">Active</span>
          ) : (
            <span className="badge badge-red">Inactive</span>
          )}
        </td>
        <td className="text-right">
          <MemberActions
            member={member}
            editable={editable}
            editing={editing}
            updatePending={updatePending}
            deactivatePending={deactivatePending}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onDeactivate={onDeactivate}
          />
        </td>
      </tr>

      {editing ? (
        <tr>
          <td colSpan={6} className="bg-canvas">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label">Full name</span>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(event) => onEditFormChange({ ...editForm, name: event.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Login email</span>
                <input
                  type="email"
                  className="input"
                  value={editForm.email}
                  onChange={(event) => onEditFormChange({ ...editForm, email: event.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Mobile number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="input"
                  value={editForm.phone}
                  onChange={(event) => onEditFormChange({ ...editForm, phone: event.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="label">Facility</span>
                <select
                  className="input"
                  value={editForm.facilityId}
                  onChange={(event) =>
                    onEditFormChange({ ...editForm, facilityId: event.target.value })
                  }
                >
                  {editFacilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} · {facility.level}
                    </option>
                  ))}
                </select>
              </label>
              {editError ? (
                <p className="text-sm text-triage-red sm:col-span-2" role="alert">
                  {editError}
                </p>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function MemberActions({
  member,
  editable,
  editing,
  updatePending,
  deactivatePending,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeactivate,
}: {
  member: StaffMember;
  editable: boolean;
  editing: boolean;
  updatePending: boolean;
  deactivatePending: boolean;
  onStartEdit: (member: StaffMember) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onDeactivate: (id: string) => void;
}) {
  if (!editable) return <span className="text-2xs text-ink-subtle">—</span>;

  if (editing) {
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={updatePending}
          onClick={() => onSave(member.id)}
        >
          Save
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelEdit}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label={`Edit ${member.name}`}
        onClick={() => onStartEdit(member)}
      >
        Edit
      </button>
      {member.isActive ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={`Deactivate ${member.name}`}
          disabled={deactivatePending}
          onClick={() => onDeactivate(member.id)}
        >
          Deactivate
        </button>
      ) : null}
    </div>
  );
}
