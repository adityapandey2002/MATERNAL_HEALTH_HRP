# Offline Pilot Runbook (Matru Suraksha)

Status: **In progress — offline read/write and the Android project exist; the signed APK pipeline ships next.**
Owner: pilot team
Companion plan: [`tasks/offline-pilot-plan.md`](../../tasks/offline-pilot-plan.md)
Companion task list: [`tasks/offline-pilot-todo.md`](../../tasks/offline-pilot-todo.md)

> **Where things stand:** the PWA is installable, boots with no connection, and
> saves patients, visits, and follow-ups to the device first. The Android
> project is generated from that same build. Real patient data is **not**
> allowed yet: it needs Level 2 device controls (Phase 5A) and a separate,
> non-shared backend. The public demo stays synthetic-only.

## 1. Install the app

### PWA (desktop / CHO)

1. Open `https://hrp-demo.onrender.com` in a supported browser.
2. Use **Install** / **Add to Home Screen** when prompted.
3. Sign in online with a seeded demo account before going offline.

### Android APK (sideloaded pilot build)

Build the APK in CI — never on a personal machine — so the signing key stays in
repository secrets:

1. Open **Actions → Android APK → Run workflow**.
2. Enter the absolute `api_url` (for example
   `https://pilot-api.example.gov.in/api`) and, optionally, `version_name` and
   `version_code`. Pushing a `v*` tag builds the version from the tag name.
3. Download the `matru-suraksha-apk` artefact, or take the files attached to the
   GitHub Release for a tag build.
4. Check the download against `matru-suraksha-<version>.apk.sha256` before
   sharing it.
5. On the phone, install the APK. Android asks to allow installs from the
   browser or file manager used to open it.
6. Sign in online on first launch so the session and the assigned cohort are
   cached.

A newer APK signed with the same key installs over the old one and keeps local
data.

Local debug build (no signing key needed):

```bash
cd packages/client
npm run build
npx cap sync android
npx cap open android   # or: npm run android:debug
```

Required repository secrets for a signed build:

| Secret | Meaning |
|--------|---------|
| `ANDROID_KEYSTORE_BASE64` | Base64 of the release `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

Losing the keystore means no future build can install over the pilot APK, so
keep an offline copy with district IT.

## 2. First login (must be online)

1. Connect to the network.
2. Sign in with the issued credentials.
3. Wait for the initial sync to finish (assigned patients, visits, and
   follow-ups are cached locally).
4. Confirm the sync status shows "Synced" before going offline.

## 3. Offline workflow

1. Enable airplane mode (or lose connectivity).
2. Open the app; it loads from the cached shell using the cached session.
3. Register a woman, record a visit, or close a 15-day follow-up. Each save is
   written locally first and shows a "Saved on device" confirmation.
4. Pending records show a "Waiting to sync" badge until the server acknowledges
   them.
5. Reconnect. The queue drains automatically (app start, resume, and
   connectivity return — the APK also listens to the real Android network
   state). Manual retry is available in Settings → Sync → **Send now**.

Notes:

- Sync runs on app start, on resume, and when connectivity returns. There is no
  background sync while the app is killed.
- Conflicts are recorded and surfaced in Settings as "Needs review"; nothing is
  silently discarded.
- DHS / district helpdesk oversight screens stay online-first with offline
  read-only data labelled "as of last sync".
- In the APK the hardware back button does not close the app on the home
  screen (it backgrounds it), and a form with unsaved input asks before
  discarding.

## 4. Sync troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| "Saved on device" but record never appears on the server | Queue not drained / offline | Reconnect, open Settings, check pending count and last error, tap retry |
| Login redirects to `/login` offline | No cached session yet | Sign in online first, then retry offline |
| App shows stale list | Pull has not run since last change | Reconnect and pull; check "as of last sync" timestamp |
| Conflict listed in Settings | Server version differs from local edit | Review both versions; re-apply the intended change online |
| APK update wiped local data | Different signing key used | Reinstall using an APK signed with the original key |
| Storage full / IndexedDB evicted | Device storage pressure | Export data (Settings -> Export my data), free storage, re-sync |

## 5. Export, wipe, and update (planned)

- **Export my data:** Settings exports patients/visits/follow-ups/pending ops
  as JSON via the Android share sheet.
- **Clear local data:** requires confirmation and re-authentication; wipes
  IndexedDB and caches.
- **Update available:** banner driven by `version.json` / `/api/app/version`
  names the new version and the install steps. APK updates require installing
  the new signed APK over the old one.

## 6. Privacy decision

- D1 is decided: the pilot carries **real patient data**, so Conditional Phase
  5A is required before any real record is entered: app PIN with PBKDF2 key
  derivation, AES-256-GCM field encryption, blind index for name search, remote
  wipe, `FLAG_SECURE`, and `allowBackup=false`.
- Shipped in 5A.1/5A.2: the PIN derives a KEK that wraps a random data key;
  patient name, phone, ABHA, address, ASHA name/phone, visit and follow-up notes,
  queued sync payloads and conflict copies are AES-256-GCM ciphertext in
  IndexedDB. Exact-name lookup uses an HMAC blind index scoped by facility.
  Changing the PIN re-wraps the data key, so existing records stay readable.
- Still plaintext locally by design: coded clinical fields (risk level, BP,
  haemoglobin, LMP/EDD, gravidity) so dashboards and follow-up queries work.
  The residual risk below covers that trade-off.
- Real records must live on a **separate, non-shared pilot backend**. The free
  Render/Neon demo is shared infrastructure with synthetic seeds only; it must
  never receive patient data.
- APK builds must set `VITE_DEMO_MODE=false`. `build.config.ts` now fails the
  build if a native bundle is left in demo mode, because demo mode skips the PIN.
- Residual risk: a rooted or forensically examined *unlocked* device can bypass
  app-level controls; coded clinical fields and the server copy stay readable to
  anyone with database access. This is a closed-pilot bar, not DPDP certification.

## 7. Device matrix sign-off (to be completed)

Record test results for Android versions available, airplane mode, throttled
2G, low storage, clock skew (+/- 1 day), app kill, reboot, and APK upgrade.

| Device / Android | Airplane mode | Reconnect sync | App kill survival | Upgrade preserves data | Result |
|------------------|---------------|----------------|-------------------|------------------------|--------|
| _TBD_ | | | | | |

## 8. Diagnostics (planned)

A diagnostics panel (device ID, app version, queue depth, last sync, last
error, storage) with "Copy diagnostics" that contains no patient identifiers.