# Offline Pilot Runbook (Matru Suraksha)

Status: **Skeleton — to be completed as the offline pilot ships.**
Owner: pilot team
Companion plan: [`tasks/offline-pilot-plan.md`](../../tasks/offline-pilot-plan.md)
Companion task list: [`tasks/offline-pilot-todo.md`](../../tasks/offline-pilot-todo.md)

> **Important:** offline *write* capability is **planned, not implemented**
> today. The app currently requires a network connection to sign in and to save
> patients, visits, and follow-up actions. Read this runbook as the target
> workflow for the pilot build, not the current production behaviour.

## 1. Install the app

### PWA (desktop / CHO)

1. Open `https://hrp-demo.onrender.com` in a supported browser.
2. Use **Install** / **Add to Home Screen** when prompted.
3. Sign in online with a seeded demo account before going offline.

### Android APK (planned, not shipped)

1. Download the signed APK from the pilot distribution channel (GitHub
   Release / shared drive mirror / WhatsApp link, per decision D4).
2. Install the APK. Android may require "Install from unknown sources" to be
   enabled for the browser or file manager used.
3. Sign in online on first launch so the session and assigned cohort can be
   cached.

> The signing keystore lives in repository secrets; the APK is built in CI.
> A new signed APK installed over an older one with the same signing key
> preserves local data.

## 2. First login (must be online)

1. Connect to the network.
2. Sign in with the issued credentials.
3. Wait for the initial sync to finish (assigned patients, visits, and
   follow-ups are cached locally).
4. Confirm the sync status shows "Synced" before going offline.

## 3. Offline workflow (target)

1. Enable airplane mode (or lose connectivity).
2. Open the app; it should load from the cached shell using the cached session.
3. Register a woman, record a visit, or close a 15-day follow-up. Each save
   is written locally first and shows a "Saved on device" confirmation.
4. Pending records show a "Waiting to sync" badge until acknowledged by the
   server.
5. Reconnect. The queue drains automatically (app start, resume, and
   connectivity return). Manual retry is available in Settings.

Notes:

- Sync runs on app start, on resume, and when connectivity returns. There is
  no background sync while the app is killed.
- Conflicts are recorded and surfaced in Settings as "Needs review — not
  synced"; nothing is silently discarded.
- DHS / district helpdesk oversight screens stay online-first with offline
  read-only data labelled "as of last sync".

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

## 6. Privacy decision (open)

- Pilot data policy (synthetic only vs. real PHI with Level 2 controls) is an
  open decision (D1). The free Render/Neon demo stays synthetic-only.
- If real PHI is used, the Level 2 controls in
  [`tasks/offline-pilot-plan.md`](../../tasks/offline-pilot-plan.md) Appendix A
  must be implemented and signed off first.
- Residual risk: IndexedDB in a WebView is not encrypted at rest.

## 7. Device matrix sign-off (to be completed)

Record test results for Android versions available, airplane mode, throttled
2G, low storage, clock skew (+/- 1 day), app kill, reboot, and APK upgrade.

| Device / Android | Airplane mode | Reconnect sync | App kill survival | Upgrade preserves data | Result |
|------------------|---------------|----------------|-------------------|------------------------|--------|
| _TBD_ | | | | | |

## 8. Diagnostics (planned)

A diagnostics panel (device ID, app version, queue depth, last sync, last
error, storage) with "Copy diagnostics" that contains no patient identifiers.