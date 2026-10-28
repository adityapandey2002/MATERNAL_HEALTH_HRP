import type { HrpComplication } from "@hrp/shared";
import type {
  CreatePatient,
  CreateReferral,
  CreateVisit,
  UpdatePatient,
  UpdateVisit,
} from "@hrp/shared/schemas";
import type { Insertable, Updateable } from "kysely";
import type { DB } from "../db/types.js";

/**
 * Explicit camelCase -> snake_case mapping.
 *
 * The API contract is camelCase (per @hrp/shared schemas) while the Postgres
 * tables are snake_case. Spreading the raw request body into Kysely emits
 * camelCase keys as column names and every write fails with
 * "column does not exist". Mapping explicitly also blocks mass assignment of
 * server-owned columns (id, created_at, updated_at, risk_*).
 *
 * Create and update are separate because the server owns facility_id and
 * registered_by: they are set on insert and never changed afterwards.
 */

/**
 * Normalises a date input to a Date at UTC midnight.
 *
 * The `date` columns (lmp, edd, visit_date) are read back as Date by the
 * driver, so writes must use Date too. Only the calendar day is meaningful.
 */
function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** jsonb columns are sent as JSON text; the driver parses them back on read. */
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function mapPatientToRow(
  data: CreatePatient,
  server: { facilityId: string; registeredBy: string }
): Insertable<DB["patients"]> {
  const row: Insertable<DB["patients"]> = {
    facility_id: server.facilityId,
    registered_by: server.registeredBy,
    name: data.name,
    age: data.age,
    abha_id: data.abhaId ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    hrp_reason: data.hrpReason ?? null,
    hrp_complication: data.hrpComplication ?? null,
    asha_name: data.ashaName ?? null,
    asha_phone: data.ashaPhone ?? null,
    referred: data.referred,
    is_hrp: data.isHrp ?? false,
    lmp: toDate(data.lmp) ?? null,
    edd: toDate(data.edd) ?? null,
    gravida: data.gravida,
    para: data.para,
    abortions: data.abortions,
    risk_factors: toJson(data.riskFactors),
  };

  return row;
}

export function mapPatientChanges(data: UpdatePatient): Updateable<DB["patients"]> {
  const row: Updateable<DB["patients"]> = {};

  if (data.name !== undefined) row.name = data.name;
  if (data.age !== undefined) row.age = data.age;
  if (data.phone !== undefined) row.phone = data.phone ?? null;
  if (data.address !== undefined) row.address = data.address ?? null;
  if (data.abhaId !== undefined) row.abha_id = data.abhaId ?? null;
  if (data.hrpReason !== undefined) row.hrp_reason = data.hrpReason ?? null;
  if (data.hrpComplication !== undefined) row.hrp_complication = data.hrpComplication ?? null;
  if (data.isHrp !== undefined) row.is_hrp = data.isHrp;
  if (data.ashaName !== undefined) row.asha_name = data.ashaName ?? null;
  if (data.ashaPhone !== undefined) row.asha_phone = data.ashaPhone ?? null;
  if (data.referred !== undefined) row.referred = data.referred;

  const lmp = toDate(data.lmp);
  if (lmp !== undefined) row.lmp = lmp;
  const edd = toDate(data.edd);
  if (edd !== undefined) row.edd = edd;

  if (data.gravida !== undefined) row.gravida = data.gravida;
  if (data.para !== undefined) row.para = data.para;
  if (data.abortions !== undefined) row.abortions = data.abortions;
  if (data.riskFactors !== undefined) row.risk_factors = toJson(data.riskFactors);

  return row;
}

export function mapVisitToRow(
  data: CreateVisit,
  server: { facilityId: string; conductedBy: string }
): Insertable<DB["visits"]> {
  const row: Insertable<DB["visits"]> = {
    facility_id: server.facilityId,
    conducted_by: server.conductedBy,
    patient_id: data.patientId,
    visit_number: data.visitNumber,
    gestational_weeks: data.gestationalWeeks,
    visit_date: toDate(data.visitDate) ?? new Date(),
    bp_systolic: data.bpSystolic ?? null,
    bp_diastolic: data.bpDiastolic ?? null,
    hb: data.hb ?? null,
    weight: data.weight ?? null,
    fundal_height: data.fundalHeight ?? null,
    fetal_heart_rate: data.fetalHeartRate ?? null,
    danger_signs: toJson(data.dangerSigns),
    ifa_given: data.ifaGiven,
    calcium_given: data.calciumGiven,
    albendazole_given: data.albendazoleGiven,
    referred: data.referred,
    referral_reason: data.referralReason ?? null,
    referral_facility_id: data.referralFacilityId ?? null,
    notes: data.notes ?? null,
  };

  return row;
}

export function mapVisitChanges(data: UpdateVisit): Updateable<DB["visits"]> {
  const row: Updateable<DB["visits"]> = {};

  if (data.patientId !== undefined) row.patient_id = data.patientId;
  if (data.visitNumber !== undefined) row.visit_number = data.visitNumber;
  if (data.gestationalWeeks !== undefined) row.gestational_weeks = data.gestationalWeeks;

  const visitDate = toDate(data.visitDate);
  if (visitDate !== undefined) row.visit_date = visitDate;

  if (data.bpSystolic !== undefined) row.bp_systolic = data.bpSystolic;
  if (data.bpDiastolic !== undefined) row.bp_diastolic = data.bpDiastolic;
  if (data.hb !== undefined) row.hb = data.hb;
  if (data.weight !== undefined) row.weight = data.weight;
  if (data.fundalHeight !== undefined) row.fundal_height = data.fundalHeight;
  if (data.fetalHeartRate !== undefined) row.fetal_heart_rate = data.fetalHeartRate;
  if (data.dangerSigns !== undefined) row.danger_signs = toJson(data.dangerSigns);
  if (data.ifaGiven !== undefined) row.ifa_given = data.ifaGiven;
  if (data.calciumGiven !== undefined) row.calcium_given = data.calciumGiven;
  if (data.albendazoleGiven !== undefined) row.albendazole_given = data.albendazoleGiven;
  if (data.referred !== undefined) row.referred = data.referred;
  if (data.referralReason !== undefined) row.referral_reason = data.referralReason ?? null;
  if (data.referralFacilityId !== undefined)
    row.referral_facility_id = data.referralFacilityId ?? null;
  if (data.notes !== undefined) row.notes = data.notes ?? null;

  return row;
}

export function mapReferralToRow(
  data: CreateReferral,
  server: { fromFacilityId: string; referredBy: string }
): Insertable<DB["referrals"]> {
  const row: Insertable<DB["referrals"]> = {
    from_facility_id: server.fromFacilityId,
    referred_by: server.referredBy,
    patient_id: data.patientId,
    to_facility_id: data.toFacilityId,
    reason: data.reason,
    urgency: data.urgency,
    status: "PENDING",
  };

  return row;
}
