# Matru Suraksha — REST API Documentation

This document serves as the comprehensive technical reference for the **Matru Suraksha** HTTP REST API. All endpoints are hosted under `/api` (or top-level system paths) and adhere to standard JSON REST conventions.

---

## 1. Global Conventions & Standards

### 1.1 Content Negotiation & Serialization
- **Request Format:** `Content-Type: application/json`.
- **Response Format:** All JSON keys are serialized in **`camelCase`**. Timestamps are ISO-8601 strings in UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Date Inputs:** Accept ISO date strings (`YYYY-MM-DD` or full ISO timestamp) or Unix timestamps.

### 1.2 Authentication
Protected endpoints require an `Authorization` header containing a valid JSON Web Token:
```http
Authorization: Bearer <access-token>
```
For web browser sessions, the access token expires in 15 minutes and is automatically refreshed using an `httpOnly`, `SameSite=Lax` refresh cookie named `refreshToken`.

### 1.3 Device Authentication
Clients running on mobile handsets supply an enrolled device identifier:
```http
X-Device-Id: <uuid>
```
If the server finds that this device identifier is revoked in the `devices` table, the request is rejected with HTTP 401 `DEVICE_REVOKED`.

### 1.4 Standard Error Response Structure
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed: bpSystolic must be <= 250",
  "code": "VALIDATION_ERROR"
}
```

---

## 2. System & Health Endpoints

### 2.1 Liveness Probe
- **`GET /health`**
- **Auth:** None.
- **Description:** Basic process liveness check. Does not touch the database.
- **Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-11-09T16:00:00.000Z"
}
```

### 2.2 Readiness Probe
- **`GET /ready`**
- **Auth:** None.
- **Description:** Verifies database connectivity and validates that at least one migration has been applied.
- **Response (200 OK):**
```json
{
  "status": "ready",
  "database": "ok",
  "migration": "009_repair_facility_paths.sql",
  "version": "1.0.0",
  "sha": "1a0cea6"
}
```
- **Error Response (503 Service Unavailable):**
```json
{
  "status": "not_ready",
  "reason": "migrations"
}
```

### 2.3 Application Version & Update Check
- **`GET /api/version`**
- **Auth:** None.
- **Description:** Returns the latest published APK version and release notes from GitHub Releases to determine if an update is available.
- **Response (200 OK):**
```json
{
  "version": "1.0.0",
  "gitSha": "1a0cea6",
  "apkDownloadUrl": "https://github.com/adityapandey2002/MATERNAL_HEALTH_HRP/releases/download/v1.0.0/matru-suraksha-1.0.0.apk",
  "apkSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

## 3. Authentication Routes (`/api/auth`)

### 3.1 Login
- **`POST /api/auth/login`**
- **Auth:** Public.
- **Request Body:**
```json
{
  "employeeId": "ANM001",
  "password": "example-password",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```
*Note: Helpdesk staff supply their registered email in the `employeeId` field.*
- **Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "employeeId": "ANM001",
    "name": "Asha Ben",
    "phone": "9988776655",
    "role": "ANM",
    "facilityId": "22222222-2222-4222-8222-222222222222",
    "facilityName": "Shivrajpur HSC",
    "language": "hi",
    "isActive": true
  }
}
```

### 3.2 Refresh Token
- **`POST /api/auth/refresh`**
- **Auth:** Valid `refreshToken` cookie (web) or request body `{ "refreshToken": "..." }` (native).
- **Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
}
```

### 3.3 Active Session Profile
- **`GET /api/auth/me`**
- **Auth:** Bearer Token.
- **Response (200 OK):** Returns current user object and assigned facility metadata.

### 3.4 Logout
- **`POST /api/auth/logout`**
- **Auth:** Bearer Token.
- **Description:** Clears the `refreshToken` cookie and logs the termination.
- **Response (200 OK):** `{ "success": true }`

---

## 4. Patient & HRP Management (`/api/patients` & `/api/hrp/patients`)

### 4.1 List Patients
- **`GET /api/patients`**
- **Auth:** Bearer Token (`patient:read`).
- **Query Parameters:**
  - `search` (string): Free-text query matching name, phone, or UUID.
  - `facilityId` (UUID): Filter by facility (must be within actor's scope).
  - `riskLevel` (enum): `GREEN`, `AMBER`, or `RED`.
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 20): Results per page.
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Sita Devi",
      "age": 24,
      "phone": "9988776655",
      "address": "Shivrajpur Village",
      "riskLevel": "AMBER",
      "riskScore": 45,
      "isHrp": true,
      "hrpComplication": "PIH",
      "followUpStatus": "PENDING",
      "followUpTrack": "FIELD_15_DAY",
      "followUpScheduledDate": "2026-11-24T00:00:00.000Z",
      "createdAt": "2026-11-09T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 4.2 Create Patient (Standard Registration)
- **`POST /api/patients`**
- **Auth:** Bearer Token (`patient:write`). Allowed roles: `ANM`, `CHO`, `HRP_HELPDESK_BLOCK`, `BHM`.
- **Request Body:**
```json
{
  "name": "Sita Devi",
  "age": 24,
  "phone": "9988776655",
  "address": "Shivrajpur",
  "lmp": "2026-08-01",
  "gravida": 2,
  "para": 1,
  "abortions": 0,
  "riskFactors": ["HYPERTENSION"],
  "referred": false
}
```
- **Response (201 Created):** Returns the persisted patient entity with calculated `edd`, `riskScore`, and `riskLevel`.

### 4.3 High-Risk Pregnancy Intake (7-Field Form)
- **`POST /api/hrp/patients`**
- **Auth:** Bearer Token (`patient:write`).
- **Request Body:**
```json
{
  "name": "Sunita Kumari",
  "age": 22,
  "phone": "9876543210",
  "address": "Raniganj",
  "lmp": "2026-07-15",
  "hrpComplication": "ANEMIA",
  "referred": true,
  "isHrp": true
}
```
- **Response (201 Created):**
  - Creates the patient record with `isHrp = true`.
  - Automatically triggers `scheduleFollowUp()`.
  - If `referred = true`, creates a `BLOCK_15_DAY` follow-up assigned to the Block Helpdesk.
  - If `referred = false`, creates a `FIELD_15_DAY` follow-up assigned to the registering worker.

---

## 5. Antenatal Care Visits (`/api/visits`)

### 5.1 Record ANC Visit & Vitals
- **`POST /api/visits`**
- **Auth:** Bearer Token (`visit:write`). Allowed roles: `ANM`, `CHO`, `HRP_HELPDESK_BLOCK`, `BHM`.
- **Request Body:**
```json
{
  "patientId": "33333333-3333-4333-8333-333333333333",
  "visitNumber": 2,
  "gestationalWeeks": 20,
  "visitDate": "2026-11-09",
  "bpSystolic": 138,
  "bpDiastolic": 88,
  "hb": 9.2,
  "weight": 54.5,
  "fundalHeight": 20,
  "fetalHeartRate": 142,
  "dangerSigns": ["HYPERTENSION"],
  "ifaGiven": true,
  "calciumGiven": true,
  "albendazoleGiven": false,
  "referred": false,
  "notes": "Routine second ANC checkup. Advised rest."
}
```
- **Response (201 Created):** Returns the visit record. Automatically re-evaluates the mother's risk score and updates `patients.risk_score` and `patients.risk_level`.

---

## 6. 15-Day Follow-Up & Escalation (`/api/hrp/follow-ups`)

### 6.1 List Follow-Up Queue
- **`GET /api/hrp/follow-ups`**
- **Auth:** Bearer Token (`followup:manage` or `patient:read`).
- **Query Parameters:** `status` (`PENDING`, `COMPLETE`, `NOT_REACHABLE`), `track` (`BLOCK_15_DAY`, `FIELD_15_DAY`), `search`, `page`, `limit`.
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "patientId": "33333333-3333-4333-8333-333333333333",
      "patientName": "Sunita Kumari",
      "patientAge": 22,
      "patientPhone": "9876543210",
      "village": "Raniganj",
      "hrpComplication": "ANEMIA",
      "track": "BLOCK_15_DAY",
      "status": "PENDING",
      "scheduledDate": "2026-11-24T00:00:00.000Z",
      "assignedToName": "Amit Kumar",
      "assignedToRole": "HRP_HELPDESK_BLOCK"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 6.2 Update Follow-Up Status (Close Contact)
- **`PATCH /api/hrp/follow-ups/:id`**
- **Auth:** Bearer Token (`followup:manage`).
- **Request Body:**
```json
{
  "status": "COMPLETE",
  "notes": "Specialist consultation attended at CHC. Iron sucrose IV prescribed.",
  "completedAt": "2026-11-09T14:30:00.000Z"
}
```
- **Business Logic Executed:**
  1. The current cycle is marked `COMPLETE` with `completed_by_user_id = actor.id`.
  2. If the completed cycle was `BLOCK_15_DAY`, the system automatically provisions the next `FIELD_15_DAY` cycle assigned to the registering ANM/CHO, due in `completedAt + 15 days`.
  3. If the cycle was already `FIELD_15_DAY`, the system initiates the next recurring 15-day field cycle.

### 6.3 Dispatch Follow-Up Worklist
- **`POST /api/hrp/follow-ups/dispatch`**
- **Auth:** Bearer Token (`followup:manage`). Allowed roles: `BHM`, `DHS`.
- **Description:** Pushes a list of pending high-risk cases to a specific frontline worker's panel.
- **Request Body:**
```json
{
  "patientIds": ["33333333-3333-4333-8333-333333333333"],
  "assignedToUserId": "11111111-1111-4111-8111-111111111111",
  "track": "FIELD_15_DAY",
  "scheduledDate": "2026-11-24T00:00:00.000Z",
  "notes": "Targeted outreach for severe anemia check."
}
```
- **Response (201 Created):** `{ "count": 1, "data": [...] }`

---

## 7. Offline Synchronization (`/api/sync`)

### 7.1 Push Offline Mutations
- **`POST /api/sync/push`**
- **Auth:** Bearer Token (`sync:push`).
- **Request Body:**
```json
{
  "patients": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "name": "Pooja Devi",
      "age": 26,
      "facilityId": "22222222-2222-4222-8222-222222222222",
      "clientUpdatedAt": "2026-11-09T11:00:00.000Z"
    }
  ],
  "visits": [],
  "followUps": []
}
```
- **Response (200 OK):**
```json
{
  "synced": {
    "patients": ["55555555-5555-4555-8555-555555555555"],
    "visits": [],
    "followUps": []
  },
  "conflicts": [],
  "serverTimestamp": "2026-11-09T16:00:00.000Z"
}
```

### 7.2 Pull Cohort Updates
- **`GET /api/sync/pull`**
- **Auth:** Bearer Token (`sync:read`).
- **Query Parameters:** `since` (ISO timestamp).
- **Response (200 OK):** Returns all patients, visits, and follow-ups updated in the user's facility subtree after the `since` timestamp.

---

## 8. Staff Provisioning (`/api/staff`)

### 8.1 Create Staff Account
- **`POST /api/staff`**
- **Auth:** Bearer Token (`staff:manage`). Allowed roles: `DHS` (creates BHM, District Helpdesk), `BHM` (creates ANM, CHO, Block Helpdesk).
- **Request Body:**
```json
{
  "name": "Dr. Ramesh Verma",
  "phone": "9876501234",
  "email": "bhm.raniganj@araria.gov.in",
  "role": "BHM",
  "facilityId": "22222222-2222-4222-8222-222222222222",
  "password": "example-password"
}
```
- **Response (201 Created):** Returns user entity with auto-generated `employeeId` if omitted.

---

## 9. Mobile Device Management (`/api/devices`)

### 9.1 Register or Heartbeat Device
- **`POST /api/devices/register`**
- **Auth:** Bearer Token.
- **Request Body:**
```json
{
  "deviceId": "77777777-7777-4777-8777-777777777777",
  "label": "Samsung Galaxy A14 (ANM Mobile)",
  "platform": "android"
}
```
- **Response (200 OK):** `{ "status": "registered", "revoked": false }`

### 9.2 Remote Revocation
- **`POST /api/devices/:id/revoke`**
- **Auth:** Bearer Token (`device:revoke`). Allowed roles: `BHM`, `DHS`.
- **Response (200 OK):** Sets `revoked_at = now()`. Any further sync or auth from this handset is blocked.
