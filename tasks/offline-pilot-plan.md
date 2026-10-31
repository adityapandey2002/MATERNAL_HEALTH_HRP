# Implementation Plan: Matru Suraksha Offline-First Pilot + Android APK

Status: **Proposed — awaiting approval**
Created: 2026-10-31
Owner: @aditya
Companion task list: `tasks/offline-pilot-todo.md`
Supersedes: nothing. `tasks/plan.md` (production launch) stays in force; this plan covers only the offline-first pilot slice.

---

## 1. Goal

Let an ANM or CHO register a woman, record a visit, and close a 15-day follow-up with **no network**, on the phone they will actually carry, and have that data reach PostgreSQL when a connection returns — without duplicates, silent loss, or a UI that claims a save that did not happen.

Ship it two ways from one codebase:

1. the installable PWA at `https://hrp-demo.onrender.com` (demo / CHO desktop), and
2. a **signed Android APK** built with Capacitor and handed to pilot stakeholders directly (no Play Store dependency).

### Non-goals

- Play Store listing, TWA, Digital Asset Links.
- Background sync while the app is killed (Capacitor WebView cannot do this without a native WorkManager plugin). Sync runs on app start, on resume, and when connectivity returns.
- Multi-device merge UI. Conflicts are recorded and surfaced, not auto-merged.
- Offline write parity for DHS / district helpdesk oversight screens. They stay online-first with offline read.

---

## 2. Verified current state (2026-10-31 working tree)

| Behaviour | Reality | Evidence |
|---|---|---|
| Offline entry | **Impossible.** `OnlineGuard` replaces every route with the Offline screen when `navigator.onLine` is false. | `packages/client/src/App.tsx:78-85,90,120` |
| Offline reload | **Impossible.** `ProtectedRoute` calls `api.auth.me()`; offline it fails and redirects to `/login`. | `App.tsx:36-55`; `pages/Login.tsx` |
| Session expiry | A 401 triggers refresh; refresh failure runs `localStorage.clear()` and redirects to `/login`, even when the failure is just "no network". | `lib/api.ts:55-62,74-95` |
| Saving a patient / visit | Direct POST/PATCH. No IndexedDB write, no queue, no retry. | `pages/AddPatient.tsx:42-49,74`; `pages/NewVisit.tsx:75-82`; `pages/PatientDetail.tsx:90-92` |
| NewVisit failure | Silent: no `onError`, no alert. | `pages/NewVisit.tsx:75-82` |
| "Sync Now" | Posts `{patients: [], visits: [], referrals: []}` and writes `lastSyncTime`. Syncs nothing. | `pages/Settings.tsx:63-67,209` |
| Offline copy | Claims local save + automatic sync, and lists create/visit/referral capabilities that do not exist. | `pages/Offline.tsx:6-12,53-56`; `Layout.tsx:198-201` |
| App shell | Precached (14 entries), `/sw.js` live, but **no navigation fallback**, so a cold deep link offline fails. | `vite.config.ts`; `dist/sw.js` |
| Local DB | `dexie@4` and `idb` are already dependencies but unused. | `packages/client/package.json:21-22` |
| Server sync | `POST /sync/push` already accepts client UUIDs + `updatedAt` and returns conflicts. Not transactional; follow-ups are not in the contract. | `packages/server/src/routes/sync.ts:64-317`; `packages/shared/src/schemas.ts:114-134` |
| Follow-up completion | Server stamps `completed_at = now` and schedules the next cycle from server time, so an offline completion synced three days later would shift the cycle three days. | `packages/server/src/routes/follow-ups.ts:436-475`; `services/hrp-follow-up.ts:34-49` |
| Android toolchain | No `java`, no `ANDROID_HOME`, no Android SDK on this machine. | verified 2026-10-31 |

**Consequence:** the gap is not "add a retry". The route guard blocks the workflow, the session cannot survive offline, and the save path has no local store. All three must change together.

---

## 3. Architecture decisions

### AD-1 — Always local-first, one write path

Every clinical write goes to IndexedDB first, then a queue drains to the server. Online submits do **not** take a separate direct-POST path. This removes the "works online / silently fails offline" split and makes the offline path the tested path.

### AD-2 — Dexie, not a new database

`dexie@4` is already installed. Add `dexie-react-hooks` (live queries) and `fake-indexeddb` (unit tests). Tables:

```
patients      id, facilityId, updatedAt, syncStatus, isHrp
visits        id, patientId, facilityId, visitDate, syncStatus
followUps     id, patientId, status, scheduledDate, track, syncStatus
pendingOps    ++seq, entityType, entityId, op, payload, clientUpdatedAt, attempts, lastError, nextAttemptAt
conflicts     ++id, entityType, entityId, serverVersion, clientVersion, seenAt
meta          key, value   // lastPulledAt, deviceId, schemaVersion
```

Client IDs are `crypto.randomUUID()` so a retried create is idempotent: the server finds the row by ID and updates instead of inserting a duplicate.

### AD-3 — Reuse `/sync/push`; extend it for follow-ups

Patients and visits already fit the contract. Follow-ups need a `followUps` array and a client `completedAt`, because the next 15-day cycle must be anchored to the day the ANM actually closed the cycle, not the day the phone reconnected. The server clamps `completedAt` to `[now - 30 days, now]` to bound clock abuse.

### AD-4 — Server wins, but nothing is discarded

The existing server rule (`existing.updated_at > clientUpdatedAt` → conflict, skip) stays. A conflicted op moves to `conflicts`, is removed from `pendingOps`, and appears in Settings as "Needs review — not synced". No silent overwrite and no local deletion. Merge UI is a later slice.

### AD-5 — Offline is a state, not a wall

Delete `OnlineGuard`. The app opens offline from the cached shell, using a cached session. The Offline page becomes an informational route (`/offline`) linked from the sync banner, not a replacement for `Routes`.

### AD-6 — Field roles first

Local-first reads/writes cover ANM, CHO, and the block-facing follow-up actions those roles perform. BHM/helpdesk/DHS oversight pages remain server-backed; offline they render cached read-only data with an explicit "as of last sync" timestamp. This keeps the Dexie dataset small and the blast radius contained.

### AD-7 — APK built in CI, not on this laptop

No JDK/Android SDK is installed here. Build the signed release APK in a GitHub Actions `android` job (JDK 17 + `android-actions/setup-android`), upload it as a workflow artifact. A local Android Studio install remains a fallback, not a prerequisite. The signing keystore lives in repository secrets, never in the tree.

### AD-8 — Two update channels, stated honestly

- PWA: updated by deploy; service worker prompts, never auto-reloads a dirty form.
- APK: web assets are bundled inside it, so a Render deploy does **not** update the APK. Pilot updates are a new signed APK installed over the old one (same signing key preserves data), announced by a version banner and distributed through the pilot channel.

### AD-9 — Native auth cannot reuse the browser cookie

The Capacitor app serves bundled assets from `https://localhost`, so the current `/api` base and the `SameSite=Lax` refresh cookie do not work across origins. Native builds get an absolute API URL and a body-based refresh token stored encrypted with the PIN key; the web build keeps the httpOnly cookie. Demo credentials are compiled out of pilot builds.

---

## 4. Phases and tasks

Sizes: S = 1–2 files, M = 3–5, L = 5+ (split before starting).

### Phase 0 — Baseline and a failing test (0.5–1 day)

**Task 0.1 — Land the in-flight Matru Suraksha rebrand**
The working tree currently holds uncommitted role/follow-up work (`007_matru_suraksha_roles.sql`, `services/hrp-follow-up.ts`, UI updates). Offline work must start from a green, committed baseline.
- Acceptance: `git status` clean; `npm run check:task` green; app boots locally.
- Verify: `npm run check:task`.
- Depends: user approval to commit the WIP (it is user-authored work).
- Files: the rebrand's existing files.
- Size: M (review + gate run only).

**Task 0.2 — Add the offline write E2E test (expected red)**
Create `packages/client/src/test/e2e/offline-write.spec.ts`: log in online, `context.setOffline(true)`, open `/patients/new`, submit a woman, assert a local "saved on device" confirmation, back online, assert the record exists via the API. Add a Playwright global setup that starts the API against a disposable Postgres (CI service or `docker-compose.preview.yml`) and seeds the demo users.
- Acceptance: the test fails today for the right reason (offline wall / redirect), not because of missing fixtures; it is the tracking test for the slice.
- Verify: `npx playwright test offline-write --project=chromium`.
- Depends: 0.1.
- Files: `packages/client/playwright.config.ts`, `src/test/e2e/offline-write.spec.ts`, `src/test/e2e/global-setup.ts`, `src/test/e2e/fixtures.ts`.
- Size: M.

**Task 0.3 — Interim honest copy**
Until the queue lands, change every claim that a save is local: `Offline.tsx` capability list, `Settings.tsx` "Records save on this device first", `Layout.tsx` "records are saved on this device", `Login.tsx` "Works offline". Say "Read-only offline. Saving requires a connection until the offline update is installed."
- Acceptance: no screen claims a capability the code does not have; the interim text is replaced again in Task 2.7 when the queue is real.
- Verify: string search + component tests.
- Depends: 0.1.
- Files: `pages/Offline.tsx`, `pages/Settings.tsx`, `components/Layout.tsx`, `pages/Login.tsx`.
- Size: S.

**Checkpoint 0:** baseline green; a committed red E2E test describes the target; UI copy is truthful.

---

### Phase 1 — Local store, session, sync engine (2–3 days)

**Task 1.1 — Cached session that survives offline**
Persist `{ user, cachedAt }` on successful login / `me`. `ProtectedRoute` and `PublicRoute` use it when offline; when online they still validate against the server. Change `api.request` so a 401 clears the session only when the browser is online and refresh genuinely failed; a thrown `fetch` (no network) must not `localStorage.clear()`.
- Acceptance: airplane mode + valid cached session + reload `/patients` renders the app, not `/login`; logout still clears everything; a real 401 online still redirects.
- Verify: unit tests for the cache and the 401 branch; component test for the guard.
- Depends: 0.1.
- Files: `lib/session.ts`, `lib/api.ts`, `App.tsx`, new `lib/session-cache.ts`, tests.
- Size: M.

**Task 1.2 — Dexie schema and repositories**
Add `lib/db/local-db.ts` (schema v1, indexes above) and `lib/db/repositories.ts` (`upsertPatient/Visit/FollowUp`, `getPatient`, `listPatients`, `listVisits`, `listFollowUps`, `pendingCount`, `clearAll`, `getMeta/setMeta`). Add `deviceId` on first use.
- Acceptance: entities round-trip; queue survives a reload; `clearAll` removes every table; no PHI written to `localStorage`.
- Verify: Vitest with `fake-indexeddb`; add the dev dependency.
- Depends: 1.1.
- Files: `lib/db/local-db.ts`, `lib/db/repositories.ts`, `lib/db/ids.ts`, `package.json`, tests.
- Size: M.

**Task 1.3 — Queue engine and drain triggers**
`lib/sync/queue.ts`: typed ops (`patient.create`, `patient.update`, `visit.create`, `followUp.update`), monotonic `seq`, single-flight `drain()`, 100-item chunks, exponential backoff (5 s → 30 s → 2 min → 5 min cap), attempts/lastError, and triggers on app start, `online`, `visibilitychange`, and manual retry. `lib/sync/push.ts` builds `SyncPayload`, calls `api.sync.push`, applies the returned scoped entities to Dexie, clears acked ops, stores conflicts, and updates `lastPulledAt`.
- Acceptance: one op drains exactly once; a failed drain retries with backoff and does not spin; two triggers never run concurrent drains; 250 queued ops drain in three chunks; a conflict is stored, not dropped.
- Verify: unit tests with a fake API and fake-indexeddb; integration test that pushes the same UUID twice and asserts one row.
- Depends: 1.2; server Task 1.4a for partial-failure behaviour.
- Files: `lib/sync/queue.ts`, `lib/sync/push.ts`, `lib/sync/triggers.ts`, tests.
- Size: M.

**Task 1.4a — Make `/sync/push` transactional and per-item**
Wrap the push in `db.transaction()`. Replace the current "first missing patient → 404, abort the rest" behaviour with per-item results: `accepted`, `rejected` (entity, id, reason), `conflicts`. One bad visit must not roll back patients that were already valid, and must not block later items.
- Acceptance: a payload with one bad visit still writes the valid patient and returns a rejection; a thrown DB error rolls back the whole transaction; the response shape is covered by a schema test.
- Verify: server integration tests.
- Depends: none (can run in parallel with 1.1–1.3).
- Files: `packages/server/src/routes/sync.ts`, `packages/shared/src/schemas.ts`, `routes/sync.test.ts`.
- Size: M.

**Task 1.4b — Follow-up sync with real completion time**
Extend `SyncPayloadSchema` with `followUps` (`id`, `status`, `notes`, `completedAt`, `updatedAt`). Server applies the same scope/permission checks as the REST route, uses `completedAt` for `completed_at`, and schedules the next `FIELD_15_DAY` row from that date. Clamp to `[now - 30d, now]`.
- Acceptance: a follow-up completed offline on day 0 and synced on day 3 closes on day 0 and schedules day 15, not day 18; a double push creates only one next cycle; unauthorised scope is rejected.
- Verify: server integration tests; shared schema tests.
- Depends: 1.4a, 1.2.
- Files: `packages/shared/src/schemas.ts`, `packages/server/src/routes/sync.ts`, `routes/follow-ups.ts`, `services/hrp-follow-up.ts`, tests.
- Size: M.

**Checkpoint 1:** session survives offline; Dexie persists; queue drains and retries; push is transactional; follow-up dates are correct. `check:task` green.

---

### Phase 2 — Field flows local-first (2–3 days)

**Task 2.1 — Pre-cache the assigned cohort**
On login and app start (online, field roles), call `api.sync.pull({ since: lastPulledAt })` and upsert into Dexie. Apply the push response too. Skip the bulk pull for district roles.
- Acceptance: after one online login, the ANM's patient list, visits and follow-ups are available offline; a second pull with `since` transfers only deltas; a failed pull leaves the existing cache intact.
- Verify: unit + integration test with two sync rounds.
- Depends: 1.2.
- Files: `lib/sync/pull.ts`, `lib/sync/engine.ts`, `lib/db/repositories.ts`, tests.
- Size: M.

**Task 2.2 — Patients list and detail read from Dexie**
Replace `api.patients.list/get` as the first render source with Dexie queries (`useLiveQuery`), refreshing from the server when online. Pending records show a "Waiting to sync" badge.
- Acceptance: offline list and detail render from cache; a pending patient is visible immediately; detail shows cached visits.
- Verify: component tests; manual airplane-mode check.
- Depends: 1.2, 2.1.
- Files: `pages/Patients.tsx`, `pages/PatientDetail.tsx`, `lib/db/queries.ts`, tests.
- Size: M.

**Task 2.3 — AddPatient writes locally first**
Validate → generate UUID → write patient + enqueue `patient.create` → show "Saved on device" and navigate. If online, kick a drain in the background. Disable the submit button while the local write is in flight.
- Acceptance: offline create survives a reload; reconnect syncs exactly one row; a double tap creates one patient.
- Verify: component test with a mocked repository; E2E `offline-write` turns green.
- Depends: 1.3, 2.2.
- Files: `pages/AddPatient.tsx`, `lib/sync/queue.ts`, tests.
- Size: S.

**Task 2.4 — NewVisit writes locally first + real error handling**
Same pattern; the visit references the local patient UUID. Add an `onError` path that keeps the form populated and shows a readable message (currently silent).
- Acceptance: offline visit appears on the patient timeline immediately; a local write failure (quota) shows an alert and does not navigate; reconnect syncs one visit.
- Verify: component test; E2E `offline-visit`.
- Depends: 2.3.
- Files: `pages/NewVisit.tsx`, `pages/PatientDetail.tsx`, tests.
- Size: M.

**Task 2.5 — PatientDetail edits locally first**
Patient edits write Dexie + `patient.update`; show pending state until acked.
- Acceptance: offline edit persists and syncs; a conflicting server version lands in Settings, not silently discarded.
- Verify: component + integration tests.
- Depends: 2.3.
- Files: `pages/PatientDetail.tsx`, tests.
- Size: S.

**Task 2.6 — Field follow-ups locally**
`FieldFollowUpPanel` completion and `NOT_REACHABLE` write Dexie + `followUp.update` with `completedAt = now`; show "Waiting to sync" until acked. Block/dispatch actions stay online-only and are visibly disabled offline.
- Acceptance: offline completion persists; on sync the server stores the real completion date and schedules the next cycle from it; an offline field worker cannot close a `BLOCK_15_DAY` row.
- Verify: E2E `offline-followup`; server integration from 1.4b.
- Depends: 1.4b, 2.2.
- Files: `components/follow-ups/FieldFollowUpPanel.tsx`, `pages/FollowUps.tsx`, `pages/FieldHome.tsx`, tests.
- Size: M.

**Task 2.7 — Real sync status UI**
One accessible status component in `Layout` (online/offline, queue count, "Synced 2 min ago", "Sync failed — retry") and a rebuilt Settings sync tab: pending count, failed items, last error, storage estimate, retry, "Clear local data" with confirmation. Delete the empty-payload `syncMutation`.
- Acceptance: counts match Dexie; retry drains; no "Sync complete" unless the queue is empty; status is announced with `role="status"` and not conveyed by colour alone.
- Verify: component tests; manual.
- Depends: 2.3–2.6.
- Files: new `components/SyncStatus.tsx`, `components/Layout.tsx`, `pages/Settings.tsx`, tests.
- Size: M.

**Task 2.8 — Dashboard and FieldHome offline**
Read counts from Dexie when offline and label them "as of <time>"; never leave a spinner running offline.
- Acceptance: offline dashboard renders in under 1 s; timestamp shown; no network spinner.
- Verify: component test; manual.
- Depends: 2.2.
- Files: `pages/Dashboard.tsx`, `pages/FieldHome.tsx`, tests.
- Size: S.

**Checkpoint 2:** the three offline E2E flows pass (register → visit → follow-up → reconnect); manual airplane-mode run on desktop and Android Chrome; data survives a reload.

---

### Phase 3 — PWA shell hardening (0.5–1 day)

**Task 3.1 — Navigation fallback, update prompt, cache cleanup**
Add `navigateFallback: "/index.html"` with `navigateFallbackDenylist: [/^\/api\//, /\/sw\.js$/]`. Switch `registerType` to `prompt`; show an update banner; never reload while a form is dirty. Remove the `NetworkFirst` API cache (Dexie is the offline source of truth); delete stale `api-cache` entries on activate.
- Acceptance: a cold offline deep link (`/patients/<id>`) returns the shell; an update prompt does not interrupt a half-filled form; Cache Storage contains no patient/visit responses.
- Verify: Playwright cold-start test + cache inspection.
- Depends: 2.7.
- Files: `vite.config.ts`, `utils/sw.ts`, new `components/UpdatePrompt.tsx`, tests.
- Size: M.

**Task 3.2 — Manifest, icons, theme, persistent storage**
Fix `theme_color` `#16a34a` → `#0D7A73`, `background_color` → `#F6F8FA`, `short_name` → `Matru` (launcher truncation), add `id`, PNG 192/512 + maskable icons, request `navigator.storage.persist()` after first login.
- Acceptance: installable on Android Chrome; splash/theme match the app; persistent storage granted or the UI states it was denied.
- Verify: Lighthouse installability; manual install.
- Depends: 3.1.
- Files: `vite.config.ts`, `public/*`, `main.tsx`, tests.
- Size: S.

**Checkpoint 3:** installable PWA; cold offline launch; deep link offline; no PHI in Cache Storage.

---

### Phase 4 — Capacitor Android APK (2.5–3 days)

**Task 4.0a — Native API transport and CORS**
The bundled app runs at `https://localhost`; `VITE_API_URL=/api` would call the WebView itself, not the server. Build native with an absolute API URL. Add `https://localhost` (and `capacitor://localhost` if iOS ever matters) to the CORS allowlist with credentials, never `*`.
- Acceptance: a WebView origin can call `/health` and `/auth/login`; the web build still uses same-origin `/api`; wildcard CORS remains rejected.
- Verify: server CORS integration tests; manual WebView call.
- Depends: 3.2.
- Files: `lib/api.ts`, `packages/server/src/index.ts`, `packages/server/src/config.ts`, `.env.example`, tests.
- Size: M.

**Task 4.0b — Native refresh token and demo gating**
The refresh cookie is `SameSite=Lax`, so it is not sent from `https://localhost` to the API. Add a native-only auth path: login/refresh return the refresh token in the body (rotated), the client stores it encrypted with the PIN key, and refresh sends it in the body. The web build keeps the httpOnly cookie. Gate the `ANM001 / password123` demo box behind `VITE_DEMO_MODE` so pilot APKs do not ship it.
- Acceptance: APK login survives the 15-minute access-token expiry and an app restart; web login still uses the cookie; pilot APK shows no demo credentials.
- Verify: auth integration tests for both client types; device test.
- Depends: 4.0a, 1.1.
- Files: `routes/auth.ts`, `lib/api.ts`, `lib/session-cache.ts`, `pages/Login.tsx`, tests.
- Size: M.

**Task 4.1 — Add Capacitor and the Android project**
Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/network`. `capacitor.config.ts`: appId `in.gov.araria.matrusuraksha` (confirm), appName `Matru Suraksha`, `webDir: "dist"`, `androidScheme: "https"`, cleartext false. `npx cap add android`; set `minSdk 23`, `targetSdk 35`, `allowBackup=false`, icons and splash.
- Acceptance: debug APK builds and launches the app on a device/emulator; no cleartext; backups disabled.
- Verify: `npx cap sync android` + `gradlew assembleDebug`.
- Depends: 3.2.
- Files: `package.json`, `capacitor.config.ts`, `android/*`, docs.
- Size: M.

**Task 4.2 — Native lifecycle and storage behaviour**
Drain on `appStateChange` (resume) and `networkStatusChange` (connected); request persistent storage; handle the hardware back button so it does not exit mid-form; verify IndexedDB survives an app kill and relaunch.
- Acceptance: record offline → kill app → relaunch offline → record is present; reconnect → syncs; back button on a dirty form prompts instead of exiting.
- Verify: device test matrix.
- Depends: 4.1.
- Files: `lib/native.ts`, `main.tsx`, `App.tsx`, `android/app/src/main/AndroidManifest.xml`.
- Size: M.

**Task 4.3 — Signed release APK pipeline**
No local JDK/SDK, so add `.github/workflows/android.yml`: checkout, Node 20, JDK 17, `android-actions/setup-android`, `npm ci`, `npm run build`, `npx cap sync android`, decode keystore from secrets, `gradlew assembleRelease`, upload `matru-suraksha-<version>.apk`. Version from tag/`package.json`; `versionCode` monotonic.
- Acceptance: a manual/tag run produces a signed APK artifact; it installs over a previous build with the same key and keeps data; secrets are not in the tree.
- Verify: workflow run on `workflow_dispatch`; install on a clean device.
- Depends: 4.1.
- Files: `.github/workflows/android.yml`, `android/app/build.gradle`, `docs/runbooks/offline-pilot.md`.
- Size: M.

**Task 4.4 — Export, wipe, and update notice**
Settings gains "Export my data" (JSON of patients/visits/follow-ups/pending ops, shared via the Android share sheet), "Clear local data" (confirm + re-auth), and an "Update available" banner driven by a small `version.json` / `/api/app/version`.
- Acceptance: export opens the share sheet; clearing wipes Dexie and caches; the banner names the new version and the install steps.
- Verify: device test; unit test for the export serializer.
- Depends: 4.2.
- Files: `lib/export.ts`, `pages/Settings.tsx`, `packages/server/src/routes/app.ts` or `public/version.json`, tests.
- Size: M.

**Task 4.5 — Device matrix and pilot runbook**
Test Android 10/13/14 (whatever is available), airplane mode, throttled 2G, low storage, clock skew ±1 day, app kill, reboot, and an APK upgrade. Write `docs/runbooks/offline-pilot.md`: install, first login online, offline workflow, sync troubleshooting, update install, lost-device wipe.
- Acceptance: results table completed; all critical flows pass; runbook usable by someone who did not write it.
- Verify: manual sign-off.
- Depends: 4.3, 4.4.
- Files: `docs/runbooks/offline-pilot.md`.
- Size: S.

**Checkpoint 4:** signed APK on a physical phone; full offline flow; sync on resume; export works; update over old APK preserves data.

---

### Phase 5 — Pilot readiness (0.5–1 day)

**Task 5.1 — Privacy gate for real PHI**
Decide explicitly: synthetic data only, or real patient data with device PIN/app lock, `allowBackup=false`, logout wipe, idle timeout, no PHI in logs or Cache Storage. Record the decision and the residual risk (IndexedDB is not encrypted at rest in a WebView).
- Acceptance: signed decision in `docs/runbooks/offline-pilot.md`; if real PHI, every control above is implemented and tested.
- Verify: checklist review.
- Depends: 4.5.
- Files: `docs/runbooks/offline-pilot.md`, `docs/compliance/*`.
- Size: S.

**Task 5.2 — Support diagnostics**
A diagnostics panel (device ID, app version, queue depth, last sync, last error, storage) with "Copy diagnostics" that contains no patient identifiers.
- Acceptance: support can diagnose a stuck device from the copied text.
- Verify: unit test for redaction; manual.
- Depends: 2.7, 4.4.
- Files: `pages/Settings.tsx`, `lib/diagnostics.ts`, tests.
- Size: S.

**Task 5.3 — Final gates**
`npm run check:task`, `npm run check:full`, `npm run check:bundle`, offline Playwright suite, APK smoke.
- Acceptance: changed-line coverage ≥ 80%; bundle ≤ 170 kB main / 250 kB total gz; no red-line suppressions; all offline E2E green.
- Verify: the commands above.
- Depends: all.
- Size: S.

**Checkpoint 5 (pilot sign-off):** APK handed to stakeholders, runbook delivered, privacy decision signed, gates green.

---

## 5. Dependency order

```
0.1 → 0.2, 0.3
0.1 → 1.1 → 1.2 → 1.3 ─┬→ 2.3 → 2.4 → 2.5
                         ├→ 2.1 → 2.2 → 2.6
1.4a ───────────────────┘
1.4a → 1.4b → 2.6
2.1–2.6 → 2.7 → 2.8
2.7 → 3.1 → 3.2 → 4.1 → 4.2 → 4.3 → 4.4 → 4.5
4.5 → 5.1 → 5.2 → 5.3
```

Parallelisable: 1.4a with 1.1–1.3; 3.x design work with 2.x; 4.3 workflow authoring with 4.2 testing.

---

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| WebView evicts IndexedDB | Lost patient data | `storage.persist()`, export/backup, low-storage test, keep queue and entities in one DB |
| Retry creates duplicates | Double records | Client UUIDs + server upsert-by-ID; double-push integration test |
| One bad item blocks the queue | Silent backlog | Per-item outcomes (Task 1.4a), conflicts table, visible failed count |
| Clock skew | Wrong conflict/completion date | Server timestamp authority; clamp `completedAt`; document ±1 day test |
| Auto-update reloads a dirty form | Lost input | `registerType: "prompt"`, dirty-form guard |
| APK update wipes data | Field data loss | Same signing key, `allowBackup=false` but upgrade-preserving; test upgrade path |
| PHI in Cache Storage / logs | Privacy breach | Remove API runtime cache; no PHI in diagnostics; privacy gate |
| Dexie code hard to unit-test | Coverage gate fails | `fake-indexeddb` unit tests + E2E; repo functions kept pure where possible |
| Android build secrets leak | Keystore compromise | GitHub secrets only; never commit keystore; document rotation |
| Sideloaded APK has no auto-update | Stale clients | Version banner + pilot distribution process; no silent web-only fix |

---

## 7. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Pilot data: synthetic only vs real PHI with Level 2 controls | **Open** — see Appendix A. Real PHI also requires a non-shared backend. |
| D2 | Android package ID `in.gov.araria.matrusuraksha` | **Confirmed** (subject to district IT owning the `in.gov` namespace). |
| D3 | Conflicts: server wins, unsynced version kept and shown, no automatic merge | **Proposed** — confirm whether "UI merge" means refetch or field-level merge. |
| D4 | APK channel: CI → GitHub Release → shared-drive mirror → WhatsApp link | **Proposed** — see the answer for trade-offs. |
| D5 | Offline scope: ANM/CHO full local-first; BHM/helpdesk/DHS online-first read-only offline | **Confirmed**. |

Notes:

- **D1 hard constraint:** the free Render/Neon demo stays synthetic-only. Real PHI needs a separate pilot backend with a data-processing agreement. App-level encryption does not make shared free infrastructure acceptable.
- **D3:** React Query refetching server data is display refresh, not conflict resolution. A queued edit still needs a policy; the proposed one preserves both versions and never silently discards the field worker's entry.

---

## 8. Verification commands

```bash
npm run check:fast
npm run check:task
npm run check:full
npm run check:bundle
npx playwright test --project=offline
cd packages/client && npx cap sync android
```

Manual release checks: install the APK on a physical Android device, enable airplane mode, complete register → visit → follow-up, kill and relaunch, reconnect, confirm the rows in PostgreSQL and the next cycle date.

---

## Appendix A — Development-level PHI controls (Level 2)

Only needed if D1 = real PHI. Without these, the pilot stays synthetic.

| Layer | Control | Effort |
|---|---|---|
| App lock | 6-digit PIN, PBKDF2-SHA256 (600k iterations), lock on launch and after 3 min in the background, 10 failures → wipe, PIN change requires the old PIN | 0.5 d |
| Local encryption | AES-256-GCM on direct identifiers (name, ASHA name/phone) and free-text notes; key derived from the PIN and held only in memory; HMAC blind index for offline name search | 1 d |
| Wipe | Logout, failed-PIN threshold, server "revoke device" flag applied on next sync; uninstall + `allowBackup=false` | 0.5 d |
| Android hardening | `FLAG_SECURE` (no screenshots or recents preview), `allowBackup=false`, no cleartext, WebView debugging off in release, R8 | 0.5 d |
| Backend | Separate non-shared pilot environment; TLS; DB encryption at rest; least-privilege credentials; access audit; encrypted backups + restore test | 1 d + infra |
| Process | Device register (employee ↔ device ↔ phone), consent notice/record, lost-device runbook, retention/purge | 0.5 d |

**Residual risk, stated up front:** a rooted or forensically examined device can bypass app-level controls; the server stores plaintext for authorised users; coded clinical fields stay unencrypted locally so dashboards and follow-up queries work. This is a closed-pilot bar, not a production/DPDP certification.

**Not required for the dev-level pilot:** SQLCipher, MDM, SSO, hardware-backed attestation, field-level audit hash chains.

**Conditional tasks if D1 = real PHI:**

- **5A.1 App PIN lock and key management** — PIN setup/change/unlock, PBKDF2 verifier, DEK wrapped by the PIN key, in-memory only, auto-lock. Depends: 1.2, 4.1.
- **5A.2 Field encryption and blind index** — encrypt identifiers/notes in the repository layer; decrypt before render and before sync; HMAC name index. Depends: 5A.1.
- **5A.3 Wipe and device revocation** — logout wipe, 10-failure wipe, server `devices` flag checked on sync, admin revoke action. Depends: 5A.1, 4.4.
- **5A.4 Android hardening and pilot backend** — `FLAG_SECURE`, backup rules, release build flags; provision and sign off the separate pilot environment. Depends: 4.1, 4.3.
- **5A.5 Privacy gate** — the written go/no-go from Task 5.1, plus consent/retention evidence. Depends: 5A.2–5A.4.
