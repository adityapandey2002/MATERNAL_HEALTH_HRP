# Matru Suraksha — Application Workflows

This document details the primary operational and clinical workflows implemented in **Matru Suraksha**, tracking actors, preconditions, step-by-step logic, state transitions, and exception handling.

---

## 1. User Authentication & Session Lifecycle

Matru Suraksha provides a unified authentication pipeline supporting web browsers, PWA installations, and standalone Android Capacitor packages.

```mermaid
sequenceDiagram
    autonumber
    actor User as Health Worker (ANM / CHO / BHM)
    participant UI as Login Page (Client)
    participant API as Auth Routes (Fastify)
    participant DB as PostgreSQL (users table)

    User->>UI: Enter Employee ID / Email + Password
    UI->>API: POST /api/auth/login { employeeId, password, deviceId? }
    API->>DB: Query user by employee_id or lower(email)
    DB-->>API: Return user record (hash, role, facility)
    API->>API: Verify password via bcrypt.compare()
    API->>API: Check user.is_active is true
    
    alt Web Client (Browser / PWA)
        API->>API: Sign 15-min JWT access token
        API->>UI: Return { accessToken, user }
        Note over API,UI: Sets httpOnly, SameSite=Lax refreshToken cookie (7 days)
    else Native Android Client (Capacitor)
        API->>API: Sign 15-min JWT access token + refresh token
        API->>UI: Return { accessToken, refreshToken, user }
    end

    UI->>UI: Store accessToken in memory / secure store
    UI->>UI: Cache user profile in localStorage (session-cache.ts)
    UI->>User: Route to role-specific Home screen
```

### 1.1 Session Refresh Workflow
- **Trigger:** An API request returns HTTP 401 Unauthorized due to an expired access token.
- **Web Execution:** `packages/client/src/lib/api.ts` automatically issues `POST /api/auth/refresh`. The browser sends the `refreshToken` cookie. The server validates the cookie, mints a fresh 15-minute access token, and retries the original request.
- **Native Android Execution:** The client passes `{ refreshToken }` in the JSON request body.
- **Offline Tolerance:** If the refresh fails due to a network outage (`TypeError: Failed to fetch`), the client does **not** redirect to `/login`. Instead, it continues operating using the cached offline session (`session-cache.ts`).

---

## 2. Account Provisioning & Staff Hierarchy

Account creation follows the administrative authority structure of the health system:

```mermaid
flowchart TD
    DHS["District Health Society (DHS / Civil Surgeon)"]
    BHM["Block Health Manager (BHM)"]
    HD_DIST["HRP Helpdesk District Operator"]
    HD_BLOCK["HRP Helpdesk Block Operator"]
    CHO["Community Health Officer (HWC)"]
    ANM["Auxiliary Nurse Midwife (HSC / Village)"]

    DHS -->|Provisions & Manages| BHM
    DHS -->|Provisions & Manages| HD_DIST
    BHM -->|Provisions & Manages| HD_BLOCK
    BHM -->|Provisions & Manages| CHO
    BHM -->|Provisions & Manages| ANM
```

### 2.1 Provisioning Rules
1. **Facility Subtree Scoping:** A creator can only assign users to facilities within their own administrative path. A BHM at `ARR_RANIGANJ` can only provision accounts at HSCs or HWCs subordinate to Raniganj Block.
2. **Fixed Roles:** A user's role cannot be modified in place. To change a worker's role, the administrator deactivates the existing account and creates a new one.
3. **Identifier Generation:** If an employee ID is omitted during creation, the server automatically generates one using a deterministic prefix (`HD-xxxx`, `ANM-xxxx`). Helpdesk operators log in using their email address.

---

## 3. High-Risk Pregnancy Intake Workflow

The intake form captures maternal metrics in seven streamlined fields:

```mermaid
flowchart TD
    Start["Frontline Worker opens 'Add case'"]
    Step1["Enter Mother's Name & 10-Digit Mobile Number"]
    Step2["Enter Age (Completed years: 15–55)"]
    Step3["Select Village / Sub-Center (HSC)"]
    Step4["Enter Last Menstrual Period (LMP) Date"]
    Calc["System auto-calculates EDD (LMP + 280d) & Gestational Age"]
    Step5["Select 1 of 9 High-Risk Complications"]
    Step6["Select Referral Status: Yes / No"]
    Save["Click 'Add to HRP register'"]

    Start --> Step1 --> Step2 --> Step3 --> Step4 --> Calc --> Step5 --> Step6 --> Save
    
    Save --> WriteLocal["Write to Local IndexedDB (syncStatus = pending)"]
    WriteLocal --> EnqueueSync["Enqueue into pendingOps Queue"]
    EnqueueSync --> TriggerSync{"Network Available?"}
    TriggerSync -->|Yes| PostSync["POST /api/sync/push to Server"]
    TriggerSync -->|No| RetainQueue["Retain in IndexedDB until online"]
```

### 3.1 Field-Level Options by Role
- **Field Roles (`ANM`, `CHO`):**
  - Referral choices: `Yes — Refer to CHC/FRU` vs `No — Routine Field Management`.
- **Block Roles (`BHM`, `HRP_HELPDESK_BLOCK`):**
  - Referral choices: `Refer to Sadar hospital` vs `Not needed`.
- **Automatic Scoring:** Any patient entered with an HRP complication is scored `AMBER` or `RED`, preventing high-risk pregnancies from being erroneously flagged as low risk.

---

## 4. ANC Visit & Vitals Capture Workflow

During routine or specialist visits, health workers record comprehensive antenatal care metrics:

1. **Patient Selection:** The health worker opens the patient record from the line list or search bar.
2. **Vitals Recording:**
   - Systolic BP (70–250 mmHg) and Diastolic BP (40–150 mmHg).
   - Hemoglobin (3.0–18.0 g/dL).
   - Maternal Weight (30–150 kg).
   - Fundal Height (10–50 cm) and Fetal Heart Rate (60–200 bpm).
3. **Obstetric Danger Sign Evaluation:** The worker screens for 8 critical signs:
   - Severe Hypertension / Pre-eclampsia
   - Gestational Diabetes (GDM)
   - Severe Anemia (Hb < 7 g/dL)
   - Vaginal Bleeding
   - Reduced Fetal Movement
   - Severe Persistent Headache
   - Visual Disturbances
   - Seizures / Convulsions
4. **Prophylactic Supplements:** Checkbox confirmation for Iron & Folic Acid (IFA), Calcium, and Albendazole.
5. **Dynamic Risk Score Recalculation:** The rule engine re-evaluates risk on every visit. If vitals cross danger thresholds (e.g., BP >= 140/90 or Hb < 7 g/dL), the patient's risk level escalates to `RED`.

---

## 5. 15-Day Follow-Up & Escalation Cycle

Every pregnancy marked as high risk (`isHrp = true`) enters an automated 15-day contact schedule:

```mermaid
sequenceDiagram
    autonumber
    participant ANM as Frontline ANM / CHO
    participant Block as Block Helpdesk Operator
    participant Dist as District Health Society (DHS)
    participant Engine as HRP Follow-Up Engine

    Note over Engine: Woman identified as HRP
    alt Patient Referred to Higher Facility
        Engine->>Block: Create Cycle 1: BLOCK_15_DAY (Due in 15 days)
        Engine->>ANM: Show in 'Awaiting Block Review' (Read-only)
        Block->>Engine: Complete Contact via Phone / CHC Visit
        Engine->>ANM: Create Cycle 2: FIELD_15_DAY (Due in +15 days)
    else Patient Managed in Field
        Engine->>ANM: Create Cycle 1: FIELD_15_DAY (Due in 15 days)
        ANM->>Engine: Complete Contact at Village HSC
        Engine->>ANM: Create Cycle 2: FIELD_15_DAY (Due in +15 days)
    end

    alt Cycle Passes 15 Days Without Completion
        Engine->>Dist: Mark BREACHED → Elevate to District Escalation Queue
        Dist->>Block: Follow up with Block Medical Officer
    end
```

### 5.1 Status Triad
- **`COMPLETE` (Green):** Contact completed and recorded with attribution (timestamp and user).
- **`PENDING` (Amber):** Within the active 15-day window, awaiting outreach.
- **`NOT_REACHABLE` (Gray):** Health worker attempted contact but the mother could not be reached. The row remains open and logs the last attempt timestamp.

---

## 6. Zero-Trust Local Security & Device Lifecycle

On mobile handsets, patient identifiers are protected by a cryptographic hardware-software lock:

```mermaid
stateDiagram-v2
    [*] --> DeviceSetup: Fresh Install on Android
    DeviceSetup --> PinCreation: Set 6-Digit PIN
    PinCreation --> Unlocked: KEK derives & encrypts random DEK

    Unlocked --> ActiveOperation: Health worker logs in & records data
    ActiveOperation --> LockedState: 3 Minutes in Background / App Close
    ActiveOperation --> LockedState: Manual Lock

    LockedState --> Unlocked: Correct PIN Entered
    LockedState --> FailedAttempt: Incorrect PIN Entered
    
    FailedAttempt --> LockedState: Attempts < 10 (Show remaining attempts)
    FailedAttempt --> WipedState: Attempts >= 10 (Security Breach Threshold)

    WipedState --> DeviceReset: Complete wipe of IndexedDB, Keys & Tokens
    DeviceReset --> [*]
```

### 6.1 Remote Revocation
If a worker reports a lost or stolen handset:
1. The BHM or DHS opens the **Devices** management console (`/devices`).
2. The supervisor clicks **Revoke** on the affected device UUID.
3. The server sets `revoked_at = now()` in the `devices` table.
4. Next time the stolen device connects to sync, the API responds with HTTP 401 `DEVICE_REVOKED`.
5. Upon receiving this code, the client application immediately executes an emergency local database wipe and resets to the onboarding screen.
