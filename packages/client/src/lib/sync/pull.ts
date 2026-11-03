import { api } from "../api";
import { canUseLocalData } from "../crypto";
import type { LocalFollowUp, LocalPatient, LocalVisit } from "../db/local-db";
import { followUpRepo, metaRepo, patientRepo, visitRepo } from "../db/repositories";

function toLocalPatient(p: Record<string, unknown>): LocalPatient {
  return {
    id: String(p.id),
    abhaId: (p.abhaId ?? p.abha_id ?? null) as string | null,
    facilityId: String(p.facilityId ?? p.facility_id),
    registeredBy: String(p.registeredBy ?? p.registered_by),
    anmName: (p.anmName ?? p.anm_name ?? null) as string | null,
    name: String(p.name ?? ""),
    age: Number(p.age ?? 0),
    phone: (p.phone ?? null) as string | null,
    address: (p.address ?? null) as string | null,
    hrpReason: (p.hrpReason ?? p.hrp_reason ?? null) as string | null,
    hrpComplication: (p.hrpComplication ?? p.hrp_complication ?? null) as string | null,
    ashaName: (p.ashaName ?? p.asha_name ?? null) as string | null,
    ashaPhone: (p.ashaPhone ?? p.asha_phone ?? null) as string | null,
    referred: Boolean(p.referred),
    isHrp: Boolean(p.isHrp ?? p.is_hrp),
    followUpTrack: (p.followUpTrack ?? p.follow_up_track ?? null) as string | null,
    followUpScheduledDate: (p.followUpScheduledDate ?? p.follow_up_scheduled_date ?? null) as
      | string
      | null,
    followUpStatus: String(p.followUpStatus ?? p.follow_up_status ?? "PENDING"),
    lmp: (p.lmp ?? null) as string | null,
    edd: (p.edd ?? null) as string | null,
    gravida: Number(p.gravida ?? 0),
    para: Number(p.para ?? 0),
    abortions: Number(p.abortions ?? 0),
    riskFactors: (p.riskFactors ?? p.risk_factors ?? []) as string[],
    riskLevel: String(p.riskLevel ?? p.risk_level ?? "GREEN"),
    riskScore: Number(p.riskScore ?? p.risk_score ?? 0),
    isHighRisk: Boolean(p.isHighRisk ?? p.is_high_risk),
    createdAt: String(p.createdAt ?? p.created_at),
    updatedAt: String(p.updatedAt ?? p.updated_at),
    syncStatus: "synced",
  };
}

function toLocalVisit(v: Record<string, unknown>): LocalVisit {
  return {
    id: String(v.id),
    patientId: String(v.patientId ?? v.patient_id),
    facilityId: String(v.facilityId ?? v.facility_id),
    conductedBy: String(v.conductedBy ?? v.conducted_by),
    visitNumber: Number(v.visitNumber ?? v.visit_number ?? 1),
    visitDate: String(v.visitDate ?? v.visit_date),
    gestationalWeeks: Number(v.gestationalWeeks ?? v.gestational_weeks ?? 0),
    bpSystolic: (v.bpSystolic ?? v.bp_systolic ?? null) as number | null,
    bpDiastolic: (v.bpDiastolic ?? v.bp_diastolic ?? null) as number | null,
    hemoglobin: (v.hemoglobin ?? null) as number | null,
    weight: (v.weight ?? null) as number | null,
    dangerSigns: (v.dangerSigns ?? v.danger_signs ?? []) as string[],
    supplements: (v.supplements ?? {}) as Record<string, boolean>,
    referred: Boolean(v.referred),
    notes: (v.notes ?? null) as string | null,
    createdAt: String(v.createdAt ?? v.created_at),
    updatedAt: String(v.updatedAt ?? v.updated_at),
    syncStatus: "synced",
  };
}

function toLocalFollowUp(f: Record<string, unknown>): LocalFollowUp {
  return {
    id: String(f.id),
    patientId: String(f.patientId ?? f.patient_id),
    assignedToUserId: String(f.assignedToUserId ?? f.assigned_to_user_id),
    assignedByUserId: String(f.assignedByUserId ?? f.assigned_by_user_id),
    level: String(f.level),
    track: String(f.track),
    status: (f.status ?? "PENDING") as LocalFollowUp["status"],
    scheduledDate: String(f.scheduledDate ?? f.scheduled_date),
    completedAt: (f.completedAt ?? f.completed_at ?? null) as string | null,
    completedByUserId: (f.completedByUserId ?? f.completed_by_user_id ?? null) as string | null,
    notes: (f.notes ?? null) as string | null,
    createdAt: String(f.createdAt ?? f.created_at),
    updatedAt: String(f.updatedAt ?? f.updated_at),
    syncStatus: "synced",
  };
}

export async function pullCohort(): Promise<void> {
  if (!canUseLocalData()) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    const sinceRaw = await metaRepo.get("lastPulledAt");
    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    const res = await api.sync.pull(since);
    for (const p of res.patients ?? [])
      await patientRepo.upsert(toLocalPatient(p as Record<string, unknown>));
    for (const v of res.visits ?? [])
      await visitRepo.upsert(toLocalVisit(v as Record<string, unknown>));
    for (const f of res.followUps ?? [])
      await followUpRepo.upsert(toLocalFollowUp(f as Record<string, unknown>));
    if (res.serverTimestamp)
      await metaRepo.set("lastPulledAt", new Date(res.serverTimestamp).toISOString());
  } catch (err) {
    // Leave the existing cache intact; surface via sync status later.
    console.warn("[sync] pull failed:", err instanceof Error ? err.message : err);
  }
}
