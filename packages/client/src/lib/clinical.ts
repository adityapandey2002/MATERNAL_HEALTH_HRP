import { type Patient, type Visit, gestationalAgeWeeks } from "@hrp/shared";

/** Colour intent shared by vitals, badges and stat tiles. */
export type ClinicalTone = "red" | "amber" | "green" | "neutral";

const TONE_TEXT: Record<ClinicalTone, string> = {
  red: "text-triage-red",
  amber: "text-triage-amber",
  green: "text-triage-green",
  neutral: "text-ink",
};

export function toneTextClass(tone: ClinicalTone): string {
  return TONE_TEXT[tone];
}

/** Most recent ANC visit for each woman, keyed by patient id. */
export function latestVisitByPatient(visits: Visit[]): Map<string, Visit> {
  const latest = new Map<string, Visit>();
  for (const visit of visits) {
    const current = latest.get(visit.patientId);
    if (!current || new Date(visit.visitDate).getTime() > new Date(current.visitDate).getTime()) {
      latest.set(visit.patientId, visit);
    }
  }
  return latest;
}

/** "158/102", or an em dash when either reading is missing. */
export function formatBp(visit: Visit | undefined): string {
  if (!visit?.bpSystolic || !visit.bpDiastolic) return "—";
  return `${visit.bpSystolic}/${visit.bpDiastolic}`;
}

/**
 * Obstetric triage thresholds from the design system: systolic >= 160 or
 * diastolic >= 110 is severe, >= 140/90 is active monitoring.
 */
export function bpTone(visit: Visit | undefined): ClinicalTone {
  if (!visit?.bpSystolic || !visit.bpDiastolic) return "neutral";
  if (visit.bpSystolic >= 160 || visit.bpDiastolic >= 110) return "red";
  if (visit.bpSystolic >= 140 || visit.bpDiastolic >= 90) return "amber";
  return "green";
}

/** Haemoglobin thresholds: < 7 g/dL severe anaemia, 7-9.9 moderate. */
export function hbTone(hb: number | null | undefined): ClinicalTone {
  if (typeof hb !== "number") return "neutral";
  if (hb < 7) return "red";
  if (hb < 10) return "amber";
  return "green";
}

export function formatHb(visit: Visit | undefined): string {
  if (typeof visit?.hb !== "number") return "—";
  return visit.hb.toFixed(1);
}

/** Gestational age in whole weeks, or "Unknown" when LMP and EDD are both absent. */
export function gaLabel(patient: Patient): string {
  const weeks = gestationalAgeWeeks(patient);
  return weeks === null ? "Unknown" : `${weeks}w`;
}

/** Where the woman lives, falling back to her ASHA's village or an em dash. */
export function villageLabel(patient: Patient): string {
  return patient.address?.trim() || "—";
}

/** Human label for a raw danger-sign enum value. */
export function dangerSignLabel(sign: string): string {
  return sign
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
