# ADR-010: PWA Offline PHI Protection

Status: Accepted
Date: 2026-10-23
Owner: Frontend + Security

## Context

The service worker caches `/api/*` responses with NetworkFirst for seven days. Logout does not clear IndexedDB or Cache Storage, so PHI can remain on shared or lost devices.

## Decision

- Never cache authenticated API responses in the service worker.
- Precache only the app shell and static assets.
- Clear IndexedDB, localStorage, sessionStorage, and Cache Storage on logout and user switch.
- Do not serve production source maps publicly.
- Keep access tokens short-lived; never store refresh tokens in JavaScript.
- Document device-loss and shared-device procedures.
- Accept residual at-rest risk in IndexedDB only with a signed compensating control (device lock, MDM, retention limit).

## Alternatives considered

- Encrypt IndexedDB with Web Crypto: stronger, but deferred in the MVP and adds key-management complexity.
- Disable offline mode: unacceptable for ANM field work.

## Consequences

- Offline data remains in IndexedDB during an active session.
- Sync-before-wipe behavior must be defined.
- Lost-device runbook is mandatory.

## Follow-up

Implement `SPEC-pwa-privacy` in Wave 2.
