# Matru Suraksha — Project Structure

This document provides a comprehensive structural directory breakdown of the **Matru Suraksha** repository, explaining the purpose, layout, and contents of each module and directory.

---

## 1. Top-Level Repository Layout

```
HRP/
├── .github/                      # GitHub configuration and automation workflows
│   └── workflows/
│       ├── ci.yml                # Quality gates (fast, task, full, preview deploy)
│       └── android.yml           # Signed release APK build pipeline
├── docs/                         # Architecture, runbooks, specifications, and guides
│   ├── decisions/                # Architecture Decision Records (ADRs 001–017)
│   ├── diagrams/                 # Mermaid architecture, flow, and schema diagrams
│   ├── ideas/                    # Historical product and MVP ideation documents
│   ├── runbooks/                 # Operational runbooks (deploy, pilot, backup, privacy)
│   ├── specs/                    # Formal technical specifications and capability maps
│   ├── PROJECT_MAP.md            # Quick reference index for human and AI developers
│   └── STARTUP.md                # Environment bootstrapping quickstart guide
├── packages/                     # Monorepo workspace packages
│   ├── client/                   # Frontend React PWA + Capacitor Android application
│   ├── server/                   # Fastify backend API + PostgreSQL / Kysely layer
│   └── shared/                   # Shared TypeScript models, Zod schemas, rule engine
├── scripts/                      # Tooling and quality gate verification scripts
│   ├── check-changed-coverage.mjs# Enforces >= 80% coverage on changed lines
│   ├── check-retired-identifiers.mjs # Prevents legacy terms and retired roles
│   ├── check-shared-exports.mjs  # Enforces clean package export resolution
│   ├── run-security-tool.mjs     # Security scanner runner (Semgrep / OSV-Scanner)
│   ├── scan-secrets.mjs          # Local regex-based secret detection tool
│   ├── smoke-test.mjs            # End-to-end HTTP API smoke test suite
│   └── verify-backup.mjs         # Database backup and restore verification utility
├── tasks/                        # Implementation plans and development task checklists
│   ├── offline-pilot-plan.md     # Offline pilot and Android APK technical plan
│   ├── offline-pilot-todo.md     # Phase-by-phase offline pilot checklist
│   ├── plan.md                   # Long-term production release roadmap (Waves 0–5)
│   └── todo.md                   # Production launch task checklist
├── .env.example                  # Canonical environment configuration template
├── AGENTS.md                     # Constraints and rules for automated coding assistants
├── API_DOCUMENTATION.md          # Comprehensive REST API endpoint reference
├── biome.json                    # Biome linting and formatting configuration
├── CONSTRAINTS.md                # Binding project quality constraints and floor rules
├── docker-compose.yml            # Local development multi-container orchestration
├── docker-compose.preview.yml    # Single-origin preview container configuration
├── docker-compose.prod.yml       # Production registry image compose configuration
├── Dockerfile                    # Single-origin demo container (Nginx + Node)
├── Dockerfile.client             # Standalone client production container image
├── Dockerfile.server             # Standalone server production container image
├── osv-scanner.toml              # OSV-Scanner dependency audit configuration
├── package.json                  # Root monorepo workspace definition and scripts
├── README.md                     # Root project documentation and getting-started guide
├── render.yaml                   # Render.com blueprint for demo deployments
└── tsconfig.base.json            # Base TypeScript configuration shared by all workspaces
```

---

## 2. Shared Workspace (`packages/shared/`)

The shared package (`@hrp/shared`) contains domain contracts, validation rules, and algorithmic calculators that are compiled to JavaScript and consumed by both client and server.

```
packages/shared/
├── src/
│   ├── date-utils.ts             # Follow-up scheduling, EDD, and date math helpers
│   ├── follow-ups.ts             # ANC clinical contact tests by visit schedule
│   ├── hrp-complications.ts      # 9 High-Risk Pregnancy complication definitions
│   ├── hrp-follow-up.ts          # Follow-up status enums, badges, and track metadata
│   ├── hrp-reasons.ts            # High-risk clinical reasoning mapping
│   ├── index.ts                  # Main package entrypoint re-exporting modules
│   ├── rules.ts                  # Algorithmic risk score calculation engine
│   ├── schemas.ts                # Zod schemas for validation and API payload types
│   ├── types.ts                  # Base TypeScript domain interfaces and enums
│   └── *.test.ts                 # Comprehensive unit test coverage for pure functions
├── package.json                  # Package configuration, scripts, and export map
└── tsconfig.json                 # TypeScript build configuration
```

### Key Modules:
- `schemas.ts`: Defines runtime Zod validation objects (`CreatePatientSchema`, `CreateVisitSchema`, `DispatchFollowUpSchema`, `UpdatePatientSchema`) and infers TypeScript types.
- `rules.ts`: Implements `calculateRiskScore()` which evaluates danger signs, vitals, parity, and age to classify pregnancies into `GREEN`, `AMBER`, or `RED` risk levels.
- `date-utils.ts`: Contains `scheduleFollowUp()` which calculates the target follow-up date and track based on referral status and risk level.

---

## 3. Server Workspace (`packages/server/`)

The backend package (`@hrp/server`) runs on Fastify, connecting to PostgreSQL via Kysely.

```
packages/server/
├── migrations/                   # Sequential SQL migrations executed by Kysely
│   ├── 001_baseline.sql          # Base tables: facilities, users, patients, visits
│   ├── 002_scope_indexes.sql     # Materialized path and updated_at indexes
│   ├── 003_authz_foundation.sql  # Facility levels, responsibilities, role mapping
│   ├── 004_authz_hardening.sql   # Unique path constraint, sync queue scoping
│   ├── 005_hrp_follow_up.sql     # HRP columns, follow_ups table, nodal designations
│   ├── 006_hrp_helpdesk.sql      # Helpdesk email login, index optimizations
│   ├── 007_matru_suraksha_roles.sql # 6 Matru Suraksha roles, 15-day cycle migration
│   ├── 008_device_registry.sql   # Device authorization and remote revocation
│   └── 009_repair_facility_paths.sql # Recursive hierarchical facility path repair
├── src/
│   ├── authz/                    # Policy and scope engine
│   │   ├── policy.ts             # Action permissions matrix (assertCan)
│   │   └── scope.ts              # Hierarchical facility path prefix checks
│   ├── db/                       # Database client and management tools
│   │   ├── client.ts             # Kysely database instance construction
│   │   ├── demo-bootstrap.ts     # In-memory bootstrap and demo data seeding
│   │   ├── facility-path.ts      # Path computation utilities
│   │   ├── migrate.ts            # CLI migration runner
│   │   ├── migration-plan.ts     # Sequential migration resolver
│   │   ├── seed.ts               # Demo data seeder for Araria District
│   │   ├── seed-guard.ts         # Safety checks preventing accidental production seeds
│   │   ├── seed-raniganj.ts      # Dedicated pilot seed script for Raniganj Block
│   │   └── types.ts              # TypeScript interface definitions for all SQL tables
│   ├── lib/                      # Internal server helpers and utilities
│   │   ├── cors.ts               # Dynamic CORS origin resolution
│   │   ├── mappers.ts            # DTO to SQL entity mappers
│   │   ├── pagination.ts         # Query parameter parsing and sort sanitization
│   │   ├── serializers.ts        # Database row to public camelCase JSON serializers
│   │   ├── static-client.ts      # Fastify static SPA fallback serving client bundle
│   │   └── validate.ts           # Pre-validation Fastify hooks using Zod schemas
│   ├── routes/                   # Route handlers mapped to domain endpoints
│   │   ├── auth.ts               # Login, refresh, me, logout endpoints
│   │   ├── devices.ts            # Device registration and revocation
│   │   ├── facilities.ts         # Facility hierarchy querying
│   │   ├── field-level.ts        # Field-level list activation
│   │   ├── follow-ups.ts         # 15-day follow-up line lists, updates, dispatch
│   │   ├── hrp.ts                # High-risk patient specific listings and intake
│   │   ├── nodal.ts              # Nodal dashboard summaries and indicators
│   │   ├── patients.ts           # Patient CRUD and line list filtering
│   │   ├── queue.ts              # Administrative sync queue inspection
│   │   ├── referrals.ts          # Referral tracking endpoints
│   │   ├── staff.ts              # Account provisioning (ANM, CHO, Helpdesk, BHM)
│   │   ├── supervision.ts        # Supervision alerts and worker monitoring
│   │   ├── sync.ts               # Transactional push/pull synchronization
│   │   └── visits.ts             # ANC visit logging and vitals recording
│   ├── services/                 # Complex business services
│   │   ├── devices.ts            # Device revocation checks and token binding
│   │   ├── hrp-follow-up.ts      # 15-day cycle transition logic
│   │   ├── releases.ts           # APK version checks and GitHub release lookup
│   │   └── risk.ts               # Server-side risk scoring integration
│   ├── app.ts                    # Fastify application factory, plugins, error handlers
│   ├── config.ts                 # Type-checked environment configuration
│   └── index.ts                  # Server entrypoint and graceful shutdown handler
├── package.json                  # Package scripts, dependencies, and metadata
└── tsconfig.json                 # TypeScript build options
```

---

## 4. Client Workspace (`packages/client/`)

The frontend application (`@hrp/client`) provides responsive web dashboards and mobile PWA interfaces.

```
packages/client/
├── android/                      # Native Android project generated by Capacitor
│   ├── app/                      # Android application module (Java, manifest, assets)
│   └── build.gradle              # Gradle build script with signing configuration
├── public/                       # Static public assets
│   ├── icons/                    # App icons (maskable, standard PNGs)
│   ├── favicon.svg               # SVG favicon
│   └── manifest.json             # Web App Manifest for installable PWA
├── src/
│   ├── components/               # Reusable UI component library
│   │   ├── follow-ups/           # Field & Nodal follow-up panels
│   │   │   ├── FieldFollowUpPanel.tsx # 15-day contact cards for ANM/CHO
│   │   │   └── NodalFollowUpPanel.tsx # Shared block line-list for BHM/Helpdesk
│   │   ├── ui/                   # Primitive design system components
│   │   │   ├── BrandMark.tsx     # Matru Suraksha brand logos and emblems
│   │   │   ├── EmptyState.tsx    # Standardized zero-data states
│   │   │   ├── FormField.tsx     # Accessible form input wrappers
│   │   │   ├── Icons.tsx         # Unified Feather/Heroicons SVG icon collection
│   │   │   ├── PageHeader.tsx    # Standard view header with breadcrumb and actions
│   │   │   ├── Panel.tsx         # Structured card containers (Header, Body, Footer)
│   │   │   ├── RiskBadge.tsx     # Color-coded triage indicators (GREEN/AMBER/RED)
│   │   │   ├── SegmentedControl.tsx # Tabbed filter controls
│   │   │   ├── Sheet.tsx         # Accessible mobile bottom sheets
│   │   │   ├── Stat.tsx          # Numerical metric display cards
│   │   │   └── Table.tsx         # Data tables with pagination controls
│   │   ├── ErrorBoundary.tsx     # React error boundary catching render crashes
│   │   ├── Layout.tsx            # Main shell: sidebar, top bar, mobile navigation
│   │   ├── LockGate.tsx          # PIN verification guard for encrypted storage
│   │   ├── PatientList.tsx       # Reusable patient line list with status indicators
│   │   └── UpdatePrompt.tsx      # Service worker update notification banner
│   ├── lib/                      # Client-side core business logic
│   │   ├── db/                   # Offline IndexedDB layer
│   │   │   ├── local-db.ts       # Dexie database declaration and schema versions
│   │   │   ├── queries.ts        # Filtered queries over local IndexedDB tables
│   │   │   └── repositories.ts   # Local CRUD repositories with transparent encryption
│   │   ├── sync/                 # Offline sync engine
│   │   │   ├── engine.ts         # Sync coordinator hook (useSyncStatus)
│   │   │   ├── pull.ts           # Cohort pull replication from server
│   │   │   └── queue.ts          # Mutation queue, retry backoff, drain logic
│   │   ├── api.ts                # Fetch client, auth header injection, error handling
│   │   ├── clinical.ts           # Clinical formatting, gestational age calculation
│   │   ├── crypto.ts             # AES-256-GCM encryption & blind indexing
│   │   ├── hrp.ts                # Client follow-up aggregation and summary metrics
│   │   ├── lock.ts               # PIN verification, PBKDF2 derivation, device wipe
│   │   ├── native.ts             # Capacitor lifecycle listeners and back button
│   │   ├── nav.ts                # Role-based navigation item resolver
│   │   ├── session.ts            # Session hooks (useUserRole, useCanWriteClinical)
│   │   ├── session-cache.ts      # Offline session persistence in localStorage
│   │   ├── token-store.ts        # Memory and native storage token manager
│   │   └── version.ts            # App version and update check utilities
│   ├── pages/                    # Route page components
│   │   ├── AddPatient.tsx        # 7-field high-risk pregnancy intake form
│   │   ├── Dashboard.tsx         # Role-aware dashboard (ANM, CHO, BHM, DHS)
│   │   ├── Devices.tsx           # Mobile handset registry and revocation screen
│   │   ├── DistrictDashboard.tsx # District-level compliance and escalation KPIs
│   │   ├── FieldHome.tsx         # ANM/CHO single-action home view with urgent bar
│   │   ├── FollowUps.tsx         # Role-adaptive 15-day follow-up view
│   │   ├── Home.tsx              # Root route redirector based on user role
│   │   ├── LockScreen.tsx        # 6-digit PIN entry and creation screen
│   │   ├── Login.tsx             # Authentication form (Employee ID / Email)
│   │   ├── NewVisit.tsx          # ANC visit logging with vitals and danger signs
│   │   ├── NodalDashboard.tsx    # Block surveillance and dispatch console
│   │   ├── Offline.tsx           # Informational offline status and guidance view
│   │   ├── PatientDetail.tsx     # Comprehensive patient history and visits view
│   │   ├── Patients.tsx          # Line list of registered mothers with search
│   │   ├── Referrals.tsx         # Historical referral queue view
│   │   ├── Settings.tsx          # User profile, sync diagnostics, manual sync
│   │   ├── Supervision.tsx       # Worker activity and supervision alert panel
│   │   └── TeamAccess.tsx        # Account provisioning interface for BHM & DHS
│   ├── styles/                   # Global CSS styling
│   │   ├── fonts.css             # Inter Variable font declarations
│   │   └── index.css             # Tailwind directives and custom component styles
│   ├── test/                     # End-to-end and test fixtures
│   │   ├── e2e/                  # Playwright browser automation specs
│   │   └── setup.ts              # Vitest global setup (jsdom, mocks)
│   ├── utils/                    # Browser utilities
│   │   └── sw.ts                 # Service Worker registration and network status
│   ├── App.tsx                   # Route hierarchy and protected route gates
│   ├── capacitor.config.ts       # Capacitor native app configuration
│   ├── index.html                # Single-page application entrypoint HTML
│   ├── main.tsx                  # React DOM bootstrap with QueryClientProvider
│   ├── package.json              # Client dependencies, scripts, and bundle limits
│   ├── tsconfig.json             # TypeScript project references
│   └── vite.config.ts            # Vite bundler, PWA, and dev proxy configuration
```
