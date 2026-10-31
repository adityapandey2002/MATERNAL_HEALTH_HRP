# Matru Suraksha — API & Interface Documentation

**Product:** Matru Suraksha — multi-tier high-risk pregnancy care for India's public health system  
**Stack:** React + Vite + TypeScript, Vitest, Playwright, Fastify/Node, PostgreSQL  
**Documentation Status:** Complete  
**Last Updated:** Fri Oct 30 2026  
**Binding rules:** [`docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md`](docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md)

---

## 1. Overview

Matru Suraksha serves six roles across India's public health system:

| Tier | Role | Primary Interface | Responsibility |
|------|------|-------------------|----------------|
| Field | ANM (Auxiliary Nurse Midwife) | Mobile PWA (offline-first) | Patient capture, HRP identification, vitals, 15-day follow-up execution |
| Field triage | CHO (Community Health Officer) | Desktop Dashboard | Patient line list, risk triage, 15-day follow-up execution |
| Block helpdesk | `HRP_HELPDESK_BLOCK` | Desktop Dashboard | Block-owned first follow-up for referred HRPs, shared line list |
| Block supervision | BHM (Block Health Manager) | Desktop Dashboard | Block dashboard, dispatch box, Team & access |
| District helpdesk | `HRP_HELPDESK_DISTRICT` | Desktop Dashboard | District line list and escalation queue |
| District supervision | DHS (District Health Officer) | Desktop Dashboard | District KPIs, escalation queue, Team & access |

Two rules drive the operational model:

- **Follow-up is a repeating 15-day cycle.** A referred HRP starts with the Block HRP
  Helpdesk (`BLOCK_15_DAY`); every later cycle is a field cycle (`FIELD_15_DAY`)
  worked by the registering ANM/CHO and visible to the block at the same time.
- **The standalone referral workflow is retired.** Referral notes stay on the visit
  record. The referral endpoints remain available for authorization and data
  compatibility, but no app screen calls them.

---

## 2. Domain Types

### 2.1 User Roles

Six roles, lowest to highest responsibility:

```typescript
export const UserRole = z.enum([
  "ANM",
  "CHO",
  "HRP_HELPDESK_BLOCK",
  "BHM",
  "HRP_HELPDESK_DISTRICT",
  "DHS",
]);
export type UserRole = z.infer<typeof UserRole>;
```

`HELPDESK` is retired; migration `007_matru_suraksha_roles` rewrites existing
rows to `HRP_HELPDESK_BLOCK`. `ASHA` and `STATE_ADMIN` remain database-only
legacy values for inactive rows and are not part of the app enum.

### 2.2 Nodal Designation (Block / District)

"Block Nodal" is the BHM; "District Nodal" is the DHS. The
`user_nodal_designations` grant is retained for referral routing and for the
legacy nodal dashboard/field-level endpoints. It does not create a seventh
role and it is not the account-creation hierarchy — see §5.3.

```typescript
export const NodalLevel = z.enum(["BLOCK", "DISTRICT"]);
export type NodalLevel = z.infer<typeof NodalLevel>;

export const UserNodalSchema = z.object({
  userId: z.string().uuid(),
  nodalLevel: NodalLevel,      // "BLOCK" or "DISTRICT"
  facilityId: z.string().uuid(), // block facility or district facility
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
```

### 2.3 HRP Complication Dropdown — EXACT 8 Values

The complication dropdown contains **exactly 8 values in this exact sequence**. No additional values, no reordering.

| Index | Value | Display Label |
|-------|-------|---------------|
| 1 | `ANEMIA` | Anemia |
| 2 | `PIH` | PIH (Pregnancy-Induced Hypertension) |
| 3 | `GDM` | GDM (Gestational Diabetes Mellitus) |
| 4 | `SHORT_STATURE` | Short stature |
| 5 | `PRE_LSCS` | Pre-LSCS (Previous Lower Segment Cesarean Section) |
| 6 | `MULTI_GRAVIDA` | Multi gravida |
| 7 | `TWINS_MULTIPLE_PREGNANCY` | Twins/Multiple Pregnancy |
| 8 | `TEENAGE_PREGNANCY` | Teenage Pregnancy |

```typescript
export const HrpComplication = z.enum([
  "ANEMIA",
  "PIH",
  "GDM",
  "SHORT_STATURE",
  "PRE_LSCS",
  "MULTI_GRAVIDA",
  "TWINS_MULTIPLE_PREGNANCY",
  "TEENAGE_PREGNANCY",
]);
export type HrpComplication = z.infer<typeof HrpComplication>;
```

### 2.4 Follow-Up Status

Three statuses only:

| Value | Meaning |
|-------|---------|
| `PENDING` | Follow-up not yet completed; escalates when `scheduledDate` passes |
| `COMPLETE` | Follow-up completed by the owning tier; starts the next 15-day cycle |
| `NOT_REACHABLE` | Patient could not be reached; stays open and escalates when overdue |

```typescript
export const HrpFollowUpStatus = z.enum(["COMPLETE", "PENDING", "NOT_REACHABLE"]);
export type HrpFollowUpStatus = z.infer<typeof HrpFollowUpStatus>;
```

### 2.5 Follow-Up Stage (15-Day Cycle)

```typescript
export const HrpFollowUpTrack = z.enum([
  "BLOCK_15_DAY",   // First cycle of a referred HRP, owned by the Block HRP Helpdesk
  "FIELD_15_DAY",   // Every later cycle, worked by ANM/CHO and visible to the block
]);
export type HrpFollowUpTrack = z.infer<typeof HrpFollowUpTrack>;

/** Length of one HRP follow-up cycle, in days. */
export const HRP_FOLLOW_UP_WINDOW_DAYS = 15;
```

The three old tracks (`IMMEDIATE_7_DAYS`, `PMSMA_SESSION`, `VHSND_COMMUNITY`)
are removed. `follow_ups.track` stores the stage above; `patients.follow_up_track`
mirrors it for the patient summary.


### 2.6 Facility Level

```typescript
export const FacilityLevel = z.enum([
  "VILLAGE", "HSC", "HWC", "PHC", "CHC", "BLOCK", "DISTRICT", "STATE",
]);
export type FacilityLevel = z.infer<typeof FacilityLevel>;
```

---

## 3. Patient Schema (Add Form Fields)

The Add Patient form collects exactly these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Patient name |
| `phone` | string | Yes | Mobile number (min 10 digits) |
| `age` | number | Yes | Age (15–55) |
| `address` | string | Yes | Village label picked from the HWC list; the owning facility comes from the access token |
| `lmp` | string \| null | No | Last Menstrual Period (ISO datetime) |
| `hrpComplication` | HrpComplication \| null | No | Dropdown - exactly 8 values above |
| `referred` | boolean | Yes | "Referring or not" toggle — when true, the first 15-day cycle is owned by the Block HRP Helpdesk (`BLOCK_15_DAY`) |

```typescript
export const PatientSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),          // owning HWC/facility (from the token)
  registeredBy: z.string().uuid(),        // ANM/CHO user ID who registered
  name: z.string().min(1),
  age: z.number().int().min(15).max(55),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(), // village label captured by intake
  hrpReason: HrpReason.nullable().optional(),
  hrpComplication: HrpComplication.nullable().optional(),
  referred: z.boolean().default(false),
  isHrp: z.boolean().default(false),      // marked HRP by ANM/CHO
  // Follow-up is AUTOMATED — no manual toggle
  followUpTrack: HrpFollowUpTrack.nullable().optional(),
  followUpScheduledDate: DateInput.nullable().optional(),
  followUpStatus: HrpFollowUpStatus.default("PENDING"),
  createdAt: DateInput,
  updatedAt: DateInput,
});
```

### Create Patient Input (API Boundary)

```typescript
interface CreatePatientInput {
  name: string;
  phone: string;
  age: number;
  address: string;           // village label from the HWC list
  lmp: string | null;        // ISO datetime
  hrpComplication: HrpComplication | null;
  referred: boolean;
  isHrp: boolean;            // the Add HRP case flow always sets true
}
```

`facilityId` and `registeredBy` are derived from the access token and are not
accepted from the client.

---

## 4. Follow-Up Schema

```typescript
export const FollowUpSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),   // current owner: field worker or block helpdesk
  assignedByUserId: z.string().uuid(),   // who created the cycle (registration or completion)
  level: z.enum(["BLOCK_NODAL", "CHO", "ANM"]),
  status: HrpFollowUpStatus.default("PENDING"),
  track: HrpFollowUpTrack,               // BLOCK_15_DAY | FIELD_15_DAY
  scheduledDate: z.string().datetime(),  // due date: start + 15 days
  completedAt: z.string().datetime().nullable(),
  completedByUserId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Follow-Up List Item (shared line list)

```typescript
interface FollowUpListItem extends FollowUp {
  patientName: string;
  patientAge: number;
  patientPhone: string | null;
  patientRiskLevel: "GREEN" | "AMBER" | "RED";
  hrpComplication: HrpComplication | null;
  village: string | null;
  blockName: string | null;              // block roll-up for district views
  assignedToName: string | null;
  assignedToRole: string | null;
  completedByName: string | null;
  completedByRole: string | null;
}
```

The server joins the patient and attribution fields; the client never re-fetches
users just to label a row. `blockName` is required for the district line list and
escalation table.

### Dispatch Input

```typescript
export const DispatchFollowUpSchema = z.object({
  patientIds: z.array(z.string().uuid()).min(1).max(100),
  assignedToUserId: z.string().uuid(),
  scheduledDate: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
});
```

There is no `track` field. The server always writes `FIELD_15_DAY`; when
`scheduledDate` is omitted the due date is today + 15 days.

### Follow-Up with Patient (for Panel View)

```typescript
interface FollowUpWithPatient extends FollowUp {
  patient: Patient;
  referredByAnmName?: string;  // ANM name shown in bottom right corner on panel
}
```


---

## 5. REST API Endpoints

All endpoints follow REST conventions: plural nouns, no verbs in URLs. Query parameters use camelCase. Boolean fields prefixed with `is/has/can`. Enum values `UPPER_SNAKE`.

### 5.1 Patient Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `POST` | `/api/hrp/patients` | Create new patient (Add Form) | ANM, CHO, HRP_HELPDESK_BLOCK, BHM |
| `GET` | `/api/hrp/patients` | List patients with filters | All six roles (facility-scoped) |
| `GET` | `/api/hrp/patients/:id` | Get single patient | All six roles (facility-scoped) |
| `PATCH` | `/api/hrp/patients/:id` | Partial update patient | ANM, CHO, HRP_HELPDESK_BLOCK, BHM |
| `PATCH` | `/api/hrp/patients/:id/hrp` | Mark/unmark patient as HRP; marking schedules the first 15-day cycle | ANM, CHO, HRP_HELPDESK_BLOCK, BHM |

`facilityId` and `registeredBy` are always taken from the access token. ANM is
restricted to its own facility; the other writer roles act inside their facility
subtree.

### 5.2 Follow-Up Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/follow-ups` | List follow-ups with filters; returns `FollowUpListItem[]` including `blockName` | All six roles (facility-scoped) |
| `GET` | `/api/hrp/follow-ups/panel` | Panel view: HRP-referred patients | ANM, CHO, HRP_HELPDESK_BLOCK, BHM, HRP_HELPDESK_DISTRICT, DHS |
| `GET` | `/api/hrp/follow-ups/field` | Field-level follow-ups assigned to the caller (only when the district list is active) | ANM, CHO |
| `POST` | `/api/hrp/follow-ups/dispatch` | Push selected women to an ANM/CHO with a 15-day due date; server writes `FIELD_15_DAY` | BHM, HRP_HELPDESK_BLOCK |
| `GET` | `/api/hrp/follow-ups/:id` | Get one follow-up | All six roles (facility-scoped) |
| `PATCH` | `/api/hrp/follow-ups/:id` | Update status to `COMPLETE` / `PENDING` / `NOT_REACHABLE`; `COMPLETE` starts the next cycle | All six roles (ANM own facility) |

There is no `POST /api/hrp/follow-ups/schedule`: the first cycle is created when
the patient is registered with `isHrp = true` or marked HRP, and every later
cycle is created by completion.

`GET /api/hrp/follow-ups` filters: `status`, `track`, `assignedToUserId`,
`patientId`, `facilityId`, `dueBefore`, `dueAfter`, `search`, plus pagination.

### 5.3 Staff and Access

Only BHM and DHS reach this surface. The role, not the JWT claim, decides what
the account can do afterwards; role is fixed after creation.

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/staff` | List accounts in the caller's facility subtree | BHM, DHS |
| `POST` | `/api/staff` | Create an account; `role` and `facilityId` are required | BHM, DHS (per matrix below) |
| `PATCH` | `/api/staff/:id` | Edit `name`, `phone`, `email` or `facilityId` | BHM, DHS (per matrix below) |
| `PATCH` | `/api/staff/:id/deactivate` | Deactivate an account; cannot deactivate self | BHM, DHS |

Provisioning matrix:

| Creator | May create / edit |
|---------|-------------------|
| DHS | BHM (one per block), `HRP_HELPDESK_DISTRICT` (district) |
| BHM | CHO (facility), ANM (HWC / village), `HRP_HELPDESK_BLOCK` (block) |
| Others | none |

`POST /api/staff` body:

```typescript
export const CreateStaffSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(120),
  phone: z.string().regex(/^\d{10}$/),
  password: z.string().min(8).max(72),
  role: z.enum(["ANM", "CHO", "HRP_HELPDESK_BLOCK", "BHM", "HRP_HELPDESK_DISTRICT"]),
  facilityId: z.string().uuid(),
});
```

`PATCH /api/staff/:id` body (at least one field):

```typescript
export const UpdateStaffSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().max(120).optional(),
    phone: z.string().regex(/^\d{10}$/).optional(),
    facilityId: z.string().uuid().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined));
```

Helpdesk accounts sign in with email + password; field/clinician accounts may
sign in with employee ID or email. Every account gets an auto-generated employee
ID when one is not supplied.

### 5.4 Nodal Dashboard (Block & District)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/nodal/dashboard` | Block/district dashboard stats | BHM (block), DHS (district), with an active nodal designation |
| `GET` | `/api/hrp/nodal/anms-offline` | ANMs offline > 48h | BHM, DHS, with an active nodal designation |

These endpoints predate the role hierarchy and still check
`user_nodal_designations` for the requested facility.

### 5.5 Field-Level Activation (Retained API — Superseded)

Field-level visibility is now automatic: every HRP has an open 15-day cycle,
and the block's shared line list already includes the field stage. The old
district activation gate is no longer part of the workflow. The endpoints below
are kept for data compatibility; no app screen calls them.

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/field-level/active` | Check if a legacy field-level list is active | All six roles |
| `POST` | `/api/hrp/field-level/activate` | Activate a legacy field-level list | District nodal designation (legacy) |
| `POST` | `/api/hrp/field-level/deactivate` | Deactivate a legacy field-level list | District nodal designation (legacy) |

### 5.6 Referrals (Retained API — Superseded Workflow)

The standalone Referrals page and its navigation entry are removed. Referral
notes recorded during a visit stay on the visit record. The endpoints below are
kept for authorization and data compatibility; no app screen calls them.

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/referrals` | List referrals visible to the actor | All six roles (scope + `REFERRAL_NODAL` grant) |
| `POST` | `/api/referrals` | Create a referral record | ANM, CHO, HRP_HELPDESK_BLOCK, BHM |
| `PATCH` | `/api/referrals/:id` | Update referral status | Destination role or `REFERRAL_NODAL` holder |

See [`docs/specs/SPEC-referral-workflow.md`](docs/specs/SPEC-referral-workflow.md)
for the superseded workflow and
[`docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md`](docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md)
for the replacement follow-up rule.


---

## 6. Error Semantics

Every error response follows a single consistent format:

```typescript
interface APIError {
  error: {
    code: string;        // "VALIDATION_ERROR" \| "NOT_FOUND" \| "FORBIDDEN" \| "CONFLICT" \| "INTERNAL"
    message: string;     // Human-readable
    details?: unknown;   // Field-level validation errors when helpful
  };
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Invalid request body |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized (role/facility scope) |
| 404 | Patient or follow-up not found |
| 409 | Conflict (e.g., follow-up already completed, idempotency key reused) |
| 422 | Validation failed |
| 500 | Server error (no internal details exposed) |

---

## 7. Role-Based Authorization Matrix

| Action | ANM | CHO | HRP_HELPDESK_BLOCK | BHM | HRP_HELPDESK_DISTRICT | DHS |
|--------|-----|-----|--------------------|-----|-----------------------|-----|
| Create patient / visit | ✓ (own) | ✓ (subtree) | ✓ (block) | ✓ (subtree) | — | — |
| View patients | ✓ (own) | ✓ (subtree) | ✓ (block) | ✓ (block) | ✓ (district) | ✓ (district) |
| Mark patient as HRP | ✓ (own) | ✓ (subtree) | ✓ (block) | ✓ (subtree) | — | — |
| Toggle `referred` | ✓ (own) | ✓ (subtree) | ✓ (block) | ✓ (subtree) | — | — |
| View follow-up line list | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Close `BLOCK_15_DAY` | — | — | ✓ | ✓ | ✓ | ✓ |
| Close `FIELD_15_DAY` | ✓ (own) | ✓ (subtree) | ✓ | ✓ | ✓ | ✓ |
| Dispatch follow-ups | — | — | ✓ | ✓ | — | — |
| Team & access (`staff:manage`) | — | — | — | ✓ (own subtree) | — | ✓ (district) |
| View block dashboard | — | — | ✓ | ✓ | — | — |
| View district dashboard / escalations | — | — | — | — | ✓ | ✓ |
| Activate field-level | — | — | — | — | — | ✓ (district designation) |
| Referral endpoints (retained) | create/read own | create/read HWC | read block | create/read block | read district | read district |

`followup:manage` is granted to all six roles, scoped to the facility subtree;
ANM is limited to its own facility. `staff:manage` is granted to BHM and DHS only.

---

## 8. Follow-Up Cycle (15 Days, Repeating — No Manual Toggle)

### 8.1 At registration

When a woman is marked HRP (`isHrp = true`), the first cycle is created
automatically:

| Condition | Stage | Owner | Due |
|-----------|-------|-------|-----|
| `referred = true` | `BLOCK_15_DAY` | Block HRP Helpdesk; falls back to the block BHM, then the registering worker | registration + 15 days |
| `referred = false` | `FIELD_15_DAY` | Registering ANM/CHO | registration + 15 days |

A `BLOCK_15_DAY` row is visible to the ANM/CHO in an **Awaiting block review**
section but is not actionable there: only the block helpdesk, BHM or DHS can
close it.

### 8.2 On completion

When a cycle is marked `COMPLETE`:

1. the current row is closed with `completedAt` and `completedByUserId`;
2. a new `FIELD_15_DAY` row is created, due **completion date + 15 days**,
   assigned to the woman's registering ANM/CHO;
3. the new row is immediately visible to the block helpdesk and district in the
   shared line list, and both may close it.

Completing any later cycle repeats step 2, so the 15-day cadence never stops
while the woman remains an active HRP.

### 8.3 Overdue escalation

A cycle is escalated when `status = PENDING AND scheduledDate < today`. No
separate escalation record is written; the escalation queue and district
compliance counts derive the condition, so an overdue row can never go stale.
`NOT_REACHABLE` keeps the row open and escalates in the same way once its due
date passes.

### 8.4 Dispatch

The block dispatch box writes one `FIELD_15_DAY` row per selected woman,
assigned to the chosen ANM/CHO. The request has no track field. Omitting
`scheduledDate` sets the due date to today + 15 days; supplying it overrides the
date but never the stage.

### 8.5 Follow-up completion propagation

When **any authorised role** marks a cycle `COMPLETE`:

- the row status becomes `COMPLETE` and attribution is recorded;
- all viewers of the shared line list see it as completed;
- the next cycle is created exactly once, for the registering ANM/CHO.

When marked `NOT_REACHABLE`:

- the status and attempt timestamp are recorded;
- the row stays open and escalates if it becomes overdue;
- no automatic retry schedule is created; the block helpdesk can re-dispatch.


---

## 9. Panel View — Follow-Up Section

The follow-up section is **not a separate panel**. HRP cases appear within the
follow-up section of each user's view: field workers see their own cycles and
the block-owned rows awaiting review; block and district roles see the shared
line list.

### Visibility Rules

A patient appears in the follow-up section when:
- `isHrp = true`

The stage (`BLOCK_15_DAY` or `FIELD_15_DAY`) decides who owns the row, not
whether it appears.

### Row Display

| Column | Content | Location |
|--------|---------|----------|
| Patient Name | `patientName` | Left |
| Age | `patientAge` | Left |
| Village | `village` | Left |
| Block | `blockName` (district roll-up) | Left |
| Complication | `hrpComplication` | Left (from 9-value dropdown) |
| Referred By | `referredByAnmName` | **Bottom right corner** |
| Follow-Up Status | `PENDING` / `COMPLETE` / `NOT_REACHABLE` | Right |
| Scheduled Date | `followUp.scheduledDate` | Right |
| Stage | `BLOCK_15_DAY` / `FIELD_15_DAY` | Right |
| Done by | `completedByName` (`completedByRole`) | Right |


### Referral Attribution

`referredByAnmName` is resolved from `patient.registeredBy` (the ANM user who registered the patient) and displayed in the **bottom right corner** of each row.

---

## 10. Field-Level Follow-Up (Automatic 15-Day Cycle)

### Activation Rule

There is no manual activation and no district-owned list gate. A woman marked
`isHrp` automatically has one open 15-day cycle, so her row appears for the
responsible worker as soon as the cycle is created.

| State | Visibility |
|-------|------------|
| Referred HRP, `BLOCK_15_DAY` open | Visible to ANM/CHO in the read-only **Awaiting block review** section; actionable for the Block HRP Helpdesk, BHM and DHS |
| `FIELD_15_DAY` open | Actionable for the assigned ANM/CHO; also visible to the block helpdesk, BHM, district helpdesk and DHS |
| Cycle complete | Closed with attribution; completing it creates the next 15-day cycle |
| Cycle overdue and still open | Escalated to the district escalation queue |

### Assignment

Pushed from block level with:
- `assignedToUserId` (specific ANM or CHO)
- `scheduledDate` = push date + 15 days, stored as `FIELD_15_DAY`

The server also creates the first cycle automatically at registration, so a
block dispatch is only needed when the work is being reassigned or restarted.

---

## 11. Idempotency for Follow-Up Creation

Following API design principles:

| Aspect | Specification |
|--------|---------------|
| Header | `Idempotency-Key` on `POST /api/hrp/follow-ups` |
| Key derivation | `followup:v1:${patientId}:${assignedToUserId}:${track}` (immutable, stable across retries) |
| Claim mechanism | Atomic INSERT with unique constraint (no SELECT-then-INSERT race) |
| Same key + different payload | `422 Conflict` — fails loudly |
| In-flight duplicate | `409 Conflict` — client retries later |
| Key retention | Outlives longest retry path including dead-letter replay |

---

## 12. Validation Boundaries

Validation happens **only at system edges** where external input enters:

- ✅ API route handlers (user input)
- ✅ Form submission handlers (user input)
- ✅ External service response parsing (third-party data — always treated as untrusted)
- ✅ Environment variable loading (configuration)

Validation does **NOT** happen:
- ❌ Between internal functions that share type contracts
- ❌ In utility functions called by already-validated code
- ❌ On data that just came from your own database

---

## 13. Zod Validation Schemas

### Create Patient

```typescript
export const CreatePatientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid mobile number required"),
  age: z.number().int().min(15).max(55, "Age must be between 15 and 55"),
  village: z.string().min(1, "Village is required"),
  lmp: z.string().datetime().nullable().optional(),
  hrpComplication: HrpComplication.nullable().optional(),
  isReferred: z.boolean().default(false),
});
```

### Patient Filter

```typescript
export const PatientFilterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  isHrp: z.coerce.boolean().optional(),
  isReferred: z.coerce.boolean().optional(),
  hrpComplication: HrpComplication.optional(),
  followUpStatus: FollowUpStatus.optional(),
  facilityId: z.string().uuid().optional(),
});
```

### Update Follow-Up

```typescript
export const UpdateFollowUpSchema = z.object({
  status: FollowUpStatus,
  notes: z.string().nullable().optional(),
});
```

### Schedule Follow-Up

```typescript
export const ScheduleFollowUpSchema = z.object({
  patientId: z.string().uuid(),
  identifiedDate: z.string().datetime(),
});
```

### Nodal Dashboard

```typescript
export const NodalDashboardSchema = z.object({
  facilityId: z.string().uuid(),
  nodalLevel: NodalLevel,
});
```

### Field-Level Activate/Deactivate

```typescript
export const FieldLevelActivateSchema = z.object({
  facilityId: z.string().uuid(),
  districtListId: z.string().uuid(),
});

export const FieldLevelDeactivateSchema = z.object({
  facilityId: z.string().uuid(),
});
```

---

## 14. Discriminated Union for Follow-Up Status

```typescript
type FollowUpRecord =
  | { type: "PENDING"; scheduledDate: Date; assignedTo: User }
  | { 
      type: "COMPLETE"; 
      completedAt: Date; 
      completedBy: User; 
      notes?: string 
    }
  | { 
      type: "NOT_REACHABLE"; 
      attemptedAt: Date; 
      attemptedBy: User; 
      retryAfter?: Date 
    };

export function followUpLabel(record: FollowUpRecord): string {
  switch (record.type) {
    case "PENDING":
      return `Pending — due ${format(record.scheduledDate, "dd MMM")}`;
    case "COMPLETE":
      return `Completed on ${format(record.completedAt, "dd MMM yyyy")}`;
    case "NOT_REACHABLE":
      return `Not reachable — last attempted ${format(record.attemptedAt, "dd MMM")}`;
  }
}
```

---

## 15. Date Utilities (Repeating 15-Day Cycle)

```typescript
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export const HRP_FOLLOW_UP_WINDOW_DAYS = 15;

export function nextHrpFollowUpDate(fromDate: Date = new Date()): Date {
  return addDays(fromDate, HRP_FOLLOW_UP_WINDOW_DAYS);
}
```

PMSMA (9th/15th/21st) and VHSND scheduling are retired. The block's first
check-up and every later field contact both use the same 15-day window,
measured from registration or from the previous completion.

---

## 16. Verification Checklist

Before marking any implementation complete:

- [ ] **Complication dropdown** — Exactly 8 values in exact sequence: ANEMIA, PIH, GDM, SHORT_STATURE, PRE_LSCS, MULTI_GRAVIDA, TWINS_MULTIPLE_PREGNANCY, TEENAGE_PREGNANCY (no RH_FACTOR, no extras)
- [ ] **Referring toggle** — `referred` boolean; when true, cycle 1 is `BLOCK_15_DAY` owned by the Block HRP Helpdesk, falling back to the block BHM, then the registering worker
- [ ] **15-day schedule** — No manual activation; due date is `registration + 15` for cycle 1 and `completion + 15` for every later cycle
- [ ] **Block review visibility** — A referred woman's first cycle appears in the ANM/CHO screen as read-only "Awaiting block review" until the block closes it
- [ ] **Escalation** — `status = PENDING AND scheduled_date < today` appears in the DHS / district-helpdesk escalation queue, with no stored flag
- [ ] **Panel view** — Follow-up section shows HRP-referred patients with ANM name in bottom right corner
- [ ] **Roles** — Exactly `ANM`, `CHO`, `HRP_HELPDESK_BLOCK`, `BHM`, `HRP_HELPDESK_DISTRICT`, `DHS`
- [ ] **Provisioning** — DHS creates BHM/district helpdesk; BHM creates ANM/CHO/block helpdesk; nobody else creates accounts
- [ ] **Follow-up status** — Complete, Pending, Not Reachable only
- [ ] **API errors** — Consistent `APIError` shape across all endpoints
- [ ] **Idempotency** — Atomic claim, unique constraint, 422 on payload mismatch, 409 on in-flight duplicate
- [ ] **Validation** — Only at boundaries (route handlers, form submissions)
- [ ] **No AI aesthetic** — No purple gradients, no rounded-2xl everywhere, semantic tokens only
- [ ] **Accessibility** — WCAG 2.1 AA, keyboard nav, ARIA labels, focus visible, color contrast ≥ 4.5:1
- [ ] **No suppression comments** — No `@ts-ignore`, `eslint-disable`, etc.
- [ ] **No stubs** — No `throw new Error("Not implemented")` or empty `catch {}`

---

## 17. File Locations

| Document | Path |
|----------|------|
| Domain Types | `packages/shared/src/types.ts` |
| Validation Schemas | `packages/shared/src/schemas.ts` |
| Follow-Up Scheduling Rules | `packages/shared/src/hrp-follow-up.ts` |
| Date Utilities | `packages/shared/src/date-utils.ts` |
| API Route Handlers | `packages/server/src/routes/hrp.ts`, `follow-ups.ts`, `staff.ts` |
| Client API Layer | `packages/client/src/lib/api.ts` |
| React Components | `packages/client/src/components/follow-ups/` |
| Binding Spec | `docs/specs/SPEC-matru-suraksha-roles-and-follow-up.md` |
| This Documentation | `API_DOCUMENTATION.md` |

---

*End of documentation.*