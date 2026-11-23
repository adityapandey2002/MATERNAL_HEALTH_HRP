# SPEC: Anemia Classification Correction & ANM/CHO Patient Visibility Scoping

**Version:** 1.0  
**Status:** Approved for implementation  
**Date:** 2026-11-23  

---

## 1. Problem Statements

### 1.1 Anemia Classification (NHM Standard)

The current implementation uses an **incorrect boundary** between MODERATE and MILD anemia:

| Grade    | Current (wrong)  | Correct (NHM)    |
|----------|------------------|------------------|
| SEVERE   | Hb < 7 g/dL      | Hb < 7 g/dL      |
| MODERATE | 7 ≤ Hb < 9 g/dL  | 7 ≤ Hb < 10 g/dL |
| MILD     | 9 ≤ Hb < 11 g/dL | 10 ≤ Hb < 11 g/dL|
| NORMAL   | Hb ≥ 11 g/dL     | Hb ≥ 11 g/dL     |

The boundary between MODERATE and MILD must shift from `< 9` to `< 10`.

### 1.2 Patient List Visibility Scoping

The patient list must respect HWC/Panchayat area boundaries:

- **ANM / CHO:** See **only** patients registered by themselves (`registered_by = current_user_id`).  
  Two ANMs at the same HWC should NOT see each other's patients.
- **Block level (BHM, HRP_HELPDESK_BLOCK):** Sees all patients in the block subtree. ✓ Correct today.
- **District level (DHS, HRP_HELPDESK_DISTRICT):** Sees all patients in the district. ✓ Correct today.

**Root cause:** `facilityScopePredicate` uses a path-LIKE subtree match and does not distinguish per-user ownership at field level.

---

## 2. Design

### 2.1 Anemia Grade Boundary

```
anemiaGradeFromHb(hb):
  if hb < 7   → SEVERE
  if hb < 10  → MODERATE   ← boundary moved from 9 to 10
  if hb < 11  → MILD
  else        → NORMAL
```

### 2.2 Patient Scoping Strategy

**For ANM / CHO roles:**
```sql
WHERE patients.registered_by = actor.userId
AND   facilities.path = actor.facilityPath   -- exact match (their HWC/HSC only)
```

**For block / district roles:** existing `facilityScopePredicate` subtree LIKE — unchanged.

Applied in:
1. Server `GET /api/patients` list
2. Server `GET /api/sync/pull` patients
3. Server `POST /api/sync/push` post-push refresh
4. Client `useLocalPatients()` — offline Dexie filter mirrors the server rule

### 2.3 Updated Display Labels

| Grade    | Label used in badges / forms            |
|----------|-----------------------------------------|
| SEVERE   | `Severe Anemia · < 7 g/dL`             |
| MODERATE | `Moderate Anemia · 7–9.9 g/dL`         |
| MILD     | `Mild Anemia · 10–10.9 g/dL`           |
| NORMAL   | *(not shown / no intervention needed)*  |

---

## 3. Files Changed

| Package | File | Change |
|---------|------|--------|
| shared  | `src/types.ts` | `anemiaGradeFromHb` boundary `< 9` → `< 10`; `ANEMIA_GRADE_LABEL` strings |
| shared  | `src/types.test.ts` | 9.0 → MODERATE, 9.9 → MODERATE, 10.0 → MILD |
| server  | `src/routes/patients.ts` | Field-role scoping predicate (`registered_by = userId`) |
| server  | `src/routes/sync.ts` | Same predicate on pull and post-push refresh |
| client  | `src/lib/db/queries.ts` | `useLocalPatients` → filter by `registeredBy === session.user.id` for field roles |
| client  | `src/components/follow-ups/RecordFollowUpVisitModal.tsx` | Hb badge range strings |
| client  | `src/pages/AddPatient.tsx` | Hb range hint strings |

---

## 4. Constraints

- Do NOT rename enum values (`SEVERE`, `MODERATE`, `MILD`, `NORMAL`).
- Do NOT change block/district visibility — full subtree still required there.
- `isFcmIndicated()` already covers all three anemia grades — no change needed.
- Quality gate: `npm run check:fast` must pass 0 errors before each commit.
