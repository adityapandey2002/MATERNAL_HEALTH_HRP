import type { ColumnType, Generated, Selectable } from "kysely";

/**
 * Database column types.
 *
 * `Generated<T>` marks columns the database fills in (defaults + generated
 * uuid), so Kysely treats them as optional on insert. jsonb columns are
 * declared as `ColumnType<T, string, string>` because the driver sends them
 * as JSON text and parses them back into objects on read.
 */

export interface Facility {
  id: Generated<string>;
  code: string;
  name: string;
  level: "VILLAGE" | "HWC" | "PHC" | "CHC" | "DISTRICT" | "STATE";
  parent_id: string | null;
  path: string;
  state: string;
  district: string;
  block: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface User {
  id: Generated<string>;
  employee_id: string;
  name: string;
  phone: string;
  password_hash: string;
  role: "ANM" | "ASHA" | "CHO" | "MO" | "DISTRICT_ADMIN" | "STATE_ADMIN";
  facility_id: string;
  language: Generated<string>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Patient {
  id: Generated<string>;
  abha_id: string | null;
  facility_id: string;
  registered_by: string;
  name: string;
  age: number;
  phone: string | null;
  address: string | null;
  lmp: Date | null;
  edd: Date | null;
  gravida: Generated<number>;
  para: Generated<number>;
  abortions: Generated<number>;
  risk_factors: ColumnType<string[], string | undefined, string>;
  risk_level: Generated<"GREEN" | "AMBER" | "RED">;
  risk_score: Generated<number>;
  is_high_risk: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Visit {
  id: Generated<string>;
  patient_id: string;
  facility_id: string;
  conducted_by: string;
  visit_number: number;
  gestational_weeks: number;
  visit_date: Date;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  hb: number | null;
  weight: number | null;
  fundal_height: number | null;
  fetal_heart_rate: number | null;
  danger_signs: ColumnType<string[], string | undefined, string>;
  ifa_given: Generated<boolean>;
  calcium_given: Generated<boolean>;
  albendazole_given: Generated<boolean>;
  referred: Generated<boolean>;
  referral_reason: string | null;
  referral_facility_id: string | null;
  notes: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Referral {
  id: Generated<string>;
  patient_id: string;
  from_facility_id: string;
  to_facility_id: string;
  referred_by: string;
  reason: string;
  urgency: "GREEN" | "AMBER" | "RED";
  status: Generated<"PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED">;
  responded_at: Date | null;
  responded_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SyncQueue {
  id: Generated<string>;
  entity_type: "PATIENT" | "VISIT" | "REFERRAL";
  entity_id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: ColumnType<Record<string, unknown>, string | undefined, string>;
  status: Generated<"PENDING" | "SYNCING" | "COMPLETED" | "FAILED" | "CONFLICT">;
  retry_count: Generated<number>;
  last_error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SupervisionAlert {
  id: Generated<string>;
  facility_id: string;
  type: "ANM_OFFLINE" | "VISIT_OVERDUE" | "SYNC_FAILED" | "HIGH_RISK_UNATTENDED";
  severity: "GREEN" | "AMBER" | "RED";
  message: string;
  related_entity_id: string | null;
  acknowledged: Generated<boolean>;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Generated<Date>;
}

export interface DB {
  facilities: Facility;
  users: User;
  patients: Patient;
  visits: Visit;
  referrals: Referral;
  sync_queue: SyncQueue;
  supervision_alerts: SupervisionAlert;
}

/** Row shape as returned by a SELECT (defaults resolved, jsonb parsed). */
export type FacilityRow = Selectable<DB["facilities"]>;
export type UserRow = Selectable<DB["users"]>;
export type PatientRow = Selectable<DB["patients"]>;
export type VisitRow = Selectable<DB["visits"]>;
export type ReferralRow = Selectable<DB["referrals"]>;
export type SyncQueueRow = Selectable<DB["sync_queue"]>;
export type SupervisionAlertRow = Selectable<DB["supervision_alerts"]>;
