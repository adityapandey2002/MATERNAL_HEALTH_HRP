# Matru Suraksha — Technology Stack

This document details the technologies, libraries, build tools, runtimes, and infrastructure components used in **Matru Suraksha**, with concrete evidence from package manifests and project configuration files.

---

## 1. Stack Summary Table

| Category | Technology | Version | Location / Package | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js | `>=20.0.0` | Root / Engine | Monorepo execution, Fastify API runtime, and build scripting. |
| **Package Management** | npm Workspaces | `10.8.1` | Root `package.json` | Monorepo workspace orchestration across shared, server, and client packages. |
| **Programming Language** | TypeScript | `^5.6.0` | All Workspaces | End-to-end static typing across database schemas, API contracts, and UI. |
| **Frontend Framework** | React | `^18.3.1` | `packages/client` | Component-based user interface for mobile PWA and desktop dashboards. |
| **Client Bundler** | Vite | `^5.4.8` | `packages/client` | High-performance build tool, ESM development server, and proxy configuration. |
| **Routing** | React Router DOM | `^6.26.1` | `packages/client` | Client-side routing, protected auth routes, and role-based views. |
| **Server State / Cache** | TanStack Query | `^5.56.0` | `packages/client` | Declarative asynchronous fetching, mutation management, and cache invalidation. |
| **Styling & Design** | Tailwind CSS | `^3.4.17` | `packages/client` | Utility-first responsive design, custom health triage color tokens, touch targets. |
| **Client Offline DB** | Dexie.js | `^4.0.7` | `packages/client` | High-performance IndexedDB wrapper powering the offline-first persistence layer. |
| **Mobile Runtime** | Capacitor | `^6.2.3` | `packages/client` | Cross-platform runtime wrapping the PWA into a standalone Android APK. |
| **Service Worker** | Workbox (Vite PWA) | `^0.20.5` | `packages/client` | Progressive Web App precaching, runtime caching, and service worker lifecycle. |
| **Backend Framework** | Fastify | `^4.28.1` | `packages/server` | Low-overhead, high-throughput Node.js HTTP framework with plugin architecture. |
| **Database Engine** | PostgreSQL | `16-alpine` | Infrastructure | Primary relational persistence supporting JSONB, timestamps, and indexes. |
| **Query Builder** | Kysely | `^0.27.3` | `packages/server` | Type-safe SQL query builder providing compile-time query verification. |
| **Database Driver** | pg (node-postgres) | `^8.12.0` | `packages/server` | Native PostgreSQL connection pooling and client transport. |
| **Authentication** | Fastify JWT / Cookie | `^8.0.1` / `^9.4.0` | `packages/server` | Access token issuance, JWT verification, and httpOnly cookie management. |
| **Cryptography** | bcryptjs / Web Crypto | `^2.4.3` / Native | Server / Client | Password hashing (bcrypt) and AES-256-GCM field-level offline encryption. |
| **Schema Validation** | Zod | `^3.23.8` | `packages/shared` | Runtime input validation, schema inference, and contract consistency. |
| **Linter & Formatter** | Biome | `^1.9.0` | All Workspaces | Fast code analysis, syntax linting, and style enforcement. |
| **Testing Framework** | Vitest | `^2.1.0` | All Workspaces | Unit and integration test execution with V8 coverage collection. |
| **Integration Test DB**| Testcontainers | `^10.12.0` | `packages/server` | Ephemeral Docker-managed PostgreSQL instances for integration test suites. |
| **E2E Testing** | Playwright | `^1.47.0` | `packages/client` | Browser automation for offline service worker and end-to-end user flows. |
| **Security Scanners** | Gitleaks / Semgrep / OSV| v2 / Latest | CI & Scripts | Static secret detection, AST security vulnerability scanning, and dep auditing. |
| **Containerization** | Docker / Compose | Multi-stage | Root & Infrastructure| Multi-stage container builds for client, server, and local development. |

---

## 2. Workspace & Monorepo Architecture

The repository is structured as an npm multi-package workspace (`package.json`):

```
packages/
├── shared/     # @hrp/shared: Types, Zod validation schemas, clinical rule engine
├── server/     # @hrp/server: Fastify HTTP API, Kysely database layer, authz
└── client/     # @hrp/client: React PWA, Dexie offline store, Capacitor Android shell
```

### Dependency Rules:
1. `packages/client` imports `@hrp/shared`. It **never** imports `packages/server`.
2. `packages/server` imports `@hrp/shared`. It **never** imports `packages/client`.
3. `packages/shared` has zero internal runtime dependencies (only Zod). It never imports from `client` or `server`.

This strict unidirectional layering guarantees that clinical algorithms and validation schemas remain canonical without circular dependencies or server leaks into client bundles.

---

## 3. Technology Deep-Dives

### 3.1 TypeScript & Shared Validation (`@hrp/shared`)
- **Role:** Source of truth for domain contracts across the entire stack.
- **Evidence:** `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`.
- **Relationship:** Zod schemas in `shared` generate compile-time TypeScript types (`z.infer<typeof Schema>`) used directly by React components and Fastify route handlers. Fastify routes validate incoming requests against these schemas before executing business logic.

### 3.2 Frontend Stack (`@hrp/client`)
- **React 18 & Vite:** The user interface uses React functional components and hooks. Vite provides lightning-fast HMR during development and outputs an optimized bundle conforming to strict size budgets (`<= 170 kB` gzipped main JS bundle verified by `size-limit`).
- **TanStack Query (React Query):** Manages server data synchronization. When online, query caching and optimistic updates provide instant UI feedback; mutations invalidate related keys (`["patients"]`, `["hrp", "follow-ups"]`) automatically.
- **Tailwind CSS:** Configured with custom design system tokens matching Indian public health branding (primary teal `#0D7A73`, canvas slate, and strict triage color levels `GREEN`, `AMBER`, `RED`).
- **Dexie.js & Offline Synchronization:** Dexie acts as the local IndexedDB engine (`packages/client/src/lib/db/local-db.ts`). It persists local patients, visits, follow-up records, and an operational mutation queue (`pendingOps`).
- **Web Crypto API:** Implements AES-256-GCM encryption for patient direct identifiers on the device (`packages/client/src/lib/crypto.ts`). Keys are derived using PBKDF2 (600,000 iterations) from an operator's 6-digit PIN and held strictly in RAM.
- **Capacitor 6:** Bridges the web application to native Android features (`packages/client/capacitor.config.ts`), enabling a standalone APK build that runs in Android's WebView with native device security flags (`FLAG_SECURE`, `allowBackup=false`).

### 3.3 Backend Stack (`@hrp/server`)
- **Fastify v4:** Selected over Express for high I/O throughput, schema-driven validation, and low memory footprint.
- **Kysely Query Builder:** Operates as a pure, type-safe SQL query builder over PostgreSQL (`packages/server/src/db/client.ts`). Unlike heavy ORMs (such as Prisma or TypeORM), Kysely generates deterministic parameterized SQL queries without runtime reflection overhead, making query execution predictable and auditable.
- **Authentication & Security Plugins:**
  - `@fastify/jwt`: Signs and validates access tokens carrying the actor's user ID, role, and home facility path.
  - `@fastify/cookie`: Manages `refreshToken` cookies with `httpOnly`, `SameSite=Lax`, and path isolation.
  - Custom CORS: Supports same-origin production proxies and the Android Capacitor origin (`https://localhost`).

### 3.4 Quality & DevOps Stack
- **Testing:** Vitest executes unit tests across shared, server, and client code. Server integration tests utilize Testcontainers to spin up real PostgreSQL containers.
- **Biome:** Replaces ESLint and Prettier, providing instant formatting and linting that checks against Red-Line rules (no `@ts-ignore`, no empty catch blocks).
- **Security Scanners:**
  - `scripts/scan-secrets.mjs` & Gitleaks: Scans tracked repository files for private keys, AWS tokens, API secrets, and JWT strings.
  - Semgrep: Scans AST for OWASP Top 10 vulnerabilities.
  - OSV-Scanner: Scans dependencies against the Open Source Vulnerabilities database.
