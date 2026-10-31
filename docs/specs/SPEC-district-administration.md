# SPEC-district-administration

Status: Approved
Owner: DHS / BHM / Product / Backend + Frontend
Depends on: authz-facility-scope, phi-audit, district-onboarding, matru-suraksha-roles-and-follow-up

## Objective

Give DHS and BHM a controlled way to provision the accounts below them, without
engineering intervention and without widening the facility subtree.

## Scope

- Delegated admin UI and API for DHS and BHM.
- DHS creates BHM and district helpdesk accounts.
- BHM creates ANM, CHO and block helpdesk accounts.
- User edit (name, phone, email, facility) and deactivation.
- Role is fixed after creation; a tier change is deactivate + recreate.
- Facility tree management within the actor's subtree.
- District audit viewer for DHS.

## Non-goals

- Custom roles.
- Hard deletion of users, facilities, or audit records.
- DHS creating ANM/CHO directly or BHM creating BHM/district accounts.

## Functional requirements

- `FR-ADMIN-001`: DHS admin routes are limited to the district subtree; BHM admin routes to the block subtree.
- `FR-ADMIN-002`: create/edit/deactivate users only through the provisioning matrix: DHS -> BHM/HRP_HELPDESK_DISTRICT; BHM -> ANM/CHO/HRP_HELPDESK_BLOCK.
- `FR-ADMIN-003`: password reset issues a one-time password and forces change.
- `FR-ADMIN-004`: facility tree supports BLOCK, CHC/PHC, HWC, VILLAGE nodes.
- `FR-ADMIN-005`: role is immutable after creation; editable fields are name, phone, email and facility.
- `FR-ADMIN-006`: cannot deactivate the last active DHS.
- `FR-ADMIN-007`: all admin actions are audited with before/after digests.
- `FR-ADMIN-008`: audit viewer is read-only and district-scoped.
- `FR-ADMIN-009`: bulk import remains a separate script.

## Testing

- DHS can manage own district; cannot touch another district.
- BHM can create ANM/CHO/block helpdesk in the block; cannot create BHM or district accounts.
- CHO/ANM/helpdesk receive 403 on admin routes.
- Last-DHS protection test.
- Role-change rejection and facility-subtree tests.
- Every admin action emits an audit event.

## Success criteria

- DHS can provision a BHM and district helpdesk end-to-end without engineering.
- BHM can provision the block's field team and block helpdesk.
- No privilege escalation path from CHO, ANM or either helpdesk.
- Admin audit trail complete.

## Boundaries

Always: audit admin actions. Ask first: granting DHS or changing roles. Never: allow cross-district administration.
