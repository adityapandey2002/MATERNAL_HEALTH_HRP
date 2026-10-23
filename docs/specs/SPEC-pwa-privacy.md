# SPEC-pwa-privacy

Status: Approved
Owner: Frontend + Security
Depends on: authz-facility-scope, web-security

## Objective

Keep PHI out of browser caches and remove it from the device when the session ends.

## Scope

- Service worker cache policy.
- IndexedDB and localStorage lifecycle.
- Logout, user switch, and device-loss behavior.
- Source map policy.

## Non-goals

- Full device MDM.
- App-level encryption of IndexedDB in v1; compensating controls must be documented.

## Functional requirements

- `FR-PWA-001`: service worker never caches authenticated `/api` responses.
- `FR-PWA-002`: app shell and static assets only in precache.
- `FR-PWA-003`: logout and user switch clear IndexedDB, localStorage, sessionStorage, and Cache Storage.
- `FR-PWA-004`: no PHI in `localStorage`; access token is short-lived.
- `FR-PWA-005`: production source maps are private and not served publicly.
- `FR-PWA-006`: manifest name, icons, and district branding come from build configuration.
- `FR-PWA-007`: lost-device and shared-device runbooks exist.
- `FR-PWA-008`: offline data retention limit and sync-before-wipe behavior are documented.

## Testing

- Inspect Cache Storage after login, patient view, and logout; no PHI remains.
- IndexedDB is empty after logout.
- Playwright offline test still passes without API caching.
- Source maps absent from the public dist.

## Success criteria

- Cache Storage contains no patient/visit/referral payload.
- Logout wipe test passes.
- PWA still installs and works offline for the app shell.

## Boundaries

Always: wipe on logout. Ask first: caching new API routes. Never: cache PHI.
