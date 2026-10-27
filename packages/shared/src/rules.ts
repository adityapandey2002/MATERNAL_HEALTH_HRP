import { getHrpReasonOption } from "./hrp-reasons.js";
import type { DangerSign, Patient, RiskLevel, Visit } from "./types.js";

export interface RiskRule {
  id: string;
  dangerSign: DangerSign;
  weight: number;
  description: string;
}

export interface ComorbidityRule {
  id: string;
  signs: DangerSign[];
  multiplier: number;
  description: string;
}

export interface GestationalAgeRule {
  weeksMin: number;
  weeksMax: number;
  multiplier: number;
}

export const DEFAULT_RISK_RULES: RiskRule[] = [
  {
    id: "htn",
    dangerSign: "HYPERTENSION",
    weight: 30,
    description: "Hypertension / Pre-eclampsia",
  },
  {
    id: "gdm",
    dangerSign: "GESTATIONAL_DIABETES",
    weight: 25,
    description: "Gestational Diabetes Mellitus",
  },
  {
    id: "anemia",
    dangerSign: "SEVERE_ANEMIA",
    weight: 20,
    description: "Severe Anemia (Hb < 7 g/dL)",
  },
  { id: "bleeding", dangerSign: "VAGINAL_BLEEDING", weight: 35, description: "Vaginal Bleeding" },
  {
    id: "rfm",
    dangerSign: "REDUCED_FETAL_MOVEMENT",
    weight: 30,
    description: "Reduced Fetal Movement",
  },
  { id: "headache", dangerSign: "SEVERE_HEADACHE", weight: 15, description: "Severe Headache" },
  { id: "vision", dangerSign: "VISION_DISTURBANCE", weight: 20, description: "Vision Disturbance" },
  { id: "epilepsy", dangerSign: "EPILEPSY", weight: 25, description: "Epilepsy / Seizures" },
];

export const DEFAULT_COMORBIDITY_RULES: ComorbidityRule[] = [
  {
    id: "htn_gdm",
    signs: ["HYPERTENSION", "GESTATIONAL_DIABETES"],
    multiplier: 1.5,
    description: "HTN + GDM",
  },
  {
    id: "htn_anemia",
    signs: ["HYPERTENSION", "SEVERE_ANEMIA"],
    multiplier: 1.3,
    description: "HTN + Severe Anemia",
  },
  {
    id: "bleeding_rfm",
    signs: ["VAGINAL_BLEEDING", "REDUCED_FETAL_MOVEMENT"],
    multiplier: 1.4,
    description: "Bleeding + RFM",
  },
  {
    id: "triple_threat",
    signs: ["HYPERTENSION", "SEVERE_ANEMIA", "GESTATIONAL_DIABETES"],
    multiplier: 1.6,
    description: "HTN + Anemia + GDM",
  },
];

export const GESTATIONAL_AGE_RULES: GestationalAgeRule[] = [
  { weeksMin: 0, weeksMax: 12, multiplier: 0.8 }, // Early pregnancy - lower urgency
  { weeksMin: 13, weeksMax: 27, multiplier: 1.0 }, // Second trimester
  { weeksMin: 28, weeksMax: 36, multiplier: 1.3 }, // Third trimester - higher risk
  { weeksMin: 37, weeksMax: 45, multiplier: 1.5 }, // Term - imminent delivery risk
];

export const RISK_THRESHOLDS = {
  GREEN: { max: 29 },
  AMBER: { min: 30, max: 59 },
  RED: { min: 60 },
} as const;

export function calculateRiskScore(
  patient: Patient,
  visit: Visit | null,
  rules: RiskRule[] = DEFAULT_RISK_RULES,
  comorbidityRules: ComorbidityRule[] = DEFAULT_COMORBIDITY_RULES,
  gaRules: GestationalAgeRule[] = GESTATIONAL_AGE_RULES
): { score: number; level: RiskLevel; factors: string[] } {
  const allSigns = new Set([...patient.riskFactors, ...(visit?.dangerSigns ?? [])]);
  const factors: string[] = [];
  let score = 0;

  for (const rule of rules) {
    if (allSigns.has(rule.dangerSign)) {
      score += rule.weight;
      factors.push(rule.description);
    }
  }

  for (const rule of comorbidityRules) {
    if (rule.signs.every((s) => allSigns.has(s))) {
      const baseWeight = rule.signs.reduce((sum, s) => {
        const r = rules.find((x) => x.dangerSign === s);
        return sum + (r?.weight ?? 0);
      }, 0);
      score += Math.round(baseWeight * (rule.multiplier - 1));
      factors.push(rule.description);
    }
  }

  // The reason recorded at registration is what makes this an HRP. It is
  // scored separately from the danger signs so a woman with a known history
  // (previous C-section, stillbirth, cardiac disease) never scores GREEN just
  // because she has no current symptoms.
  const hrpReason = getHrpReasonOption(patient.hrpReason);
  if (hrpReason) {
    score += hrpReason.weight;
    factors.push(hrpReason.label);
  }

  // Gestational age is only used to adjust the score when it is actually
  // known. An unknown LMP must not be treated as "0 weeks pregnant": that
  // would apply the early-pregnancy multiplier and silently downgrade a
  // high-risk patient (e.g. hypertension + severe anemia, 65 -> 52, RED ->
  // AMBER). Understating risk is the dangerous direction to fail.
  const gestationalWeeks =
    visit?.gestationalWeeks ?? (patient.lmp ? calculateGestationalWeeks(patient.lmp) : null);

  if (gestationalWeeks !== null) {
    const gaRule = gaRules.find(
      (r) => gestationalWeeks >= r.weeksMin && gestationalWeeks <= r.weeksMax
    );
    if (gaRule) {
      score = Math.round(score * gaRule.multiplier);
      if (gaRule.multiplier !== 1.0) {
        factors.push(
          `Gestational age adjustment (${gestationalWeeks} weeks): ×${gaRule.multiplier}`
        );
      }
    }
  }

  let level: RiskLevel = "GREEN";
  if (score >= RISK_THRESHOLDS.RED.min) level = "RED";
  else if (score >= RISK_THRESHOLDS.AMBER.min) level = "AMBER";

  return { score, level, factors };
}

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_GESTATIONAL_WEEKS = 45;

export function calculateGestationalWeeks(lmp: Date | null, now: Date = new Date()): number {
  if (!lmp) return 0;
  const diff = now.getTime() - lmp.getTime();
  return Math.max(0, Math.round(diff / WEEK_MS));
}

export interface GestationSource {
  lmp?: string | Date | null;
  edd?: string | Date | null;
}

function asValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Gestational age in weeks, preferring LMP and falling back to the EDD. The
 * pages used to label "weeks until EDD" as GA, which understates gestation by
 * up to 40 weeks. Clamped to 0-45 so an overdue or malformed date never renders
 * a negative or impossible value.
 */
export function gestationalAgeWeeks(
  source: GestationSource,
  now: Date = new Date()
): number | null {
  const lmp = asValidDate(source.lmp);
  if (lmp) {
    return Math.min(MAX_GESTATIONAL_WEEKS, calculateGestationalWeeks(lmp, now));
  }

  const edd = asValidDate(source.edd);
  if (!edd) return null;

  const weeksUntilEdd = Math.round((edd.getTime() - now.getTime()) / WEEK_MS);
  return Math.min(MAX_GESTATIONAL_WEEKS, Math.max(0, 40 - weeksUntilEdd));
}

export function getDueVisits(
  lmp: Date | null,
  completedVisits: number
): { visitNumber: number; dueDate: Date; windowStart: Date; windowEnd: Date }[] {
  if (!lmp) return [];
  const schedule = [
    { num: 1, weeks: 12, window: 2 }, // 1st trimester
    { num: 2, weeks: 20, window: 2 }, // 2nd trimester
    { num: 3, weeks: 28, window: 2 }, // 3rd trimester start
    { num: 4, weeks: 32, window: 2 },
    { num: 5, weeks: 36, window: 1 }, // Weekly near term
    { num: 6, weeks: 37, window: 1 },
    { num: 7, weeks: 38, window: 1 },
    { num: 8, weeks: 39, window: 1 },
  ];
  return schedule
    .filter((s) => s.num > completedVisits)
    .map((s) => {
      const dueDate = new Date(lmp.getTime() + s.weeks * 7 * 24 * 60 * 60 * 1000);
      const windowDays = s.window * 7;
      return {
        visitNumber: s.num,
        dueDate,
        windowStart: new Date(dueDate.getTime() - windowDays * 24 * 60 * 60 * 1000),
        windowEnd: new Date(dueDate.getTime() + windowDays * 24 * 60 * 60 * 1000),
      };
    });
}

export function isVisitOverdue(visit: { dueDate: Date; windowEnd: Date }): boolean {
  return new Date() > visit.windowEnd;
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "RED":
      return "#dc2626";
    case "AMBER":
      return "#f59e0b";
    case "GREEN":
      return "#16a34a";
  }
}

export function getUrgencyLabel(level: RiskLevel): string {
  switch (level) {
    case "RED":
      return "Immediate Referral";
    case "AMBER":
      return "Refer within 48 hours";
    case "GREEN":
      return "Routine Follow-up";
  }
}
