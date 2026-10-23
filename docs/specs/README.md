# Specification System

Every launch-readiness change is specified before implementation. The capability map is the index; each module has one spec. Specs are living documents and are updated before behavior changes.

## Status workflow

Draft -> In review -> Approved -> Superseded

## Required sections

Each `SPEC-*.md` contains:

1. Objective and user outcome
2. Scope and non-goals
3. Actors, roles, and authorization
4. Functional requirements
5. Interfaces and data contracts
6. Audit and privacy behavior
7. Commands, structure, and code style
8. Testing strategy
9. Success criteria
10. Boundaries
11. Open questions

## Common commands

```powershell
npm run dev
npm run build
npm run test
npm run check:fast
npm run check:task
npm run check:full
npm run coverage
npm run db:migrate
npm run db:seed
```

## Common project structure

```text
packages/shared/     Types, Zod schemas, rule engine
packages/server/     Fastify API, database, auth, audit
packages/client/     React PWA, pages, UI kit, service worker
packages/*/src/**/*.test.ts       Unit and integration tests
packages/client/src/test/e2e/     Playwright E2E tests
docs/specs/          Approved specifications
docs/decisions/      Architecture decision records
docs/runbooks/       Operational procedures
tasks/               Implementation plan and task list
```

## Common code style

- TypeScript strict mode, ESM, `.js` import suffixes in server code.
- Zod validates config, request bodies, and query filters.
- Kysely parameterized queries only; no string-built SQL.
- React function components, Tailwind utility classes, shared UI kit.
- Tests use Vitest; E2E uses Playwright.
- No suppression comments, no empty catches, no unimplemented stubs.

## Common testing strategy

- Unit: pure functions, schemas, policy, scope, risk rules.
- Integration: Fastify routes against PostgreSQL; authz matrix and audit assertions.
- E2E: offline capture, sync, referral, supervision, dashboards.
- Changed-line coverage must stay >= 80%.

## Common boundaries

- Always: validate input, enforce authorization server-side, audit PHI access, run `npm run check:fast`.
- Ask first: schema changes, new dependencies, CI workflow changes, production infrastructure.
- Never: commit secrets, weaken constraints, remove tests, log PHI, cache PHI in service workers.
