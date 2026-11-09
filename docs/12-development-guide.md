# Matru Suraksha — Development Guide

This guide establishes the coding conventions, monorepo workflows, quality gates, and step-by-step procedures for contributing code and extending **Matru Suraksha**.

---

## 1. Monorepo Workflow & Daily Development

Matru Suraksha uses npm workspaces (`package.json`). Dependencies between workspaces are resolved locally via symlinks.

### 1.1 Development Lifecycle
When making changes that span across packages (e.g., adding a field to `@hrp/shared` and consuming it in `@hrp/client` and `@hrp/server`):

1. **Start Shared Compiler Watcher:**
   ```bash
   npm run dev --workspace=packages/shared
   ```
   *Keeps `@hrp/shared/dist` compiled whenever shared files are modified.*

2. **Run Application Services:**
   ```bash
   npm run dev:server    # Terminal 1: Fastify with tsx watch
   npm run dev:client    # Terminal 2: Vite development server with HMR
   ```

---

## 2. Coding Standards & Red-Line Floor

All contributions must strictly comply with the floor constraints defined in `CONSTRAINTS.md`. PRs violating these rules will fail the CI gate immediately.

### 2.1 Non-Negotiable Floor Rules
- **No Suppression Comments:** Never introduce `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `biome-ignore`, or `# type: ignore`.
- **No Unimplemented Stubs:** Never leave `throw new Error("Not implemented")` or empty catch blocks (`catch {}`). Catch blocks must log or explicitly handle errors.
- **No Unverified Test Skips:** Never add `test.skip` or delete assertions to make a test pass.
- **No Hardcoded Secrets:** Never commit API keys, tokens, or plaintext passwords. All credentials must resolve via environment variables.

### 2.2 Naming & Casing Conventions
- **Database Layer (SQL & Kysely):** Table names and database columns use **`snake_case`** (e.g. `is_high_risk`, `visit_number`).
- **Data Transfer Objects & API Payloads:** All JSON request and response payloads use **`camelCase`** (e.g. `isHighRisk`, `visitNumber`). Use `packages/server/src/lib/serializers.ts` to convert database rows to JSON DTOs.
- **TypeScript Types & Interfaces:** Use **`PascalCase`** (e.g. `CreatePatient`, `FollowUpRow`).
- **Files & Components:** React component files use **`PascalCase.tsx`** (e.g., `AddPatient.tsx`); libraries and utility files use **`kebab-case.ts`** (e.g., `date-utils.ts`, `session-cache.ts`).

---

## 3. Step-by-Step Feature Implementation Workflows

### 3.1 Adding a New Database Migration
1. **Create the Migration File:**
   Create a new sequential SQL file in `packages/server/migrations/` (e.g., `010_your_feature.sql`).
   ```sql
   -- 010_your_feature.sql
   ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
   CREATE INDEX IF NOT EXISTS idx_patients_blood_group ON patients (blood_group);
   ```
2. **Update Database Type Definitions:**
   Update `packages/server/src/db/types.ts` to mirror the schema modifications in the TypeScript interface:
   ```typescript
   export interface Patient {
     // ...
     blood_group: string | null;
   }
   ```
3. **Execute Migration Locally:**
   ```bash
   npm run db:migrate --workspace=packages/server
   ```
4. **Update Shared Schemas:**
   Add the new attribute to Zod schemas in `packages/shared/src/schemas.ts`.

---

### 3.2 Adding a New API Endpoint
1. **Define Payload Schema:**
   In `packages/shared/src/schemas.ts`, define the Zod schema and export the inferred type:
   ```typescript
   export const UpdateNotesSchema = z.object({
     notes: z.string().max(500),
   });
   export type UpdateNotes = z.infer<typeof UpdateNotesSchema>;
   ```
2. **Configure Action in Policy Engine:**
   If a new action is required, add it to `ACTIONS` in `packages/server/src/authz/policy.ts` and update the role permission mapping.
3. **Implement Route Handler:**
   Add the route in the appropriate file in `packages/server/src/routes/`:
   ```typescript
   app.patch("/:id/notes", { preValidation: validateBody(UpdateNotesSchema) }, async (request, reply) => {
     assertCan(request.actor, "patient:write", { type: "facility", facilityPath: patient.facility_path });
     // Execute Kysely update query
     return reply.send({ success: true });
   });
   ```
4. **Write Route Unit / Integration Test:**
   Add tests in the corresponding `.test.ts` file covering success, 401 unauthorized, 403 forbidden, and 400 validation failure states.

---

### 3.3 Adding a New Frontend Page or View
1. **Create Page Component:**
   Place new route components in `packages/client/src/pages/YourPage.tsx`. Use UI primitives from `src/components/ui/` (`Panel`, `PageHeader`, `Stat`, `Table`).
2. **Declare Navigation & Scoping:**
   In `packages/client/src/lib/nav.ts`, add the nav item to `NAV_BY_ROLE` for the roles authorized to access the page.
3. **Mount Route in App.tsx:**
   Add the route inside `<ProtectedRoute>` in `packages/client/src/App.tsx`.
4. **Offline Integration:**
   If the view creates or mutates records, ensure it writes to Dexie (`repositories.ts`) and enqueues an operation into `opRepo` rather than performing direct network calls.

---

## 4. Quality Gates & Commit Pre-Flight

Before committing changes, execute the tiered quality checks:

```bash
# Stage 1: Fast Check (Runs in < 5 seconds)
# Validates TypeScript compilation, Biome formatting/linting, and scans for secrets
npm run check:fast

# Stage 2: Task Check (Runs in < 90 seconds)
# Executes unit tests and enforces >= 80% test coverage on all modified lines
npm run check:task

# Stage 3: Full CI Gate (Simulates full PR pipeline)
# Runs full test suite + local secret scan + security scanners
npm run check:full
```

### Checking Test Coverage on Changed Lines:
Matru Suraksha enforces a **minimum 80% line coverage bar on changed lines** (`scripts/check-changed-coverage.mjs`). New logic must be accompanied by corresponding Vitest unit tests.
