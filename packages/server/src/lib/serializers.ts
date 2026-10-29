import { UserRole } from "@hrp/shared";
import type {
  Facility,
  FollowUp,
  Patient,
  Referral,
  SupervisionAlert,
  SyncQueue,
  User,
  Visit,
} from "@hrp/shared";
import type {
  FacilityRow,
  FollowUpRow,
  PatientRow,
  ReferralRow,
  SupervisionAlertRow,
  SyncQueueRow,
  UserRow,
  VisitRow,
} from "../db/types.js";

/**
 * Row -> API response mapping.
 *
 * The database is snake_case; the public API contract (and every shared type
 * and client component) is camelCase. Serializing at the boundary keeps the
 * wire format stable regardless of how the tables are named.
 */

export function serializePatient(row: PatientRow, anmName?: string | null): Patient {
  return {
    id: row.id,
    abhaId: row.abha_id,
    facilityId: row.facility_id,
    registeredBy: row.registered_by,
    anmName: anmName ?? null,
    name: row.name,
    age: row.age,
    phone: row.phone,
    address: row.address,
    hrpReason: (row.hrp_reason ?? null) as Patient["hrpReason"],
    hrpComplication: (row.hrp_complication ?? null) as Patient["hrpComplication"],
    isHrp: row.is_hrp,
    followUpTrack: row.follow_up_track as Patient["followUpTrack"],
    followUpScheduledDate: row.follow_up_scheduled_date,
    followUpStatus: row.follow_up_status as Patient["followUpStatus"],
    ashaName: row.asha_name,
    ashaPhone: row.asha_phone,
    referred: row.referred,
    lmp: row.lmp,
    edd: row.edd,
    gravida: row.gravida,
    para: row.para,
    abortions: row.abortions,
    riskFactors: (row.risk_factors ?? []) as Patient["riskFactors"],
    riskLevel: row.risk_level,
    riskScore: row.risk_score,
    isHighRisk: row.is_high_risk,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    conductedBy: row.conducted_by,
    visitNumber: row.visit_number,
    gestationalWeeks: row.gestational_weeks,
    visitDate: row.visit_date,
    bpSystolic: row.bp_systolic,
    bpDiastolic: row.bp_diastolic,
    hb: row.hb,
    weight: row.weight,
    fundalHeight: row.fundal_height,
    fetalHeartRate: row.fetal_heart_rate,
    dangerSigns: (row.danger_signs ?? []) as Visit["dangerSigns"],
    ifaGiven: row.ifa_given,
    calciumGiven: row.calcium_given,
    albendazoleGiven: row.albendazole_given,
    referred: row.referred,
    referralReason: row.referral_reason,
    referralFacilityId: row.referral_facility_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeReferral(row: ReferralRow): Referral {
  return {
    id: row.id,
    patientId: row.patient_id,
    fromFacilityId: row.from_facility_id,
    toFacilityId: row.to_facility_id,
    referredBy: row.referred_by,
    reason: row.reason,
    urgency: row.urgency,
    status: row.status,
    respondedAt: row.responded_at,
    respondedBy: row.responded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeFacility(row: FacilityRow): Facility {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    level: row.level,
    parentId: row.parent_id,
    path: row.path,
    state: row.state,
    district: row.district,
    block: row.block,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeUser(row: UserRow): User {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email ?? null,
    name: row.name,
    phone: row.phone,
    role: UserRole.parse(row.role),
    facilityId: row.facility_id,
    language: row.language,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeSupervisionAlert(row: SupervisionAlertRow): SupervisionAlert {
  return {
    id: row.id,
    facilityId: row.facility_id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    relatedEntityId: row.related_entity_id,
    acknowledged: row.acknowledged,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

export function serializeSyncQueue(row: SyncQueueRow): SyncQueue {
  return {
    id: row.id,
    facilityId: row.facility_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: row.payload,
    status: row.status,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    patientId: row.patient_id,
    assignedToUserId: row.assigned_to_user_id,
    assignedByUserId: row.assigned_by_user_id,
    level: row.level,
    status: row.status,
    track: row.track,
    scheduledDate: row.scheduled_date,
    completedAt: row.completed_at,
    completedByUserId: row.completed_by_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
