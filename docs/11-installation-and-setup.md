# Matru Suraksha — Installation and Setup

This guide provides step-by-step instructions for configuring, bootstrapping, and executing the **Matru Suraksha** platform in local development, containerized preview, and Android build environments.

---

## 1. Prerequisites

Before installing, ensure your host environment satisfies the following minimum runtime requirements:

| Tool | Minimum Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS recommended) | `node -v` | JavaScript runtime engine. |
| **npm** | `>= 10.8.1` | `npm -v` | Package manager supporting workspaces. |
| **Git** | `>= 2.30.0` | `git --version` | Version control. |
| **Docker Engine / Desktop** | `>= 24.0.0` | `docker --version` | Required for PostgreSQL and container testing. |
| **Docker Compose** | `>= 2.20.0` | `docker compose version`| Multi-container orchestration. |
| **Java JDK (Android builds)**| `17` (Temurin / OpenJDK) | `javac -version` | Only required if building Android APK locally. |
| **Android SDK (Android builds)**| `API Level 35, Build-tools 35.0.0` | `sdkmanager --list` | Only required if building Android APK locally. |

---

## 2. Option A: Local Development on Host (Recommended)

In this workflow, PostgreSQL runs in Docker while Fastify and Vite run natively on your machine for rapid hot-module replacement (HMR).

### Step 1: Clone Repository
```bash
git clone https://github.com/adityapandey2002/MATERNAL_HEALTH_HRP.git
cd MATERNAL_HEALTH_HRP
```

### Step 2: Install Workspace Dependencies
```bash
npm install
```
*This installs root dependencies and links all monorepo workspace packages (`@hrp/shared`, `@hrp/server`, `@hrp/client`).*

### Step 3: Configure Environment Variables
Copy the example environment template into `.env`:
```bash
cp .env.example .env
```
Ensure `.env` contains valid development defaults:
```ini
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://hrp:hrp_dev@localhost:5432/hrp
JWT_SECRET=dev-jwt-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-secret-at-least-32-characters
```

### Step 4: Start PostgreSQL Database
```bash
npm run db:up
```
*Starts PostgreSQL in detached mode via Docker Compose on port `5432`.*

### Step 5: Execute Database Migrations & Seed Data
```bash
npm run db:migrate
npm run db:seed
```
- `db:migrate` executes migrations `001` through `009` under advisory lock `727001`.
- `db:seed` populates Araria district facilities, demo health workers, and synthetic high-risk cohort records.

### Step 6: Start Application Development Servers
```bash
npm run dev
```
Alternatively, run the client and server in separate terminal windows:
```bash
# Terminal 1: Backend API (Fastify)
npm run dev:server    # Listening on http://localhost:3000

# Terminal 2: Frontend PWA (Vite)
npm run dev:client    # Listening on http://localhost:5173
```

Open **`http://localhost:5173`** in your browser. The Vite development proxy automatically routes all `/api/*` requests directly to `http://localhost:3000`.

---

## 3. Option B: Full Containerized Stack (Docker Compose)

To run the entire platform (database, backend API, and web application) inside isolated containers:

```bash
# 1. Start Docker Engine / Desktop
# 2. Build and launch all services
docker compose up -d --build

# 3. Apply migrations and seed data
npm run db:migrate
npm run db:seed
```

| Service | Host URL | Description |
| :--- | :--- | :--- |
| **Web Application (PWA)** | `http://localhost:5173` | React frontend application. |
| **REST API** | `http://localhost:3000` | Fastify backend server. |
| **API Health Check** | `http://localhost:3000/health` | Process liveness probe. |
| **PostgreSQL Database** | `localhost:5432` | Relational database (user: `hrp`, db: `hrp`). |

---

## 4. Test Accounts & Pre-Seeded Personas

After executing `npm run db:seed`, the following accounts are available for testing (all accounts use password **`password123`**):

| Role | Username / Identifier | Tier & Scope | Responsibilities |
| :--- | :--- | :--- | :--- |
| **ANM** | `ANM001` | Village / HSC Sikti | Enrolls mothers, records visits, performs field follow-ups. |
| **CHO** | `CHO001` | HWC Raniganj | Facility clinical triage and HWC ANC examinations. |
| **HRP Helpdesk (Block)** | `helpdesk.daskroi@araria.gov.in`| Block CHC | First 15-day contact for referred HRP cases, telephone outreach. |
| **BHM** | `MO001` | Raniganj Block | Block surveillance dashboard, dispatch box, staff provisioning. |
| **HRP Helpdesk (District)**| `helpdesk.district@araria.gov.in`| Sadar Hospital | District-level line list and inter-block triage support. |
| **DHS** | `ADM001` | Araria District | District compliance oversight, escalated cases, BHM provisioning. |

---

## 5. Verification & Health Checks

Verify that the local installation is operating properly by executing the smoke test suite:

```bash
# Verify direct API connectivity and authentication flow
npm run test:smoke

# Verify proxy routing through the Vite frontend dev server
npm run test:smoke:proxy
```

Expected output:
```
PASS  login returns 200                            200
PASS  login sets an httpOnly refresh cookie        true
PASS  login body carries no refresh token          true
PASS  refresh works with the httpOnly cookie       200
PASS  list patients returns 200                    200
PASS  patient payload is camelCase                 true
```

---

## 6. Building the Capacitor Android Package (APK)

To build and sync the client application for Android:

```bash
# 1. Build the shared package and web client
npm run build --workspace=packages/shared
npm run build --workspace=packages/client

# 2. Sync web assets into the Android native project
cd packages/client
npx cap sync android

# 3. Build a debug APK (requires Android SDK and Gradle)
cd android
./gradlew assembleDebug
```
The output debug APK will be generated at:
`packages/client/android/app/build/outputs/apk/debug/app-debug.apk`.
