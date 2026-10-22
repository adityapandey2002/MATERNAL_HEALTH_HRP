import { z } from "zod";

/**
 * Reasons an ANM records when registering a high-risk pregnancy.
 *
 * This is the single source of truth for the dropdown: edit this list and both
 * the picker and the risk weighting update. Each reason carries a weight that
 * contributes to the risk score, so any registered HRP starts at AMBER or
 * above rather than being silently scored GREEN.
 */
export const HRP_REASON_VALUES = [
  "PREVIOUS_C_SECTION",
  "PREVIOUS_STILLBIRTH",
  "PREVIOUS_PREECLAMPSIA",
  "PREVIOUS_ECLAMPSIA",
  "BAD_OBSTETRIC_HISTORY",
  "HYPERTENSION",
  "GESTATIONAL_DIABETES",
  "SEVERE_ANEMIA",
  "MULTIPLE_PREGNANCY",
  "ELDERLY_PRIMIGRAVIDA",
  "TEENAGE_PREGNANCY",
  "SHORT_STATURE",
  "IVF_PREGNANCY",
  "RH_NEGATIVE",
  "THYROID_DISORDER",
  "EPILEPSY",
  "CARDIAC_DISEASE",
  "OTHER",
] as const;

export const HrpReason = z.enum(HRP_REASON_VALUES);
export type HrpReason = z.infer<typeof HrpReason>;

export interface HrpReasonOption {
  value: HrpReason;
  label: string;
  weight: number;
}

export const HRP_REASONS: HrpReasonOption[] = [
  { value: "PREVIOUS_C_SECTION", label: "Previous C-section", weight: 30 },
  { value: "PREVIOUS_STILLBIRTH", label: "Previous stillbirth / neonatal death", weight: 45 },
  { value: "PREVIOUS_PREECLAMPSIA", label: "Pre-eclampsia in a previous pregnancy", weight: 40 },
  { value: "PREVIOUS_ECLAMPSIA", label: "Eclampsia in a previous pregnancy", weight: 45 },
  {
    value: "BAD_OBSTETRIC_HISTORY",
    label: "Bad obstetric history (3+ abortions / 2+ losses)",
    weight: 40,
  },
  { value: "HYPERTENSION", label: "High blood pressure / hypertension", weight: 40 },
  { value: "GESTATIONAL_DIABETES", label: "Gestational diabetes", weight: 35 },
  { value: "SEVERE_ANEMIA", label: "Severe anaemia (Hb < 7 g/dL)", weight: 35 },
  { value: "MULTIPLE_PREGNANCY", label: "Twins or multiple pregnancy", weight: 35 },
  { value: "ELDERLY_PRIMIGRAVIDA", label: "First pregnancy at age 35+", weight: 30 },
  { value: "TEENAGE_PREGNANCY", label: "Teenage pregnancy (under 18)", weight: 30 },
  { value: "SHORT_STATURE", label: "Short stature (under 145 cm)", weight: 25 },
  { value: "IVF_PREGNANCY", label: "IVF / assisted conception", weight: 35 },
  { value: "RH_NEGATIVE", label: "Rh-negative blood group", weight: 30 },
  { value: "THYROID_DISORDER", label: "Thyroid disorder", weight: 30 },
  { value: "EPILEPSY", label: "Epilepsy / seizures", weight: 40 },
  { value: "CARDIAC_DISEASE", label: "Heart disease", weight: 50 },
  { value: "OTHER", label: "Other reason (recorded by ANM)", weight: 30 },
];

const BY_VALUE = new Map(HRP_REASONS.map((reason) => [reason.value, reason]));

export function getHrpReasonOption(
  value: HrpReason | null | undefined
): HrpReasonOption | undefined {
  return value ? BY_VALUE.get(value) : undefined;
}

export function getHrpReasonLabel(value: HrpReason | null | undefined): string {
  return getHrpReasonOption(value)?.label ?? "Not recorded";
}

export function getHrpReasonWeight(value: HrpReason | null | undefined): number {
  return getHrpReasonOption(value)?.weight ?? 0;
}
