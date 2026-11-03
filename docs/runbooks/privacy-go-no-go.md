# Privacy go/no-go — Phase 5A (device + at-rest protection)

Status: **GO for pilot, conditional on the items marked "must ship before first real record"**

Owner: Security + Product
Last updated: 2026-11-03

## What ships today

- Device PIN lock (Phase 5A.1): PBKDF2 KEK wraps a random 256-bit DEK; 10 failed
  attempts wipe the device; auto-lock after inactivity.
- At-rest encryption (Phase 5A.2): AES-256-GCM on direct identifiers and free-text
  notes; coded clinical fields stay plaintext for dashboards/queries; HKDF-derived
  HMAC blind index for exact-name duplicate detection; logout clears cached
  records but keeps the wrapped key.
- Device registry (Phase 5A.3): client UUID, server `devices` table, JWT `dev`
  claim, revoke → `401 { code: "DEVICE_REVOKED" }`, client `wipeDevice()`.
- Android hardening (Phase 5A.4): `FLAG_SECURE`, WebView debugging off, R8
  shrink + obfuscate, `allowBackup=false`, HTTPS-only scheme.

## Must ship before the first real record

1. **Written device-loss runbook** — owner, steps, who to call, replacement ANM
   handover under the same area code. (See `docs/runbooks/offline-pilot.md`.)
2. **MDM or written compensating control** — the residual at-rest risk in
   IndexedDB during an active session is accepted only with a signed control.
   For the pilot this is the signed "no shared devices, report loss within 24 h"
   acknowledgement from each ANM/CHO.
3. **Retention limit** — cached cohort on device must not exceed the active
   follow-up window; `pullCohort()` already scopes to the actor subtree.
4. **Consent notice** — the woman is told her record is stored on the ANM's
   phone and can be erased by the district on loss.

## Explicitly deferred (not blocking the pilot)

- Remote attestation / SafetyNet: not available on the free tier; revisit before
  scale-out.
- Full-disk encryption of the SQLite/IndexedDB files beyond Web Crypto: Web
  Crypto AES-GCM is the compensating control for now.
- Play Store distribution: sideloaded APK only (D4).

## Go/no-go decision

- **GO** for the synthetic-data demo and the dry run with real staff accounts.
- **NO-GO for real patient records** until items 1–4 above are signed off and
  recorded in the pilot kickoff minutes.
- Demo accounts (`ANM001`/`password123` etc.) remain synthetic-only and must
  never carry real records.