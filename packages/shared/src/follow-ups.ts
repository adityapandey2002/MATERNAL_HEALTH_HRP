import { getDueVisits, isVisitOverdue } from "./rules.js";
import type { Patient } from "./types.js";

/**
 * Tests and checks expected at each ANC contact, following the Indian
 * government ANC schedule (8 contacts under the 2016 guidelines).
 *
 * The block-level team owns follow-up: they see which contact is due, what
 * tests are outstanding, and whether the ANM has recorded the visit.
 */
export const ANC_TESTS_BY_VISIT: Record<number, string[]> = {
  1: [
    "Hb",
    "Blood group & Rh",
    "Blood sugar",
    "Urine albumin & sugar",
    "HIV",
    "VDRL",
    "HBsAg",
    "BP & weight",
  ],
  2: ["Hb", "Urine albumin & sugar", "BP & weight", "Anomaly scan (18–20 weeks)"],
  3: ["Hb", "Blood sugar / GDM screen", "Urine albumin & sugar", "BP & weight", "Td booster"],
  4: ["Hb", "Urine albumin & sugar", "BP & weight", "Fetal presentation"],
  5: ["BP & weight", "Urine albumin & sugar", "Fetal heart rate"],
  6: ["BP & weight", "Urine albumin & sugar", "Fetal heart rate"],
  7: ["BP & weight", "Urine albumin & sugar", "Fetal heart rate"],
  8: ["BP & weight", "Urine albumin & sugar", "Fetal heart rate"],
};

export type FollowUpStatus = "OVERDUE" | "DUE" | "UPCOMING";

export interface FollowUpItem {
  visitNumber: number;
  dueDate: Date;
  windowStart: Date;
  windowEnd: Date;
  status: FollowUpStatus;
  tests: string[];
}

/**
 * The next ANC contacts for a woman, with the tests each contact expects.
 *
 * `completedVisits` is the number of visits the ANM has already recorded, so
 * the plan always starts at the next contact. Returns an empty plan when the
 * LMP is unknown — we do not guess dates.
 */
export function getFollowUpPlan(
  patient: Pick<Patient, "lmp">,
  completedVisits: number,
  limit = 3
): FollowUpItem[] {
  const today = new Date();
  const lmp = patient.lmp ? new Date(patient.lmp) : null;
  if (!lmp || Number.isNaN(lmp.getTime())) return [];

  return getDueVisits(lmp, Math.max(0, completedVisits))
    .map((visit) => {
      let status: FollowUpStatus = "UPCOMING";
      if (isVisitOverdue(visit)) status = "OVERDUE";
      else if (today >= visit.windowStart) status = "DUE";

      return {
        ...visit,
        status,
        tests: ANC_TESTS_BY_VISIT[visit.visitNumber] ?? [],
      };
    })
    .slice(0, Math.max(1, limit));
}
