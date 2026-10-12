export interface Facility {
  id: string;
  code: string;
  name: string;
  level: 'VILLAGE' | 'HWC' | 'PHC' | 'CHC' | 'DISTRICT' | 'STATE';
  parent_id: string | null;
  path: string;
  state: string;
  district: string;
  block: string;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  password_hash: string;
  role: 'ANM' | 'ASHA' | 'CHO' | 'MO' | 'DISTRICT_ADMIN' | 'STATE_ADMIN';
  facility_id: string;
  language: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Patient {
  id: string;
  abha_id: string | null;
  facility_id: string;
  registered_by: string;
  name: string;
  age: number;
  phone: string | null;
  address: string | null;
  lmp: Date | null;
  edd: Date | null;
  gravida: number;
  para: number;
  abortions: number;
  risk_factors: string[];
  risk_level: 'GREEN' | 'AMBER' | 'RED';
  risk_score: number;
  is_high_risk: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Visit {
  id: string;
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
  danger_signs: string[];
  ifa_given: boolean;
  calcium_given: boolean;
  albendazole_given: boolean;
  referred: boolean;
  referral_reason: string | null;
  referral_facility_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Referral {
  id: string;
  patient_id: string;
  from_facility_id: string;
  to_facility_id: string;
  referred_by: string;
  reason: string;
  urgency: 'GREEN' | 'AMBER' | 'RED';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
  responded_at: Date | null;
  responded_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SyncQueue {
  id: string;
  entity_type: 'PATIENT' | 'VISIT' | 'REFERRAL';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
  retry_count: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupervisionAlert {
  id: string;
  facility_id: string;
  type: 'ANM_OFFLINE' | 'VISIT_OVERDUE' | 'SYNC_FAILED' | 'HIGH_RISK_UNATTENDED';
  severity: 'GREEN' | 'AMBER' | 'RED';
  message: string;
  related_entity_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
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