import type { Patient, RiskLevel, Visit } from "@hrp/shared";
import { calculateRiskScore } from "@hrp/shared/rules";
import { db } from "../db/client.js";
import { toJson } from "../lib/mappers.js";
import { serializePatient, serializeVisit } from "../lib/serializers.js";

/**
 * Recomputes a patient's risk level from their recorded risk factors plus the
 * danger signs observed at their most recent visit, and persists the result.
 *
 * The server is the system of record for clinical risk, so this must run on
 * every write that can change a patient's clinical picture. The offline-first
 * client may compute a provisional score, but it cannot be authoritative.
 */
export async function recalculatePatientRisk(patientId: string): Promise<RiskLevel> {
  const patientRow = await db
    .selectFrom("patients")
    .selectAll()
    .where("id", "=", patientId)
    .executeTakeFirstOrThrow();

  const latestVisitRow = await db
    .selectFrom("visits")
    .selectAll()
    .where("patient_id", "=", patientId)
    .orderBy("visit_number", "desc")
    .limit(1)
    .executeTakeFirst();

  const patient = serializePatient(patientRow);
  const visit = latestVisitRow ? serializeVisit(latestVisitRow) : null;

  const recordedFactors = patient.riskFactors ?? [];
  const visitSigns = visit?.dangerSigns ?? [];
  const mergedFactors = Array.from(new Set([...recordedFactors, ...visitSigns]));

  const { score, level } = calculateRiskScore({ ...patient, riskFactors: mergedFactors }, visit);

  await db
    .updateTable("patients")
    .set({
      risk_factors: toJson(mergedFactors),
      risk_score: score,
      risk_level: level,
      is_high_risk: level !== "GREEN",
      updated_at: new Date(),
    })
    .where("id", "=", patientId)
    .execute();

  return level;
}

/**
 * Scores a patient record that has not been persisted yet. Used when a new
 * patient is registered so the initial risk level reflects their history.
 */
export function scoreUnregisteredPatient(input: {
  name: string;
  age: number;
  riskFactors: Patient["riskFactors"];
  hrpReason?: Patient["hrpReason"];
}): { score: number; level: RiskLevel } {
  const patient: Patient = {
    id: "",
    abhaId: null,
    facilityId: "",
    registeredBy: "",
    name: input.name,
    age: input.age,
    phone: null,
    address: null,
    hrpReason: input.hrpReason ?? null,
    ashaName: null,
    ashaPhone: null,
    referred: false,
    lmp: null,
    edd: null,
    gravida: 0,
    para: 0,
    abortions: 0,
    riskFactors: input.riskFactors,
    riskLevel: "GREEN",
    riskScore: 0,
    isHighRisk: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { score, level } = calculateRiskScore(patient, null);
  return { score, level };
}
