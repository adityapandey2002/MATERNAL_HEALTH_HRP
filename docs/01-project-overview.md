# Matru Suraksha — Project Overview

## 1. Executive Summary

**Matru Suraksha** ("Maternal Protection") is an enterprise-grade, offline-first digital health platform tailored for India's public health ecosystem. Developed to serve the National Health Mission (NHM) and district health administration paradigms (specifically piloted for Araria District, Bihar), the platform addresses the critical challenge of tracking, triaging, and managing **High-Risk Pregnancies (HRP)** across hierarchical tiers of public care.

Maternal mortality remains a pressing global and national priority. In resource-constrained rural districts, delays in identifying high-risk pregnancy complications (such as severe anemia, pregnancy-induced hypertension/preeclampsia, gestational diabetes, and short maternal stature) or lapses in scheduled clinical contacts directly elevate morbidity and mortality rates. Matru Suraksha digitizes maternal health management from the grassroots sub-center to the district administration through automated clinical risk scoring, offline-capable clinical records, and a structured, closed-loop 15-day follow-up cycle.

---

## 2. Problem Statement & Operational Context

In India's public health administration, care delivery operates along a distributed administrative pyramid:

```
Sub-Center / Health & Wellness Center (HSC / HWC)
                  ↓
Primary Health Center / Community Health Center (PHC / CHC)
                  ↓
Block Health Administration (Block Nodal / BHM)
                  ↓
Sub-Divisional Hospital (SDH) / First Referral Unit (FRU)
                  ↓
District Hospital (Sadar Hospital) / District Health Society (DHS)
```

Historically, front-line health workers record maternal health metrics on physical paper registers and Maternal and Child Protection (MCP) cards. This manual approach presents critical structural vulnerabilities:

1. **Fragmented Tracking:** When a woman identified with danger signs at an HSC is referred to a CHC or Sadar Hospital, tracking is lost between administrative boundaries. Neither the block medical officer nor the ANM receives structured feedback on whether specialist care was received.
2. **Connectivity Dead Zones:** Frontline workers operating in remote hamlets frequently lack 4G/cellular connectivity. Traditional web applications fail completely without network access, preventing real-time point-of-care documentation.
3. **Delayed Escalation:** Under paper-based or batch-entry workflows, missed clinical follow-up visits or unmanaged complications go unnoticed until critical emergencies occur during labor.
4. **Data Privacy Risks at the Edge:** Field devices left unlocked or stolen pose severe risks of unauthorized disclosure of sensitive Protected Health Information (PHI).

---

## 3. Product Vision & Value Proposition

Matru Suraksha establishes a unified digital continuum of care across all tiers:

- **Offline-First Point of Care:** Auxiliary Nurse Midwives (ANMs) and Community Health Officers (CHOs) can capture maternal vitals, record visits, evaluate danger signs, and perform follow-up tasks without any cellular connectivity. Records are stored securely in local IndexedDB storage and synced automatically upon reconnection.
- **Automated Algorithmic Risk Scoring:** Pregnancy danger signs, vital parameters (blood pressure, hemoglobin, weight, fundal height, fetal heart rate), maternal age, and obstetric history are scored against clinical rules to assign standardized risk tiers (`GREEN`, `AMBER`, `RED`).
- **Closed-Loop 15-Day Follow-Up Cycle:** High-risk cases enter a mandatory, repeating 15-day contact schedule. If a patient is referred to a higher facility, the first follow-up is anchored directly to the Block HRP Helpdesk (`BLOCK_15_DAY`), ensuring administrative ownership. Subsequent cycles transition back to the field clinician (`FIELD_15_DAY`).
- **Automatic Escalation:** Follow-ups that remain incomplete past their 15-day due window automatically escalate to the District Health Officer (DHS) and District Helpdesk oversight queues.
- **Zero-Trust Field Cryptography:** In pilot deployments, direct patient identifiers and clinical notes are encrypted on the device with AES-256-GCM using an in-memory key unlocked by a 6-digit PIN. If a device is revoked by an administrator or suffers 10 consecutive failed PIN attempts, local data is immediately purged.

---

## 4. User Roles & Organizational Hierarchy

Matru Suraksha defines six operational roles spanning field delivery, facility triage, block coordination, and district oversight:

| Tier | Role Identifier | User Title | Primary Interface | Core Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Field** | `ANM` | Auxiliary Nurse Midwife | Mobile PWA (Offline-First) | Village-level registration, ANC visit logging, vitals capture, 15-day field follow-ups. |
| **Facility Triage** | `CHO` | Community Health Officer | Desktop & Mobile PWA | Health & Wellness Center (HWC) clinical triage, vitals screening, follow-up management. |
| **Block Coordination** | `HRP_HELPDESK_BLOCK` | Block HRP Helpdesk Operator | Desktop Dashboard | First 15-day contact for referred high-risk cases, phone outreach, shared line-list updates. |
| **Block Supervision** | `BHM` | Block Health Manager | Desktop Dashboard | Block-wide surveillance, dispatching cases to ANM/CHO, provisioning field & helpdesk accounts. |
| **District Coordination**| `HRP_HELPDESK_DISTRICT`| District Helpdesk Operator | Desktop Dashboard | District-level escalation line-list management, inter-block triage support. |
| **District Oversight** | `DHS` | District Health Society / Civil Surgeon | Desktop Dashboard | District compliance KPIs, breached follow-up resolution, provisioning BHM and district accounts. |

---

## 5. System Scope & Core Capabilities

The MVP platform encompasses the following modules:

1. **Authentication & Session Management:**
   - Dual-mode authentication: Employee ID or Email with bcrypt password verification.
   - Web clients: Short-lived JWT (15 minutes) with secure, httpOnly refresh cookie (7 days).
   - Capacitor Android builds: Header-based token exchange paired with device UUID validation.
   - Role-based and hierarchical facility scope enforcement on every request.

2. **Patient Registration & Vitals Engine:**
   - Point-of-care registration capturing parity, gravidity, LMP, EDD (calculated via Naegele's rule: LMP + 280 days), and gestational age.
   - Evaluation of 8 standardized obstetric danger signs and 9 high-risk complications.
   - Comprehensive ANC visit logging: BP systolic/diastolic, Hemoglobin, Weight, Fundal Height, Fetal Heart Rate, and prophylactic supplement tracking (IFA, Calcium, Albendazole).

3. **Follow-Up & Escalation Engine:**
   - Automated enrollment into the 15-day follow-up cycle upon identification of an HRP flag.
   - Dynamic track assignment: `BLOCK_15_DAY` for referred cases; `FIELD_15_DAY` for non-referred cases.
   - Closed-loop re-trigger: Completing a contact automatically generates the next 15-day follow-up window.
   - Overdue SLA breach monitoring: Automatic flagging and elevation to district supervisor dashboards.

4. **Offline Synchronization & Device Security:**
   - Dexie-backed IndexedDB local cache for offline operation.
   - Transactional synchronization queue with exponential retry backoff and conflict logging.
   - PIN-protected AES-256-GCM local storage encryption with HMAC blind indexing for duplicate lookups.
   - Remote device wipe and revocation capabilities managed by supervisory staff.

5. **Delegated Administration & Access Control:**
   - Cascading account provisioning: DHS manages BHM and District Helpdesk; BHM manages ANM, CHO, and Block Helpdesk.
   - Strict hierarchical facility path scoping (`state.district.block.facility`).
