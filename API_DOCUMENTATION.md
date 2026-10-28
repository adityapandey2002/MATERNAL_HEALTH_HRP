# HRP Tracking Platform — API & Interface Documentation

**Product:** Multi-tier High-Risk Pregnancy tracking for India's public health system  
**Stack:** React + Vite + TypeScript, Vitest, Playwright, Fastify/Node, PostgreSQL  
**Documentation Status:** Complete  
**Last Updated:** Wed Oct 28 2026

---

## 1. Overview

The HRP Tracking Platform serves three tiers of users in India's public health system:

| Tier | Role | Primary Interface | Responsibility |
|------|------|-------------------|----------------|
| Field | ANM (Auxiliary Nurse Midwife) | Mobile PWA (offline-first) | Patient capture, HRP identification, vitals, follow-up execution |
| Triage | CHO (Community Health Officer) | Desktop Dashboard | Patient line list, risk triage, follow-up execution |
| Supervision | BHM / DHS + Block Nodal / District Nodal | Desktop Dashboard | Block/district oversight, field-level activation, adherence monitoring |

---

## 2. Domain Types

### 2.1 User Roles

```typescript
export const UserRole = z.enum(["ANM", "CHO", "BHM", "DHS"]);
export type UserRole = z.infer<typeof UserRole>;
```

### 2.2 Nodal Designation (Block / District)

Block Nodal and District Nodal are **scoped designations** assigned to existing `DHS` or `BHM` users at the facility level. They are not separate roles.

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
| `PENDING` | Follow-up not yet completed |
| `COMPLETE` | Follow-up completed by ANM, CHO, or Block Nodal |
| `NOT_REACHABLE` | Patient could not be reached for follow-up |

```typescript
export const FollowUpStatus = z.enum(["COMPLETE", "PENDING", "NOT_REACHABLE"]);
export type FollowUpStatus = z.infer<typeof FollowUpStatus>;
```

### 2.5 Follow-Up Track (Automated Scheduling)

```typescript
export const FollowUpTrack = z.enum([
  "IMMEDIATE_7_DAYS",      // Within 7 days of HRP identification
  "PMSMA_SESSION",         // Next PMSMA at PHC (9th/15th/21st, next working day if holiday)
  "VHSND_COMMUNITY",       // Next VHSND by ANM in village
]);
export type FollowUpTrack = z.infer<typeof FollowUpTrack>;
```

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
| `village` | string | Yes | Village name (mapped to HWC on server) |
| `lmp` | string \| null | No | Last Menstrual Period (ISO datetime) |
| `hrpComplication` | HrpComplication \| null | No | Dropdown — exactly 8 values above |
| `isReferred` | boolean | Yes | "Referring or not" toggle — when true, patient goes to Block Nodal section |

```typescript
export const PatientSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),        // HWC facility (village resolved to HWC)
  registeredBy: z.string().uuid(),       // ANM user ID who registered
  name: z.string().min(1),
  age: z.number().int().min(15).max(55),
  phone: z.string().min(10),
  village: z.string().min(1),
  hwcId: z.string().uuid().nullable(),   // resolved HWC facility
  lmp: z.string().datetime().nullable(),
  hrpComplication: HrpComplication.nullable(),
  isReferred: z.boolean().default(false),
  referredToFacilityId: z.string().uuid().nullable(),
  isHrp: z.boolean().default(false),     // marked HRP by ANM/CHO
  // Follow-up is AUTOMATED — no manual toggle
  followUpTrack: FollowUpTrack.nullable(),
  followUpScheduledDate: z.string().datetime().nullable(),
  followUpStatus: FollowUpStatus.default("PENDING"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Create Patient Input (API Boundary)

```typescript
interface CreatePatientInput {
  name: string;
  phone: string;
  age: number;
  village: string;           // mapped to HWC on server
  lmp: string | null;        // ISO datetime
  hrpComplication: HrpComplication | null;
  isReferred: boolean;
}
```

---

## 4. Follow-Up Schema

```typescript
export const FollowUpSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),   // ANM or CHO executing follow-up
  assignedByUserId: z.string().uuid(),   // who created assignment (system for automated)
  level: z.enum(["BLOCK_NODAL", "CHO", "ANM"]),
  status: FollowUpStatus.default("PENDING"),
  track: FollowUpTrack.nullable(),
  scheduledDate: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  completedByUserId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

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
| `POST` | `/api/hrp/patients` | Create new patient (Add Form) | ANM, CHO |
| `GET` | `/api/hrp/patients` | List patients with filters | All authenticated |
| `GET` | `/api/hrp/patients/:id` | Get single patient | All authenticated |
| `PATCH` | `/api/hrp/patients/:id` | Partial update patient | ANM, CHO, Block Nodal |
| `PATCH` | `/api/hrp/patients/:id/hrp` | Mark/unmark patient as HRP | ANM, CHO |

### 5.2 Follow-Up Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/follow-ups` | List follow-ups with filters | All authenticated |
| `GET` | `/api/hrp/follow-ups/panel` | Panel view: HRP-referred patients | ANM, CHO, Block Nodal, District Nodal |
| `GET` | `/api/hrp/follow-ups/field` | Field-level follow-ups (if active) | ANM, CHO |
| `PATCH` | `/api/hrp/follow-ups/:id` | Update follow-up status | ANM, CHO, Block Nodal |
| `POST` | `/api/hrp/follow-ups/schedule` | Automated follow-up schedule calculation | System (triggered on HRP mark) |

### 5.3 Nodal Dashboard (Block & District)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/nodal/dashboard` | Block/District nodal dashboard stats | Block Nodal, District Nodal |
| `GET` | `/api/hrp/nodal/anms-offline` | ANMs offline > 48h | Block Nodal, District Nodal |

### 5.4 Field-Level Activation (District-Controlled)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/hrp/field-level/active` | Check if field-level follow-up is active | All authenticated |
| `POST` | `/api/hrp/field-level/activate` | Activate field-level from district list | District Nodal |
| `POST` | `/api/hrp/field-level/deactivate` | Deactivate field-level | District Nodal |

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

| Action | ANM | CHO | BHM | DHS | Block Nodal | District Nodal |
|--------|-----|-----|-----|-----|-------------|----------------|
| Create patient | ✓ | ✓ | — | — | — | — |
| View own facility patients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mark patient as HRP | ✓ | ✓ | — | — | — | — |
| Toggle isReferred | ✓ | ✓ | — | — | — | — |
| View panel follow-ups | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View field-level follow-ups | ✓\* | ✓\* | — | — | — | — |
| Update follow-up status | ✓ (own) | ✓ (own) | ✓ | ✓ | ✓ | ✓ |
| View nodal dashboard | — | — | ✓ | ✓ | ✓ (block) | ✓ (district) |
| Activate field-level | — | — | — | ✓ | — | ✓ |

*\*Only when district-level field-level list is active.*

---

## 8. Follow-Up Scheduling Logic (Automated — No Manual Toggle)

### 8.1 Business Rules

When a patient is identified as HRP (`isHrp = true`) and/or referred (`isReferred = true`), the follow-up is **automatically scheduled**. There is **no manual toggle** for follow-up activation — the system calculates it.

Three tracks are computed, and the **earliest date wins**:

| Track | Logic | Rule |
|-------|-------|------|
| **IMMEDIATE_7_DAYS** | `identifiedDate + 7 days` | Within 7 days of HRP identification |
| **PMSMA_SESSION** | Next PMSMA at PHC | Fixed dates: 9th, 15th, 21st of each month. If that date falls on Sunday or a government holiday → **next working day** |
| **VHSND_COMMUNITY** | Next VHSND by ANM in village | Monthly village-level health, sanitation, and nutrition day |

**Scheduled date = min(Track 1, Track 2, Track 3)**  
**Assigned track = whichever track produced the earliest date**

### 8.2 PMSMA Working-Day Logic

```typescript
const PMSMA_DATES = [9, 15, 21]; // Fixed monthly dates

function getNextPmsmaDate(fromDate: Date): Date {
  // Check current month's PMSMA dates first
  // Then next month's dates
  // For each candidate, if Sunday or government holiday → next working day
}

function getNextWorkingDayIfHoliday(date: Date): Date {
  let d = new Date(date);
  while (isSunday(d) || isHoliday(d)) {
    d = addDays(d, 1);
  }
  return d;
}
```

### 8.3 Follow-Up Completion Propagation

When **any one** of (ANM, CHO, Block Nodal) marks a patient's follow-up as `COMPLETE`:
- The follow-up record status = `COMPLETE`
- All other viewers see it as completed for that patient
- No duplicate follow-up is created for the same patient

When marked `NOT_REACHABLE`:
- Status recorded with attempt timestamp
- No automatic retry schedule (manual review by nodal authority)

---

## 9. Panel View — Follow-Up Section

The follow-up section is **not a separate panel**. HRP-referred patients appear within the follow-up section of each user's view.

### Visibility Rules

A patient appears in the follow-up section when:
- `isHrp = true` AND `isReferred = true`

### Row Display

| Column | Content | Location |
|--------|---------|----------|
| Patient Name | `patient.name` | Left |
| Age | `patient.age` | Left |
| Village | `patient.village` | Left |
| Complication | `patient.hrpComplication` | Left (from 8-value dropdown) |
| Referred By | `referredByAnmName` | **Bottom right corner** |
| Follow-Up Status | `PENDING` / `COMPLETE` / `NOT_REACHABLE` | Right |
| Scheduled Date | `followUp.scheduledDate` | Right |
| Track | `IMMEDIATE_7_DAYS` / `PMSMA_SESSION` / `VHSND_COMMUNITY` | Right |

### Referral Attribution

`referredByAnmName` is resolved from `patient.registeredBy` (the ANM user who registered the patient) and displayed in the **bottom right corner** of each row.

---

## 10. Field-Level Follow-Up (District-Activated Only)

### Activation Rule

Field-level follow-ups are visible **only** when a district-level follow-up list exists for that facility's block/district.

| State | Visibility |
|-------|------------|
| Inactive (no district list) | No field-level section on any ANM/CHO dashboard or app |
| Active (district list exists) | ANM/CHO see field-level follow-ups assigned to them by area/AWC code |

### Assignment

Pushed from Block/District level with:
- `assignedToUserId` (specific ANM or CHO)
- Area/AWC code for geographic scoping

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

## 15. Date Utilities (PMSMA Working-Day Logic)

```typescript
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export function isHoliday(date: Date): boolean {
  // TODO: Query government holiday calendar for state/district
  return false;
}

export function getNextWorkingDay(date: Date): Date {
  let d = new Date(date);
  while (isSunday(d) || isHoliday(d)) {
    d = addDays(d, 1);
  }
  return d;
}
```

---

## 16. Verification Checklist

Before marking any implementation complete:

- [ ] **Complication dropdown** — Exactly 8 values in exact sequence: ANEMIA, PIH, GDM, SHORT_STATURE, PRE_LSCS, MULTI_GRAVIDA, TWINS_MULTIPLE_PREGNANCY, TEENAGE_PREGNANCY (no RH_FACTOR, no extras)
- [ ] **Referring toggle** — `isReferred` boolean; when true, patient shows on Block Nodal section and visible for follow-up
- [ ] **PMSMA dates** — 9th, 15th, 21st; if Sunday/government holiday → next working day
- [ ] **Follow-up automation** — No manual toggle; scheduled automatically as min(Immediate 7 days, PMSMA, VHSND)
- [ ] **Panel view** — Follow-up section shows HRP-referred patients with ANM name in bottom right corner
- [ ] **Field-level** — Only visible when district-level list is active; otherwise absent from all dashboards
- [ ] **Roles** — ANM, CHO, BHM, DHS + Block Nodal / District Nodal designations (scoped permissions on existing roles)
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
| Validation Schemas | `packages/server/src/lib/validate.ts` |
| Follow-Up Scheduling Rules | `packages/shared/src/rules.ts` |
| Date Utilities | `packages/shared/src/date-utils.ts` |
| API Route Handlers | `packages/server/src/routes/hrp.ts` |
| Client API Layer | `packages/client/src/lib/api.ts` |
| React Components | `packages/client/src/components/hrp/` |
| This Documentation | `API_DOCUMENTATION.md` |

---

*End of documentation.*