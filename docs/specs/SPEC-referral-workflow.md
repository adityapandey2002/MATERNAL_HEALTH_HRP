# SPEC-referral-workflow

Status: Superseded (Oct 30 2026)
Superseded by: `SPEC-matru-suraksha-roles-and-follow-up.md`
Owner: Clinical Lead + Backend
Depends on: authz-facility-scope, district-administration, phi-audit

> **Superseded.** The standalone Referrals page, navigation entry and state
> machine are retired. A referred HRP now starts with the Block HRP Helpdesk's
> first 15-day cycle, and clinical referral notes stay on the visit record. The
> referral API remains available for authorization and data compatibility, but
> no app screen calls it. The rest of this document is kept as historical
> context; do not implement new workflow against it.

## Objective

Track a pregnant woman's referral from identification to acknowledgement and completion, with clinical routing and nodal oversight.

## Scope

- Clinical referral creation, destination, urgency, reason, notes.
- State machine and acknowledgement by destination role or assigned nodal.
- Block and district nodal visibility.
- Audit of views and transitions.

## Non-goals

- Ambulance dispatch or SMS in v1.
- External hospital system integration.

## Functional requirements

- `FR-REF-001`: ANM/CHO creates a referral with destination facility, urgency, reason, and notes.
- `FR-REF-002`: destination acknowledgement: CHO at HWC, BHM at CHC/block hospital, DHS at district hospital.
- `FR-REF-003`: any user granted `REFERRAL_NODAL` for the destination facility can acknowledge.
- `FR-REF-004`: block nodal sees all block referrals; district nodal sees all district referrals.
- `FR-REF-005`: ANM sees own outbound; CHO sees HWC referrals.
- `FR-REF-006`: states are PENDING, ACKNOWLEDGED, COMPLETED, CANCELLED with role-valid transitions.
- `FR-REF-007`: creator may cancel before acknowledgement; acknowledger or DHS may cancel after.
- `FR-REF-008`: every view and transition is audited.
- `FR-REF-009`: RED urgency is visually distinct and sorted first.

## Testing

- State-machine tests for every transition and role.
- Destination-role acknowledgement tests.
- Nodal visibility tests for block and district.
- Cross-facility denial tests.
- Audit event assertions.

## Success criteria

- Referral reaches the correct destination role.
- No user sees a referral outside scope or nodal grant.
- Referral timestamps support the <48h metric.

## Boundaries

Always: audit transitions. Ask first: new states or destinations. Never: allow acknowledgement outside scope.
