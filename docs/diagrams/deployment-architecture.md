# Matru Suraksha — Deployment Architecture Diagrams

This document contains visual deployment topologies for local development, pilot cloud hosting, and sovereign statewide infrastructure configurations for the **Matru Suraksha** platform.

---

## 1. Local Development Topology (Docker & Vite HMR)

```mermaid
flowchart TD
    subgraph Host Machine ["Developer Workstation (Windows / Linux / macOS)"]
        Browser["Web Browser (Chrome / Edge / Firefox)"]
        ViteDev["Vite Dev Server (Port 5173 - Hot Module Reload)"]
        NodeServer["Fastify Server (Node.js - Port 3000)"]
    end

    subgraph Docker Engine ["Local Docker Container Environment"]
        PostgresContainer["PostgreSQL 16 Container (Port 5432:5432)"]
        VolumeMount[("Named Docker Volume: pgdata")]
    end

    Browser -- "HTTP / WS (HMR)" --> ViteDev
    Browser -- "HTTP /api (Proxy)" --> NodeServer
    ViteDev -. Proxy /api .-> NodeServer
    NodeServer -- "TCP / SQL (Kysely)" --> PostgresContainer
    PostgresContainer --- VolumeMount
```

---

## 2. Live Cloud Pilot Topology (Render & Neon)

The live pilot demonstration deployment utilizes cloud infrastructure with continuous deployment:

```mermaid
flowchart TD
    subgraph Clients ["Frontline User Tier"]
        TabletApp["Frontline Tablets (Capacitor Android APK)"]
        DesktopBrowser["Desktop Workstations (CHO / District Oversight)"]
    end

    subgraph Edge Layer ["Edge Network (Cloudflare / Render CDN)"]
        EdgeDNS["DNS & Automated TLS Termination"]
        EdgeStatic["Static Asset Cache (HTML, JS Bundles, SVGs)"]
    end

    subgraph Cloud Compute ["Render Cloud Service"]
        FastifyApp["Fastify Node.js Container (Render Web Service)"]
        AppEnv["Environment Secret Vault"]
    end

    subgraph Managed Database ["Neon Serverless Data Platform"]
        PgBouncer["PgBouncer Connection Pooler (Port 5432 / 6543)"]
        NeonDB[("PostgreSQL 16 Engine with PITR Storage")]
    end

    TabletApp -- "HTTPS / TLS 1.3" --> EdgeDNS
    DesktopBrowser -- "HTTPS / TLS 1.3" --> EdgeDNS

    EdgeDNS --> EdgeStatic
    EdgeDNS -- "/api/*" --> FastifyApp

    FastifyApp --- AppEnv
    FastifyApp -- "SSL Parameterized SQL" --> PgBouncer
    PgBouncer --> NeonDB
```

---

## 3. Sovereign Statewide Deployment Topology (Target NIC / State Data Centre)

For full statewide rollouts across Bihar's 38 districts, the platform can be hosted within sovereign public cloud or State Data Centre (SDC) infrastructure:

```mermaid
flowchart TD
    subgraph Frontline Endpoints ["Frontline Public Health Network"]
        ANM_Tabs["Frontline Tablets (25,000+ ANM Devices)"]
        CHO_PCs["HWC Desktop Workstations (CHO / MO)"]
        District_HQ["District Health Societies (DHS / Civil Surgeon)"]
    end

    subgraph Perimeter Security ["Security & DMZ Layer"]
        WAF["Web Application Firewall & DDoS Shield"]
        SLB["State Data Centre Load Balancers (HAProxy / NGINX)"]
    end

    subgraph Application Cluster ["Stateless App Cluster (Kubernetes / Docker Swarm)"]
        Pod1["Fastify API Node 1"]
        Pod2["Fastify API Node 2"]
        PodN["Fastify API Node N"]
    end

    subgraph Data Tier ["High Availability Database Cluster"]
        PG_Primary[("PostgreSQL 16 Primary (Read/Write)")]
        PG_Standby[("PostgreSQL 16 Standby (Streaming Replication)")]
        BackupStorage[("Encrypted S3 / Object Storage (Daily Snapshots)")]
    end

    ANM_Tabs --> WAF
    CHO_PCs --> WAF
    District_HQ --> WAF

    WAF --> SLB
    SLB --> Pod1
    SLB --> Pod2
    SLB --> PodN

    Pod1 & Pod2 & PodN --> PG_Primary
    PG_Primary -. Streaming Replication .-> PG_Standby
    PG_Primary -. Automated WAL Archival .-> BackupStorage
```

---

## 4. Mobile APK Build & Distribution Pipeline

```mermaid
flowchart LR
    DevCommit[Code Push to main] --> GHAction[GitHub Actions CI Pipeline]
    GHAction --> BuildWeb[npm run build (Vite PWA Assets)]
    BuildWeb --> CapSync[npx cap sync android]
    CapSync --> Gradle[./gradlew assembleDebug]
    Gradle --> APK[android/app/build/outputs/apk/debug/app-debug.apk]
    APK --> ReleaseArtifact[Uploaded as Pipeline Build Artifact]
    ReleaseArtifact --> TabletDownload[District IT Installs on Tablets via MDM / USB]
```
