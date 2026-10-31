# Task List: Matru Suraksha Offline-First Pilot + Android APK

Status key: `[ ]` pending, `[~]` in progress, `[x]` complete
Plan: `tasks/offline-pilot-plan.md` · Created: 2026-10-31

> Separate from `tasks/todo.md` (production launch). Do not mark launch items here.

## Preconditions

- [x] **Decision D2 — Android package ID:** `in.gov.araria.matrusuraksha` (subject to district IT owning the `in.gov` namespace)
- [x] **Decision D5 — offline scope:** ANM/CHO full local-first; BHM/helpdesk/DHS online-first read-only offline
- [ ] **Decision D1 — pilot data:** synthetic only, or real PHI with Level 2 controls (see plan Appendix A). Hard constraint: free Render/Neon demo stays synthetic-only.
- [ ] **Decision D3 — conflicts:** server-wins + visible conflict list (no automatic merge). Confirm whether "UI merge" means refetch or field-level merge.
- [ ] **Decision D4 — APK channel:** recommended CI → GitHub Release → shared-drive mirror → WhatsApp link

## Phase 0 — Baseline and a failing test (0.5–1 day)

- [ ] **0.1 Land the in-flight Matru Suraksha rebrand**
  - Acceptance: working tree clean; `check:task` green; app boots
  - Verify: `npm run check:task`
  - Files: existing rebrand files; needs approval to commit WIP
  - Size: M

- [ ] **0.2 Add the offline write E2E test (expected red)**
  - Acceptance: fails today because of the offline wall/redirect, not missing fixtures
  - Verify: `npx playwright test offline-write --project=chromium`
  - Files: `playwright.config.ts`, `src/test/e2e/offline-write.spec.ts`, `global-setup.ts`, `fixtures.ts`
  - Depends: 0.1 · Size: M

- [ ] **0.3 Interim honest copy**
  - Acceptance: no screen claims local save/sync it cannot do
  - Verify: string search + component tests
  - Files: `pages/Offline.tsx`, `pages/Settings.tsx`, `components/Layout.tsx`, `pages/Login.tsx`
  - Depends: 0.1 · Size: S

**Checkpoint 0:** baseline green; red E2E committed; copy truthful.

## Phase 1 — Local store, session, sync engine (2–3 days)

- [ ] **1.1 Offline-capable cached session**
  - Acceptance: airplane mode + cached session reloads `/patients`; real online 401 still redirects; logout clears
  - Verify: unit + guard component test
  - Files: `lib/session.ts`, `lib/api.ts`, `App.tsx`, `lib/session-cache.ts`, tests
  - Depends: 0.1 · Size: M

- [ ] **1.2 Dexie schema and repositories**
  - Acceptance: entities round-trip; queue survives reload; `clearAll` wipes; no PHI in localStorage
  - Verify: Vitest + `fake-indexeddb`
  - Files: `lib/db/local-db.ts`, `lib/db/repositories.ts`, `lib/db/ids.ts`, `package.json`, tests
  - Depends: 1.1 · Size: M

- [ ] **1.3 Queue engine and drain triggers**
  - Acceptance: exactly-once drain; backoff on failure; no concurrent drains; 250 ops in 3 chunks; conflicts kept
  - Verify: unit with fake API/DB + double-push integration test
  - Files: `lib/sync/queue.ts`, `lib/sync/push.ts`, `lib/sync/triggers.ts`, tests
  - Depends: 1.2, 1.4a · Size: M

- [ ] **1.4a Transactional, per-item `/sync/push`**
  - Acceptance: bad visit does not roll back valid patients; rejection returned; DB error rolls back all
  - Verify: server integration tests
  - Files: `routes/sync.ts`, `packages/shared/src/schemas.ts`, `routes/sync.test.ts`
  - Size: M

- [ ] **1.4b Follow-up sync with real completion time**
  - Acceptance: offline completion on day 0 synced day 3 schedules day 15; double push creates one cycle; scope enforced
  - Verify: server integration + schema tests
  - Files: `schemas.ts`, `routes/sync.ts`, `routes/follow-ups.ts`, `services/hrp-follow-up.ts`, tests
  - Depends: 1.4a, 1.2 · Size: M

**Checkpoint 1:** session offline-safe; queue drains/retries; push transactional; follow-up dates correct; `check:task` green.

## Phase 2 — Field flows local-first (2–3 days)

- [ ] **2.1 Pre-cache the assigned cohort**
  - Acceptance: one online login makes list/visits/follow-ups readable offline; delta pull on second sync
  - Verify: two-round sync test
  - Files: `lib/sync/pull.ts`, `lib/sync/engine.ts`, `lib/db/repositories.ts`, tests
  - Depends: 1.2 · Size: M

- [ ] **2.2 Patients list/detail read from Dexie**
  - Acceptance: offline list/detail render; pending badge; cached visits
  - Verify: component tests + airplane-mode check
  - Files: `pages/Patients.tsx`, `pages/PatientDetail.tsx`, `lib/db/queries.ts`, tests
  - Depends: 1.2, 2.1 · Size: M

- [ ] **2.3 AddPatient writes locally first**
  - Acceptance: offline create survives reload; reconnect writes one row; double tap creates one
  - Verify: component test; `offline-write` E2E green
  - Files: `pages/AddPatient.tsx`, `lib/sync/queue.ts`, tests
  - Depends: 1.3, 2.2 · Size: S

- [ ] **2.4 NewVisit writes locally first + real error handling**
  - Acceptance: offline visit appears immediately; write failure alerts and keeps form; one visit after sync
  - Verify: component test; `offline-visit` E2E
  - Files: `pages/NewVisit.tsx`, `pages/PatientDetail.tsx`, tests
  - Depends: 2.3 · Size: M

- [ ] **2.5 PatientDetail edits locally first**
  - Acceptance: offline edit persists/syncs; conflict visible, not discarded
  - Verify: component + integration tests
  - Files: `pages/PatientDetail.tsx`, tests
  - Depends: 2.3 · Size: S

- [ ] **2.6 Field follow-ups locally**
  - Acceptance: offline completion persists; server uses real completion date; `BLOCK_15_DAY` stays non-actionable for field
  - Verify: `offline-followup` E2E + 1.4b integration
  - Files: `components/follow-ups/FieldFollowUpPanel.tsx`, `pages/FollowUps.tsx`, `pages/FieldHome.tsx`, tests
  - Depends: 1.4b, 2.2 · Size: M

- [ ] **2.7 Real sync status UI**
  - Acceptance: queue counts match Dexie; retry works; no false "complete"; accessible status
  - Verify: component tests + manual
  - Files: `components/SyncStatus.tsx`, `components/Layout.tsx`, `pages/Settings.tsx`, tests
  - Depends: 2.3–2.6 · Size: M

- [ ] **2.8 Dashboard/FieldHome offline counts**
  - Acceptance: offline counts in <1 s with "as of" time; no spinner
  - Verify: component test + manual
  - Files: `pages/Dashboard.tsx`, `pages/FieldHome.tsx`, tests
  - Depends: 2.2 · Size: S

**Checkpoint 2:** register → visit → follow-up offline E2E green; reload survives; manual Android Chrome run.

## Phase 3 — PWA shell hardening (0.5–1 day)

- [ ] **3.1 Navigation fallback, update prompt, cache cleanup**
  - Acceptance: cold offline deep link works; prompt never reloads a dirty form; no PHI in Cache Storage
  - Verify: Playwright cold-start + cache inspection
  - Files: `vite.config.ts`, `utils/sw.ts`, `components/UpdatePrompt.tsx`, tests
  - Depends: 2.7 · Size: M

- [ ] **3.2 Manifest, icons, theme, persistent storage**
  - Acceptance: installable; theme `#0D7A73`; short name `Matru`; PNG/maskable icons; persist requested
  - Verify: Lighthouse + manual install
  - Files: `vite.config.ts`, `public/*`, `main.tsx`, tests
  - Depends: 3.1 · Size: S

**Checkpoint 3:** installable PWA; cold offline launch; deep link offline; no PHI caches.

## Phase 4 — Capacitor Android APK (2.5–3 days)

- [ ] **4.0a Native API transport and CORS**
  - Acceptance: WebView origin can call `/health` and `/auth/login`; web build still uses `/api`; no wildcard CORS
  - Verify: server CORS tests + manual WebView call
  - Files: `lib/api.ts`, `server/index.ts`, `server/config.ts`, `.env.example`, tests
  - Depends: 3.2 · Size: M

- [ ] **4.0b Native refresh token and demo gating**
  - Acceptance: APK login survives 15-min expiry + restart; web keeps httpOnly cookie; pilot APK shows no demo credentials
  - Verify: auth tests for both client types + device test
  - Files: `routes/auth.ts`, `lib/api.ts`, `lib/session-cache.ts`, `pages/Login.tsx`, tests
  - Depends: 4.0a, 1.1 · Size: M

- [ ] **4.1 Add Capacitor + Android project**
  - Acceptance: debug APK launches; no cleartext; `allowBackup=false`; minSdk 23 / targetSdk 35
  - Verify: `cap sync android` + `gradlew assembleDebug`
  - Files: `package.json`, `capacitor.config.ts`, `android/*`, docs
  - Depends: 3.2 · Size: M

- [ ] **4.2 Native lifecycle and storage**
  - Acceptance: offline record survives kill/relaunch; sync on resume/reconnect; back button does not lose form
  - Verify: device matrix
  - Files: `lib/native.ts`, `main.tsx`, `App.tsx`, `AndroidManifest.xml`
  - Depends: 4.1 · Size: M

- [ ] **4.3 Signed release APK pipeline**
  - Acceptance: CI artifact is signed; installs over previous key with data intact; no keystore in tree
  - Verify: `workflow_dispatch` run + clean-device install
  - Files: `.github/workflows/android.yml`, `android/app/build.gradle`, runbook
  - Depends: 4.1 · Size: M

- [ ] **4.4 Export, wipe, update notice**
  - Acceptance: export opens share sheet; wipe clears Dexie/caches; update banner names version + steps
  - Verify: device test + serializer unit test
  - Files: `lib/export.ts`, `pages/Settings.tsx`, version endpoint/file, tests
  - Depends: 4.2 · Size: M

- [ ] **4.5 Device matrix + pilot runbook**
  - Acceptance: Android 10/13/14, airplane, 2G, low storage, clock skew, kill/reboot/upgrade all pass
  - Verify: manual sign-off
  - Files: `docs/runbooks/offline-pilot.md`
  - Depends: 4.3, 4.4 · Size: S

**Checkpoint 4:** signed APK on a physical phone; full offline flow; sync on resume; export works; upgrade preserves data.

## Phase 5 — Pilot readiness (0.5–1 day)

- [ ] **5.1 Privacy gate for real PHI**
  - Acceptance: signed decision; if real PHI, app lock, `allowBackup=false`, logout wipe, idle timeout, no PHI logs all tested
  - Verify: checklist review
  - Files: `docs/runbooks/offline-pilot.md`, `docs/compliance/*`
  - Depends: 4.5 · Size: S

- [ ] **5.2 Support diagnostics**
  - Acceptance: device ID/version/queue/last error copied with no patient identifiers
  - Verify: redaction unit test + manual
  - Files: `pages/Settings.tsx`, `lib/diagnostics.ts`, tests
  - Depends: 2.7, 4.4 · Size: S

- [ ] **5.3 Final gates**
  - Acceptance: `check:task`, `check:full`, `check:bundle`, offline E2E, APK smoke all green; coverage ≥ 80%; no red-line suppressions
  - Verify: commands in plan §8
  - Depends: all · Size: S

## Conditional Phase 5A — only if D1 = real PHI (+2–3 days)

- [ ] **5A.1 App PIN lock + key management**
  - Acceptance: 6-digit PIN, PBKDF2 (600k), lock on launch + 3-min background, 10 failures → wipe, PIN change needs old PIN
  - Verify: unit + device test
  - Files: `lib/lock.ts`, `pages/LockScreen.tsx`, `App.tsx`, tests
  - Depends: 1.2, 4.1 · Size: M

- [ ] **5A.2 Field encryption + blind index**
  - Acceptance: identifiers/notes encrypted at rest; HMAC name index; decrypt before render/sync
  - Verify: unit tests with a known ciphertext vector
  - Files: `lib/crypto.ts`, `lib/db/repositories.ts`, tests
  - Depends: 5A.1 · Size: M

- [ ] **5A.3 Wipe + device revocation**
  - Acceptance: logout wipe, 10-failure wipe, server revoke flag applied on sync, admin revoke action
  - Verify: integration + device test
  - Files: `lib/lock.ts`, `lib/sync/pull.ts`, `routes/staff.ts` or `routes/devices.ts`, tests
  - Depends: 5A.1, 4.4 · Size: M

- [ ] **5A.4 Android hardening + pilot backend**
  - Acceptance: `FLAG_SECURE`, `allowBackup=false`, release flags; separate non-shared backend signed off
  - Verify: checklist review + manual
  - Files: `android/...`, runbook, config
  - Depends: 4.1, 4.3 · Size: M

- [ ] **5A.5 Privacy gate**
  - Acceptance: written go/no-go, consent + retention evidence
  - Verify: review
  - Files: `docs/runbooks/offline-pilot.md`, `docs/compliance/*`
  - Depends: 5A.2–5A.4 · Size: S

**Checkpoint 5 (pilot sign-off):** APK handed over, runbook delivered, privacy decision signed, gates green.
