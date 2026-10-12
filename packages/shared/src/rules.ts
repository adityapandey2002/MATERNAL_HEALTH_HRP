import { DangerSign, RiskLevel, Patient, Visit } from './types.js';

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
  { id: 'htn', dangerSign: 'HYPERTENSION', weight: 30, description: 'Hypertension / Pre-eclampsia' },
  { id: 'gdm', dangerSign: 'GESTATIONAL_DIABETES', weight: 25, description: 'Gestational Diabetes Mellitus' },
  { id: 'anemia', dangerSign: 'SEVERE_ANEMIA', weight: 20, description: 'Severe Anemia (Hb < 7 g/dL)' },
  { id: 'bleeding', dangerSign: 'VAGINAL_BLEEDING', weight: 35, description: 'Vaginal Bleeding' },
  { id: 'rfm', dangerSign: 'REDUCED_FETAL_MOVEMENT', weight: 30, description: 'Reduced Fetal Movement' },
  { id: 'headache', dangerSign: 'SEVERE_HEADACHE', weight: 15, description: 'Severe Headache' },
  { id: 'vision', dangerSign: 'VISION_DISTURBANCE', weight: 20, description: 'Vision Disturbance' },
  { id: 'epilepsy', dangerSign: 'EPILEPSY', weight: 25, description: 'Epilepsy / Seizures' },
];

export const DEFAULT_COMORBIDITY_RULES: ComorbidityRule[] = [
  { id: 'htn_gdm', signs: ['HYPERTENSION', 'GESTATIONAL_DIABETES'], multiplier: 1.5, description: 'HTN + GDM' },
  { id: 'htn_anemia', signs: ['HYPERTENSION', 'SEVERE_ANEMIA'], multiplier: 1.3, description: 'HTN + Severe Anemia' },
  { id: 'bleeding_rfm', signs: ['VAGINAL_BLEEDING', 'REDUCED_FETAL_MOVEMENT'], multiplier: 1.4, description: 'Bleeding + RFM' },
  { id: 'triple_threat', signs: ['HYPERTENSION', 'SEVERE_ANEMIA', 'GESTATIONAL_DIABETES'], multiplier: 1.6, description: 'HTN + Anemia + GDM' },
];

export const GESTATIONAL_AGE_RULES: GestationalAgeRule[] = [
  { weeksMin: 0, weeksMax: 12, multiplier: 0.8 },   // Early pregnancy - lower urgency
  { weeksMin: 13, weeksMax: 27, multiplier: 1.0 },  // Second trimester
  { weeksMin: 28, weeksMax: 36, multiplier: 1.3 },  // Third trimester - higher risk
  { weeksMin: 37, weeksMax: 45, multiplier: 1.5 },  // Term - imminent delivery risk
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
    if (rule.signs.every(s => allSigns.has(s))) {
      const baseWeight = rule.signs.reduce((sum, s) => {
        const r = rules.find(x => x.dangerSign === s);
        return sum + (r?.weight ?? 0);
      }, 0);
      score += Math.round(baseWeight * (rule.multiplier - 1));
      factors.push(rule.description);
    }
  }

  const gestationalWeeks = visit?.gestationalWeeks ?? calculateGestationalWeeks(patient.lmp);
  const gaRule = gaRules.find(r => gestationalWeeks >= r.weeksMin && gestationalWeeks <= r.weeksMax);
  if (gaRule) {
    score = Math.round(score * gaRule.multiplier);
    if (gaRule.multiplier !== 1.0) {
      factors.push(`Gestational age adjustment (${gestationalWeeks} weeks): ×${gaRule.multiplier}`);
    }
  }

  let level: RiskLevel = 'GREEN';
  if (score >= RISK_THRESHOLDS.RED.min) level = 'RED';
  else if (score >= RISK_THRESHOLDS.AMBER.min) level = 'AMBER';

  return { score, level, factors };
}

export function calculateGestationalWeeks(lmp: Date | null): number {
  if (!lmp) return 0;
  const today = new Date();
  const diff = today.getTime() - lmp.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24 * 7)));
}

export function getDueVisits(lmp: Date | null, completedVisits: number): { visitNumber: number; dueDate: Date; windowStart: Date; windowEnd: Date }[] {
  if (!lmp) return [];
  const edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000); // 40 weeks
  const schedule = [
    { num: 1, weeks: 12, window: 2 },   // 1st trimester
    { num: 2, weeks: 20, window: 2 },   // 2nd trimester
    { num: 3, weeks: 28, window: 2 },   // 3rd trimester start
    { num: 4, weeks: 32, window: 2 },
    { num: 5, weeks: 36, window: 1 },   // Weekly near term
    { num: 6, weeks: 37, window: 1 },
    { num: 7, weeks: 38, window: 1 },
    { num: 8, weeks: 39, window: 1 },
  ];
  return schedule
    .filter(s => s.num > completedVisits)
    .map(s => {
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
    case 'RED': return '#dc2626';
    case 'AMBER': return '#f59e0b';
    case 'GREEN': return '#16a34a';
  }
}

export function getUrgencyLabel(level: RiskLevel): string {
  switch (level) {
    case 'RED': return 'Immediate Referral';
    case 'AMBER': return 'Refer within 48 hours';
    case 'GREEN': return 'Routine Follow-up';
  }
}