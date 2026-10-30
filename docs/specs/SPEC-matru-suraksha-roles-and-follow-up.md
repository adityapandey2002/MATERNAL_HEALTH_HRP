# SPEC — Matru Suraksha roles, provisioning and 15-day follow-up

Status: accepted (Oct 30 2026)
Supersedes: the three-track (7-day / PMSMA / VHSND) follow-up model and the
standalone referral workflow.

## 1. Product name

The application is **Matru Suraksha**. "HRP" remains the clinical acronym for a
high-risk pregnancy; it is no longer the product name. Every user-facing title,
PWA manifest, loading screen, login screen and document heading uses
**Matru Suraksha**.

## 2. Final role hierarchy

Lowest to highest responsibility:

```
ANM → CHO → HRP_HELPDESK_BLOCK → BHM → HRP_HELPDESK_DISTRICT → DHS
```

- `HELPDESK` is retired. Existing accounts migrate to `HRP_HELPDESK_BLOCK`.
- `ASHA` / `STATE_ADMIN` remain database-only legacy values for inactive rows;
  they are not part of the app role enum.

## 3. Account creation / editing hierarchy

| Creator | May create / edit |
| --- | --- |
| DHS | BHM (one per block), HRP_HELPDESK_DISTRICT (district) |
| BHM | CHO (facility), ANM (HWC / village), HRP_HELPDESK_BLOCK (block) |
| Others | none |

Rules:

- A creator can only act inside their own facility subtree.
- DHS cannot create ANM/CHO directly; BHM cannot create BHM or district staff.
- Helpdesk accounts sign in with email + password. Field/clinician accounts may
  sign in with employee ID or email.
- Every account has an employee ID (auto-generated when not supplied).
- Editing covers name, phone, email and facility. Role is fixed after creation
  (deactivate and recreate to change tier).

## 4. 15-day follow-up rule

Every woman marked `isHrp` enters a repeating 15-day follow-up cycle.

### 4.1 At registration

- `isHrp = true` and `referred = true`:
  - cycle 1 is owned by the **Block HRP Helpdesk** (`HRP_HELPDESK_BLOCK`),
    stage `BLOCK_15_DAY`;
  - due `registration date + 15 days`;
  - if no block helpdesk account exists, fall back to the BHM of that block,
    then to the registering worker.
- `isHrp = true` and `referred = false`:
  - cycle 1 is owned by the registering field worker (ANM/CHO),
    stage `FIELD_15_DAY`, due `registration date + 15 days`.

### 4.2 Field visibility before the block review

A `BLOCK_15_DAY` row is visible in the ANM/CHO follow-up screen in an
**Awaiting block review** section. It is not actionable there: the field worker
cannot close it. This is the "shows but not active" rule.

### 4.3 On completion

When the block helpdesk (or BHM/DHS) marks the initial block follow-up complete:

1. the current row is closed with attribution;
2. a new `FIELD_15_DAY` row is created, due `completion date + 15 days`,
   assigned to the woman's registering ANM/CHO;
3. the same row is visible to the block helpdesk and district in the shared
   line list, and both may close it.

Completing any subsequent cycle repeats step 2: another 15-day cycle starts.
This is the "after that, 15 days again, for ANM/CHO and HRP Helpdesk both" rule.

### 4.4 Escalation

If a cycle's due date passes while it is still `PENDING`, it is **escalated to
the district**: it appears in the DHS / district-helpdesk escalation queue and
counts against district compliance. Escalation is derived from
`status = PENDING AND scheduled_date < today`, so it can never go stale.
`NOT_REACHABLE` keeps the row open and it also escalates when overdue.

### 4.5 Tracks

The three old tracks are removed. `follow_ups.track` now stores the stage:

- `BLOCK_15_DAY`
- `FIELD_15_DAY`

## 5. Referral workflow

The standalone Referrals page and its navigation entry are removed. Referral
status is replaced by the block-owned initial 15-day follow-up above. Clinical
referral notes recorded during a visit remain on the visit record; they no
longer create a separate workflow.

## 6. Dashboards by tier

### CHO (field)

- Existing triage dashboard plus an HRP 15-day follow-up summary: active field
  cycles, awaiting block review, overdue, and next due date.

### BHM / Block HRP Helpdesk

- Block dashboard: total HRPs, block-review pending, field pending, overdue
  escalations (visible for awareness), compliance, 15-day stage breakdown.
- Dispatch box: push selected women to an ANM/CHO with a 15-day due date.
- BHM additionally gets Team & access; block helpdesk does not.

### DHS / District HRP Helpdesk

- District dashboard: district-wide KPIs (total HRPs, escalated, block-review
  pending, field pending, compliance), block-wise breakdown table, and the
  escalation queue of overdue women.
- DHS additionally gets Team & access; district helpdesk does not.

## 7. Permissions

- `followup:manage` — all six roles, scoped to their facility subtree. ANM is
  restricted to their own facility.
- `staff:manage` — BHM and DHS only, with the role matrix in §3.
- `patient:write` / `visit:write` — ANM, CHO, HRP_HELPDESK_BLOCK, BHM.
- Read/dashboard actions — all roles, facility-scoped.

## 8. Out of scope for this change

- Offline sync engine changes.
- Patient/visit clinical forms.
- Deployment URL / Render service names (service stays `hrp-demo`).
