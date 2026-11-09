# Matru Suraksha — Technical Documentation Library

Welcome to the comprehensive technical documentation for **Matru Suraksha** — an offline-first high-risk pregnancy (HRP) identification, tracking, and closed-loop follow-up platform designed for India's public healthcare ecosystem (piloted in Araria District, Bihar).

---

## 1. Documentation Index

The technical documentation is organized into modular guides covering every aspect of the system:

| # | Document | Primary Audience | Description |
| :-: | :--- | :--- | :--- |
| **01** | [Project Overview](file:///c:/Users/ADITYA/Downloads/HRP/docs/01-project-overview.md) | Everyone | Executive summary, public health tiers, 6-role hierarchy, vision & impact. |
| **02** | [Technology Stack](file:///c:/Users/ADITYA/Downloads/HRP/docs/02-technology-stack.md) | Developers, Architects | Detailed stack inventory, exact versions, monorepo architecture. |
| **03** | [Project Structure](file:///c:/Users/ADITYA/Downloads/HRP/docs/03-project-structure.md) | Developers, Contributors | Complete directory layout, module roles, and file tree breakdowns. |
| **04** | [System Architecture](file:///c:/Users/ADITYA/Downloads/HRP/docs/04-system-architecture.md) | Architects, Tech Leads | Layered architecture, offline-first sync engine, boundary constraints. |
| **05** | [Application Workflows](file:///c:/Users/ADITYA/Downloads/HRP/docs/05-application-workflows.md) | Product, Engineers | Auth lifecycle, 7-field intake, ANC check, 15-day follow-up cycle. |
| **06** | [Modules & Features](file:///c:/Users/ADITYA/Downloads/HRP/docs/06-modules-and-features.md) | Full-Stack Devs | Deep dive into shared rules, server services, and client components. |
| **07** | [Database Documentation](file:///c:/Users/ADITYA/Downloads/HRP/docs/07-database-documentation.md) | DBAs, Backend Devs | PostgreSQL 16 schema, Kysely types, 13 tables, migrations 001–009. |
| **08** | [API Documentation](file:///c:/Users/ADITYA/Downloads/HRP/docs/08-api-documentation.md) | API Consumers, Devs | Complete REST specification, request/response payloads, and error codes. |
| **09** | [Authentication & Authorization](file:///c:/Users/ADITYA/Downloads/HRP/docs/09-authentication-and-authorization.md) | Security, Backend | JWT dual-transport, 24 actions policy matrix, ABAC facility path scoping. |
| **10** | [Configuration & Environment](file:///c:/Users/ADITYA/Downloads/HRP/docs/10-configuration-and-environment.md) | DevOps, SREs | Environment variable catalogs, Zod validation, dev vs pilot profiles. |
| **11** | [Installation & Setup](file:///c:/Users/ADITYA/Downloads/HRP/docs/11-installation-and-setup.md) | New Developers | Zero-to-running local setup guide, Docker, test accounts, Android APK. |
| **12** | [Development Guide](file:///c:/Users/ADITYA/Downloads/HRP/docs/12-development-guide.md) | Contributors, Devs | Development workflows, red-line floor rules, migrations, quality gates. |
| **13** | [Testing & Quality Assurance](file:///c:/Users/ADITYA/Downloads/HRP/docs/13-testing-and-quality.md) | QA, Developers | Vitest unit/integration tests, Playwright E2E, coverage floors ($\ge 80\%$). |
| **14** | [Deployment & Infrastructure](file:///c:/Users/ADITYA/Downloads/HRP/docs/14-deployment-and-infrastructure.md) | DevOps, SysAdmins | Render cloud deploy, Neon DB, Android CI artifact pipeline, backups. |
| **15** | [Security Documentation](file:///c:/Users/ADITYA/Downloads/HRP/docs/15-security-documentation.md) | Security Auditors | Threat model, AES-256-GCM field encryption, PBKDF2 PIN vault, scanners. |
| **16** | [Error Handling & Logging](file:///c:/Users/ADITYA/Downloads/HRP/docs/16-error-handling-and-logging.md) | SREs, Backend Devs | Fastify error hooks, Pino JSON structured logging, offline queue backoff. |
| **17** | [Integrations & Third-Party](file:///c:/Users/ADITYA/Downloads/HRP/docs/17-integrations-and-third-party-services.md) | Systems Engineers | Capacitor Android, ABDM (M1-M3), FHIR R4, eSanjeevani, RCH portal. |
| **18** | [Maintenance & Troubleshooting](file:///c:/Users/ADITYA/Downloads/HRP/docs/18-maintenance-and-troubleshooting.md) | Support, SysAdmins | Advisory lock 727001 runbook, sync conflicts, PIN lockouts, DB backup. |
| **19** | [Performance & Scalability](file:///c:/Users/ADITYA/Downloads/HRP/docs/19-performance-and-scalability.md) | Performance Leads | Performance budgets, LCP/CLS metrics, Fastify benchmarks, index tuning. |
| **20** | [Future Improvements](file:///c:/Users/ADITYA/Downloads/HRP/docs/20-future-improvements.md) | Product, Leadership | Phase 4 roadmap, hardware biometrics, IVR outreach, AI risk triage. |

---

## 2. Dedicated Architectural Diagrams

High-resolution visual models with complete Mermaid source code:

- [System Architecture Diagrams](file:///c:/Users/ADITYA/Downloads/HRP/docs/diagrams/system-architecture.md) — Layered tiers, monorepo import boundaries, and offline sync flows.
- [Application Flow Diagrams](file:///c:/Users/ADITYA/Downloads/HRP/docs/diagrams/application-flow.md) — Auth lifecycles, 7-field intake, clinical rule checks, 15-day follow-up state machine, and PIN unlock.
- [Database ER Diagram](file:///c:/Users/ADITYA/Downloads/HRP/docs/diagrams/database-er-diagram.md) — Complete 13-table schema relationships, cardinalities, and foreign key cascade rules.
- [Deployment Architecture Diagrams](file:///c:/Users/ADITYA/Downloads/HRP/docs/diagrams/deployment-architecture.md) — Local Docker development, cloud pilot topology, and sovereign State Data Centre cluster.

---

## 3. Guide for AI Coding Agents

For AI agents (such as Google Antigravity, GitHub Copilot, or Cursor) working within this codebase:
- Review [AI Agent Context & Working Rules](file:///c:/Users/ADITYA/Downloads/HRP/docs/AI_AGENT_CONTEXT.md) before writing any code.
- Always observe the quality gates (`npm run check:fast`) and red-line floor rules.

---

## 4. Documentation Standards & Maintenance

1. **Codebase Truth:** Documentation must reflect the actual code implementation in `packages/shared`, `packages/server`, and `packages/client`. Never document hypothetical implementations as current facts.
2. **Retired Identifiers Guard:** Automated checks (`scripts/check-retired-identifiers.mjs`) verify that deprecated terms (such as bare `HELPDESK` or outdated follow-up identifiers) never enter the documentation.
3. **Secret Hygiene:** Never commit private API keys, passwords, or production connection strings to documentation. Always utilize placeholder formats (e.g. `<placeholder>`).
