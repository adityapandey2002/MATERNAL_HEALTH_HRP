# Matru Suraksha — Database Entity-Relationship (ER) Diagram

This document provides a comprehensive Entity-Relationship diagram and relationship reference for the PostgreSQL 16 schema powering the **Matru Suraksha** platform.

---

## 1. Complete Entity-Relationship Diagram

```mermaid
erDiagram
    FACILITIES ||--o{ STAFF : employs
    FACILITIES ||--o{ PATIENTS : registers
    FACILITIES ||--o{ REFERRALS : "from/to facility"
    
    STAFF ||--o{ DEVICE_REGISTRATIONS : owns
    STAFF ||--o{ REFRESH_TOKENS : holds
    STAFF ||--o{ VISITS : conducts
    STAFF ||--o{ CLINICAL_NOTES : authors
    STAFF ||--o{ AUDIT_LOGS : performs
    STAFF ||--o{ FOLLOW_UP_TASKS : assigned

    PATIENTS ||--o{ VISITS : attends
    PATIENTS ||--o{ HIGH_RISK_CONDITIONS : diagnosed
    PATIENTS ||--o{ FOLLOW_UP_TASKS : requires
    PATIENTS ||--o{ CLINICAL_NOTES : documented
    PATIENTS ||--o{ REFERRALS : referred
    PATIENTS ||--o{ SYNC_EVENTS : tracked

    VISITS ||--o{ HIGH_RISK_CONDITIONS : detects
    VISITS ||--o{ REFERRALS : initiates

    FACILITIES {
        uuid id PK
        varchar code UK
        varchar name
        varchar type
        varchar path UK
        uuid parent_id FK
        timestamp created_at
    }

    STAFF {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role
        uuid facility_id FK
        varchar phone_number
        boolean is_active
        timestamp created_at
    }

    DEVICE_REGISTRATIONS {
        uuid id PK
        uuid staff_id FK
        varchar device_fingerprint UK
        varchar platform
        varchar app_version
        varchar status
        timestamp approved_at
        timestamp created_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid staff_id FK
        varchar token_hash UK
        timestamp expires_at
        boolean is_revoked
        varchar ip_address
        timestamp created_at
    }

    PATIENTS {
        uuid id PK
        varchar full_name
        varchar phone_number
        integer age
        date lmp_date
        date edd_date
        integer gravida
        integer parity
        integer living_children
        varchar blood_group
        varchar village
        uuid facility_id FK
        varchar facility_path
        boolean is_high_risk
        timestamp created_at
        timestamp updated_at
    }

    HIGH_RISK_CONDITIONS {
        uuid id PK
        uuid patient_id FK
        uuid visit_id FK
        varchar condition_code
        varchar severity
        text clinical_notes
        timestamp detected_at
    }

    VISITS {
        uuid id PK
        uuid patient_id FK
        uuid staff_id FK
        uuid facility_id FK
        integer visit_number
        date visit_date
        integer gestational_age_weeks
        integer systolic_bp
        integer diastolic_bp
        numeric hemoglobin
        integer random_blood_sugar
        numeric fundal_height
        integer fetal_heart_rate
        varchar urine_albumin
        boolean is_high_risk
        timestamp created_at
    }

    FOLLOW_UP_TASKS {
        uuid id PK
        uuid patient_id FK
        uuid assigned_staff_id FK
        varchar follow_up_type
        date scheduled_date
        date completed_date
        varchar status
        text notes
        timestamp created_at
    }

    REFERRALS {
        uuid id PK
        uuid patient_id FK
        uuid visit_id FK
        uuid from_facility_id FK
        uuid to_facility_id FK
        varchar reason
        varchar urgency
        varchar status
        timestamp created_at
    }

    CLINICAL_NOTES {
        uuid id PK
        uuid patient_id FK
        uuid staff_id FK
        text content
        varchar note_type
        timestamp created_at
    }

    SYNC_EVENTS {
        uuid id PK
        uuid device_id FK
        uuid staff_id FK
        varchar entity_type
        uuid entity_id
        varchar action
        jsonb payload
        varchar client_timestamp
        timestamp server_timestamp
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_staff_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        varchar facility_path
        varchar ip_address
        jsonb details
        timestamp created_at
    }

    SYSTEM_SETTINGS {
        varchar key PK
        varchar value
        text description
        timestamp updated_at
    }
```

---

## 2. Table Cardinality & Foreign Key Cascade Behaviors

| Parent Table | Child Table | Relationship | Foreign Key Column | On Delete Action |
| :--- | :--- | :--- | :--- | :--- |
| `facilities` | `staff` | 1 to Many | `staff.facility_id` | `RESTRICT` |
| `facilities` | `patients` | 1 to Many | `patients.facility_id` | `RESTRICT` |
| `facilities` | `facilities` | 1 to Many (Self) | `facilities.parent_id` | `RESTRICT` |
| `staff` | `device_registrations` | 1 to Many | `device_registrations.staff_id` | `CASCADE` |
| `staff` | `refresh_tokens` | 1 to Many | `refresh_tokens.staff_id` | `CASCADE` |
| `staff` | `visits` | 1 to Many | `visits.staff_id` | `RESTRICT` |
| `staff` | `follow_up_tasks` | 1 to Many | `follow_up_tasks.assigned_staff_id` | `SET NULL` |
| `patients` | `visits` | 1 to Many | `visits.patient_id` | `CASCADE` |
| `patients` | `high_risk_conditions` | 1 to Many | `high_risk_conditions.patient_id` | `CASCADE` |
| `patients` | `follow_up_tasks` | 1 to Many | `follow_up_tasks.patient_id` | `CASCADE` |
| `patients` | `clinical_notes` | 1 to Many | `clinical_notes.patient_id` | `CASCADE` |
| `patients` | `referrals` | 1 to Many | `referrals.patient_id` | `CASCADE` |
| `visits` | `high_risk_conditions` | 1 to Many | `high_risk_conditions.visit_id` | `SET NULL` |
| `visits` | `referrals` | 1 to Many | `referrals.visit_id` | `SET NULL` |

---

## 3. Storage & Partitioning Strategies (Planned Scaling)

1. **`audit_logs`:** High-volume immutable append-only log. Planned range partitioning by month (`created_at`) when transitioning from pilot (1 district) to statewide deployment (38 districts).
2. **`sync_events`:** Ephemeral synchronization audit log. Retained with a 90-day time-to-live (TTL) pruning job to maintain database performance.
3. **`visits` & `patients`:** Primary transactional tables indexed with compound B-Trees and `varchar_pattern_ops` for fast hierarchy traversal.
