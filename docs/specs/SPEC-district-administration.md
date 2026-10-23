# SPEC-district-administration

Status: Approved
Owner: DHS / Product / Backend + Frontend
Depends on: authz-facility-scope, phi-audit, district-onboarding

## Objective

Give DHS a controlled admin panel to manage district users, facilities, and responsibilities without engineering intervention.

## Scope

- DHS-only admin UI and API.
- User CRUD, role/facility assignment, password reset, deactivation.
- Facility tree management within district.
- Responsibility assignment, including `REFERRAL_NODAL`.
- District audit viewer.

## Non-goals

- BHM administration in the pilot.
- Custom roles.
- Hard deletion of users, facilities, or audit records.

## Functional requirements

- `FR-ADMIN-001`: only DHS can access admin routes and UI; scope is limited to the district subtree.
- `FR-ADMIN-002`: create/edit/deactivate users; assign ANM, CHO, BHM, or DHS and a facility.
- `FR-ADMIN-003`: password reset issues a one-time password and forces change.
- `FR-ADMIN-004`: facility tree supports BLOCK, CHC/PHC, HWC, VILLAGE nodes.
- `FR-ADMIN-005`: assign `REFERRAL_NODAL` at facility, block, or district scope to any active user.
- `FR-ADMIN-006`: cannot deactivate the last active DHS.
- `FR-ADMIN-007`: all admin actions are audited with before/after digests.
- `FR-ADMIN-008`: audit viewer is read-only and district-scoped.
- `FR-ADMIN-009`: bulk import remains a separate script.

## Testing

- DHS can manage own district; cannot touch another district.
- BHM/CHO/ANM receive 403 on admin routes.
- Last-DHS protection test.
- Responsibility grant changes referral visibility.
- Every admin action emits an audit event.

## Success criteria

- DHS can provision a user end-to-end without engineering.
- No privilege escalation path from BHM or CHO.
- Admin audit trail complete.

## Boundaries

Always: audit admin actions. Ask first: granting DHS or changing roles. Never: allow cross-district administration.
