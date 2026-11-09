# Matru Suraksha — System Architecture Diagrams

This document contains visual architectural models illustrating the component hierarchy, package boundaries, offline-first data flows, and security zones of the **Matru Suraksha** platform.

---

## 1. High-Level Component & Package Architecture

```mermaid
graph TD
    subgraph Client Application ["Frontend Tier (packages/client)"]
        UI["React 18 UI (Vite + Tailwind CSS)"]
        Router["Client Router & Navigation"]
        State["TanStack Query (Async Server State)"]
        LocalDB["Dexie.js (IndexedDB Local Storage)"]
        CryptoEngine["Web Crypto API (AES-256-GCM + PBKDF2)"]
        SyncClient["Offline Sync Client Engine"]
        CapShell["Capacitor 6 Android Native Shell"]
    end

    subgraph Shared Contract ["Shared Core (packages/shared)"]
        Schemas["Zod Validation Schemas"]
        RuleEngine["Pure HRP Rule Engine"]
        DateCalc["Date & Interval Calculators"]
        DomainTypes["TypeScript Domain Types & Interfaces"]
    end

    subgraph Server Application ["Backend Tier (packages/server)"]
        FastifyCore["Fastify 4 HTTP Framework"]
        AuthGuards["JWT & Cookie Auth Pre-Handlers"]
        ABAC["ABAC Facility Scope Interceptor"]
        Controllers["API Controllers & Route Handlers"]
        SyncServer["Batch Sync Reconciliation Engine"]
        KyselyDAL["Kysely Query Builder (Data Access Layer)"]
    end

    subgraph Data Infrastructure ["Data Tier"]
        PostgresDB[("PostgreSQL 16 Database")]
        AuditStore[("Audit Logs & Event Stream")]
    end

    UI --> Router
    Router --> State
    State --> LocalDB
    State --> SyncClient
    LocalDB --> CryptoEngine
    CapShell --> UI

    UI -. imports .-> SharedContract
    FastifyCore -. imports .-> SharedContract

    SyncClient -- "HTTPS / TLS 1.3 (REST)" --> FastifyCore
    FastifyCore --> AuthGuards
    AuthGuards --> ABAC
    ABAC --> Controllers
    Controllers --> SyncServer
    Controllers --> KyselyDAL
    SyncServer --> KyselyDAL
    KyselyDAL --> PostgresDB
    KyselyDAL --> AuditStore
```

---

## 2. Monorepo Boundary Constraints

Strict structural rules govern imports across workspaces:

```mermaid
flowchart LR
    Shared["packages/shared<br/>(Types, Schemas, Rules)"]
    Client["packages/client<br/>(React, Dexie, Capacitor)"]
    Server["packages/server<br/>(Fastify, Kysely, DB)"]

    Client -->|Imports| Shared
    Server -->|Imports| Shared

    Client -.->|FORBIDDEN IMPORT| Server
    Server -.->|FORBIDDEN IMPORT| Client
```

- **Boundary Enforcement:** `packages/client` never imports from `packages/server`, and `packages/server` never imports from `packages/client`. All shared contracts reside strictly in `packages/shared`.

---

## 3. Data Synchronization Flow (Online vs Offline)

```mermaid
flowchart TD
    A[Healthcare Worker Records ANC Visit] --> B{Device Connected to Internet?}
    
    %% Offline Pathway
    B -- No (Offline) --> C[Write Encounter to Local Dexie DB]
    C --> D[Encrypt PHI with AES-256-GCM using in-memory DEK]
    D --> E[Record Pending Action in IndexedDB syncQueue]
    E --> F[Display Optimistic Success in UI]
    F --> G[Wait for Network Online Event]
    G --> H[Sync Worker Awakes]

    %% Online Pathway
    B -- Yes (Online) --> I[Write to Local Dexie DB & SyncQueue]
    I --> H

    H --> J[Send POST /api/sync with Batch Changes]
    J --> K{Server Validates Device & Token}
    K -- Unauthorized --> L[Alert User & Hold Queue]
    K -- Authorized --> M[Validate Zod Schemas & ABAC Scope]
    M --> N[Apply Atomic Database Transaction in PostgreSQL]
    N --> O[Write Audit Log Entry]
    O --> P[Return 200 OK with Server Timestamps]
    P --> Q[Client Marks Queue as SYNCED & Updates Local State]
```
