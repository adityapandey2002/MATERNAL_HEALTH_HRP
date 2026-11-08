import type { Patient, Visit } from "@hrp/shared";
import type { FollowUpListItem } from "@hrp/shared/schemas";
import { useLiveQuery } from "dexie-react-hooks";
import { getCachedSession } from "../session-cache";
import type { LocalFollowUp, LocalPatient, LocalVisit } from "./local-db";
import { followUpRepo, patientRepo, visitRepo } from "./repositories";

export function toPatient(lp: LocalPatient): Patient {
  return {
    id: lp.id,
    abhaId: lp.abhaId,
    facilityId: lp.facilityId,
    registeredBy: lp.registeredBy,
    anmName: lp.anmName,
    name: lp.name,
    age: lp.age,
    phone: lp.phone,
    address: lp.address,
    hrpReason: lp.hrpReason as Patient["hrpReason"],
    hrpComplication: lp.hrpComplication as Patient["hrpComplication"],
    ashaName: lp.ashaName,
    ashaPhone: lp.ashaPhone,
    referred: lp.referred,
    isHrp: lp.isHrp,
    followUpTrack: lp.followUpTrack as Patient["followUpTrack"],
    followUpScheduledDate: lp.followUpScheduledDate ? new Date(lp.followUpScheduledDate) : null,
    followUpStatus: lp.followUpStatus as Patient["followUpStatus"],
    lmp: lp.lmp ? new Date(lp.lmp) : null,
    edd: lp.edd ? new Date(lp.edd) : null,
    gravida: lp.gravida,
    para: lp.para,
    abortions: lp.abortions,
    riskFactors: lp.riskFactors as Patient["riskFactors"],
    riskLevel: lp.riskLevel as Patient["riskLevel"],
    riskScore: lp.riskScore,
    isHighRisk: lp.isHighRisk,
    createdAt: new Date(lp.createdAt),
    updatedAt: new Date(lp.updatedAt),
  } as Patient;
}

export function toVisit(lv: LocalVisit): Visit {
  return {
    id: lv.id,
    patientId: lv.patientId,
    facilityId: lv.facilityId,
    conductedBy: lv.conductedBy,
    visitNumber: lv.visitNumber,
    visitDate: new Date(lv.visitDate),
    gestationalWeeks: lv.gestationalWeeks,
    bpSystolic: lv.bpSystolic,
    bpDiastolic: lv.bpDiastolic,
    hemoglobin: lv.hemoglobin,
    weight: lv.weight,
    dangerSigns: lv.dangerSigns as Visit["dangerSigns"],
    supplements: lv.supplements,
    referred: lv.referred,
    notes: lv.notes ?? undefined,
    createdAt: new Date(lv.createdAt),
    updatedAt: new Date(lv.updatedAt),
  } as unknown as Visit;
}

/**
 * Local reads must never take a screen down.
 *
 * `useLiveQuery` re-throws a rejected querier during render, and a render
 * throw unmounts the whole React tree — on a phone that is the blank white
 * screen the field team reported. A closed database or a row that cannot be
 * decrypted should degrade to "no cached rows yet", not a dead app; the sync
 * strip then tells the worker whether anything is waiting to upload.
 */
async function readOrEmpty<T>(what: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    // Literal format string, details as an argument: see the semgrep
    // unsafe-formatstring rule.
    console.warn("[db] local read failed; showing an empty list", { what, error });
    return [];
  }
}

export function useLocalPatients() {
  return useLiveQuery(async () => {
    const rows = await readOrEmpty("patients", () => patientRepo.list());
    return rows.map(toPatient);
  }, []);
}

export function useLocalVisits() {
  return useLiveQuery(async () => {
    const rows = await readOrEmpty("visits", () => visitRepo.list());
    return rows.map(toVisit);
  }, []);
}

/**
 * Joins a cached follow-up with its cached patient so the shared line list can
 * render the same row shape offline that the server sends online.
 *
 * Names of other staff are not cached on the device. When the row belongs to
 * the signed-in worker we can label it from the cached session; otherwise the
 * row falls back to the unassigned wording.
 */
export function toFollowUpListItem(
  followUp: LocalFollowUp,
  patient: LocalPatient | undefined
): FollowUpListItem {
  const me = getCachedSession()?.user;
  const mine = me && followUp.assignedToUserId === me.id ? me : null;
  const completedByMe = me && followUp.completedByUserId === me.id ? me : null;

  return {
    id: followUp.id,
    patientId: followUp.patientId,
    assignedToUserId: followUp.assignedToUserId,
    assignedByUserId: followUp.assignedByUserId,
    level: followUp.level as FollowUpListItem["level"],
    track: followUp.track as FollowUpListItem["track"],
    status: followUp.status,
    scheduledDate: followUp.scheduledDate,
    completedAt: followUp.completedAt,
    completedByUserId: followUp.completedByUserId,
    notes: followUp.notes,
    createdAt: followUp.createdAt,
    updatedAt: followUp.updatedAt,
    patientName: patient?.name ?? "Unknown woman",
    patientAge: patient?.age ?? 0,
    patientPhone: patient?.phone ?? null,
    patientRiskLevel: (patient?.riskLevel ?? "GREEN") as FollowUpListItem["patientRiskLevel"],
    hrpComplication: (patient?.hrpComplication ?? null) as FollowUpListItem["hrpComplication"],
    village: patient?.address ?? null,
    blockName: null,
    assignedToName: mine?.name ?? null,
    assignedToRole: mine?.role ?? null,
    completedByName: completedByMe?.name ?? null,
    completedByRole: completedByMe?.role ?? null,
  };
}

export function useLocalFollowUpItems() {
  return useLiveQuery(async () => {
    const [followUps, patients] = await Promise.all([
      readOrEmpty("follow-ups", () => followUpRepo.list()),
      readOrEmpty("patients", () => patientRepo.list()),
    ]);
    const byId = new Map(patients.map((patient) => [patient.id, patient]));
    return followUps.map((followUp) => toFollowUpListItem(followUp, byId.get(followUp.patientId)));
  }, []);
}
