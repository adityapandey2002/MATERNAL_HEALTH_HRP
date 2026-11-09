# Matru Suraksha — Application Flow Diagrams

This document contains visual workflow diagrams detailing the core clinical, administrative, and security processes in the **Matru Suraksha** platform.

---

## 1. Authentication & Dual-Transport Session Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Frontline Worker (ANM/CHO)
    participant Client as Client Application
    participant Server as Fastify API Server
    participant DB as PostgreSQL Database

    Staff->>Client: Enters Email and Password
    Client->>Server: POST /api/auth/login {email, password}
    Server->>DB: Query staff by email
    DB-->>Server: Return staff record with bcrypt password_hash
    Server->>Server: Validate password via bcrypt.compare()
    
    alt Credentials Invalid
        Server-->>Client: 401 Unauthorized {code: "INVALID_CREDENTIALS"}
        Client-->>Staff: Display error notification
    else Credentials Valid
        Server->>Server: Mint 15m Access JWT & 7d Refresh Token
        Server->>DB: Insert SHA-256(refreshToken) into refresh_tokens table
        Server-->>Client: Return Tokens (httpOnly cookie for Web / JSON for Native)
        Client->>Client: Store access session & initialize app state
        Client-->>Staff: Navigate to Role Dashboard
    end

    Note over Client, Server: Normal operations using Access Token (15-minute expiry)

    opt Token Renewal
        Client->>Server: POST /api/auth/refresh {refreshToken}
        Server->>DB: Verify active hash in refresh_tokens
        Server->>DB: Revoke old token & store new token hash
        Server-->>Client: 200 OK with fresh Access Token & rotated Refresh Token
    end

    opt Logout
        Client->>Server: POST /api/auth/logout
        Server->>DB: Mark refresh token as revoked
        Server-->>Client: Clear cookies & return 204 No Content
        Client->>Client: Wipe in-memory crypto keys & clear local session
    end
```

---

## 2. Frontline 7-Field High-Risk Intake Flow

Frontline ANMs register pregnant mothers using a streamlined 7-field intake flow optimized for high-volume rural outreach sessions:

```mermaid
flowchart TD
    A[ANM Opens 'New Mother Registration'] --> B[Enter 1. Full Legal Name]
    B --> C[Enter 2. Age in Years]
    C --> D[Enter 3. Primary Mobile Number]
    D --> E[Enter 4. Last Menstrual Period Date]
    E --> F[Enter 5. Gravida / Parity / Living Children]
    F --> G[Enter 6. Resident Village & Ward]
    G --> H[Enter 7. Assigned Sub-Centre HSC]
    H --> I[Submit Registration]
    
    I --> J[Pure Rule Engine Calculates Estimated Due Date: LMP + 280 Days]
    J --> K[Calculate Gestational Age in Weeks]
    K --> L[Generate System Unique Patient ID]
    L --> M[Write Encrypted Patient Record to IndexedDB]
    M --> N[Enqueue Action in Local syncQueue]
    N --> O[Present Patient Summary & Prompt for Baseline ANC Check]
```

---

## 3. Clinical ANC Check & High-Risk Trigger Flow

```mermaid
flowchart TD
    A[Healthcare Worker Conducts ANC Checkup] --> B[Record Clinical Vitals & Lab Measurements]
    
    subgraph Vitals & Labs
        B1[Systolic & Diastolic BP]
        B2[Hemoglobin g/dL]
        B3[Random Blood Sugar mg/dL]
        B4[Fundal Height & Fetal Heart Rate]
        B5[Urine Albumin / Protein]
    end
    B --> B1 & B2 & B3 & B4 & B5

    B1 & B2 & B3 & B4 & B5 --> C[Execute Pure Rule Engine: evaluateHrpRules]

    C --> D{Any High-Risk Triggers Detected?}

    D -- Yes --> E[Mark Patient isHighRisk = true]
    E --> F[Identify Specific Risk Conditions]
    
    subgraph Risk Conditions
        F1[Severe Anemia: Hb < 7]
        F2[Hypertension / Preeclampsia: SBP >= 140 or DBP >= 90]
        F3[Gestational Diabetes: RBS >= 140]
        F4[Teenage Pregnancy / Elderly Primigravida]
        F5[Malpresentation / Multiple Gestation]
    end
    F --> F1 & F2 & F3 & F4 & F5

    F1 & F2 & F3 & F4 & F5 --> G[Generate Urgent Referral to Sadar Hospital]
    G --> H[Initialize Repeating 15-Day Follow-Up Task: BLOCK_15_DAY]
    H --> I[Route Task to Block Helpdesk Dashboard]

    D -- No --> J[Mark Patient isHighRisk = false]
    J --> K[Schedule Standard Routine ANC Visit: Next Trimester Window]
```

---

## 4. 15-Day Follow-Up State Machine

```mermaid
stateDiagram-v2
    [*] --> BLOCK_15_DAY: HRP Identified & Referred to Sadar Hospital
    
    state BLOCK_15_DAY {
        [*] --> PENDING_BLOCK: Task Assigned to HRP_HELPDESK_BLOCK
        PENDING_BLOCK --> CONTACTED_BLOCK: Block Helpdesk calls mother & verifies hospital visit
        PENDING_BLOCK --> OVERDUE_BLOCK: Elapsed > 15 days without contact
    }

    CONTACTED_BLOCK --> FIELD_15_DAY: Transition to Community Monitoring
    OVERDUE_BLOCK --> ESCALATED_DISTRICT: Automated Alert to DHS & District Helpdesk

    state FIELD_15_DAY {
        [*] --> PENDING_FIELD: Task Assigned to Frontline ANM/CHO
        PENDING_FIELD --> COMPLETED_CYCLE: ANM conducts home visit / VHSND follow-up
        PENDING_FIELD --> OVERDUE_FIELD: Elapsed > 15 days without home visit
    }

    OVERDUE_FIELD --> ESCALATED_DISTRICT: Escalated for Block Medical Officer / DHS Review
    COMPLETED_CYCLE --> BLOCK_15_DAY: Next 15-Day Cycle Scheduled (Until Delivery)
    COMPLETED_CYCLE --> [*]: Pregnancy Closed (Safe Delivery or Resolved)
```

---

## 5. Device Registration, Pin Encryption, & Local Storage Unlock

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Frontline ANM
    participant Tablet as Android Tablet / Client
    participant IDB as Local IndexedDB
    participant Server as Fastify API Server

    Note over Staff, Server: Initial Device Provisioning
    Staff->>Tablet: Installs APK & Enters Primary Server Credentials
    Tablet->>Server: POST /api/devices/register {fingerprint, model, osVersion}
    Server-->>Tablet: 201 Created {deviceId, status: "PENDING_APPROVAL"}
    Tablet-->>Staff: Screen displays "Device Pending Administrator Approval"

    Note over Server: District Admin approves device in Admin Dashboard
    Server->>Server: Update device status to "APPROVED"

    Staff->>Tablet: Launches App & Sets 6-Digit Secret PIN
    Tablet->>Tablet: Generate 16-byte random salt
    Tablet->>Tablet: PBKDF2(PIN, salt, 600,000 iterations) => AES-256 Key
    Tablet->>IDB: Store salt & PIN verification hash (never stores the PIN)
    Tablet->>Tablet: Retain AES-256 Key in volatile memory only

    Note over Tablet: Healthcare worker operates app with automatic encryption

    opt 5-Minute Inactivity or Manual App Lock
        Tablet->>Tablet: Clear in-memory CryptoKey reference
        Tablet-->>Staff: Displays "App Locked — Enter 6-Digit PIN"
    end

    opt Re-Unlocking
        Staff->>Tablet: Enters 6-Digit PIN
        Tablet->>Tablet: Derive key via PBKDF2 with stored salt
        Tablet->>Tablet: Verify against hash; restore CryptoKey in memory
        Tablet-->>Staff: Restores Clinical Dashboard
    end
```
