# SPEC-web-security

Status: Approved
Owner: Security
Depends on: secrets-config, authz-facility-scope

## Objective

Harden the public API and browser session against cross-origin abuse, brute force, token theft, and common web attacks.

## Scope

- CORS allowlist, CSRF/Origin checks, rate limits, lockout, security headers.
- Refresh token rotation and revocation.
- Cookie settings and logout.

## Non-goals

- MFA in the pilot.
- WAF configuration code.

## Functional requirements

- `FR-WEB-001`: only configured origins receive CORS credentials; wildcard is rejected in production.
- `FR-WEB-002`: login is limited to 100 requests/min/IP and locked after 5 failures for 15 minutes.
- `FR-WEB-003`: API is limited to 500 requests/min/user; sync to 60/min/user.
- `FR-WEB-004`: helmet, HSTS, CSP, frame-ancestors none, Referrer-Policy, Permissions-Policy.
- `FR-WEB-005`: refresh tokens rotate on use and are revoked on logout, password change, role change, and facility change.
- `FR-WEB-006`: refresh cookie is httpOnly, secure in production, SameSite=Lax/Strict, path `/`.
- `FR-WEB-007`: state-changing requests validate Origin/Referer or CSRF token.
- `FR-WEB-008`: login errors are generic and timing-resistant.
- `FR-WEB-009`: request body limits and trust-proxy settings are enforced.

## Testing

- CORS test rejects an unknown origin.
- Rate-limit and lockout tests.
- Refresh replay and revocation tests.
- CSP smoke test with the built PWA.
- ZAP baseline against staging.

## Success criteria

- No high/critical ZAP findings.
- No wildcard CORS in production config.
- Revoked refresh token returns 401.

## Boundaries

Always: server-side enforcement. Ask first: cookie/session changes. Never: store refresh tokens in localStorage.
