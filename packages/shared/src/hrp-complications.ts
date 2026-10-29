import type { HrpReason } from "./hrp-reasons.js";
import type { HrpComplication } from "./types.js";

/**
 * The HRP complication dropdown shown on the intake form.
 *
 * This list is the single source of truth for the picker: order and wording
 * are fixed by the programme, so the label text here is what health workers
 * see on the device.
 */
export interface HrpComplicationOption {
  value: HrpComplication;
  label: string;
  /** Plain-language note that helps an ANM pick the right option. */
  hint: string;
}

export const HRP_COMPLICATIONS: HrpComplicationOption[] = [
  { value: "ANEMIA", label: "Anemia", hint: "Low haemoglobin recorded on the MCP card" },
  {
    value: "PIH",
    label: "PIH (Pregnancy-Induced Hypertension)",
    hint: "Raised blood pressure after 20 weeks",
  },
  {
    value: "GDM",
    label: "GDM (Gestational Diabetes Mellitus)",
    hint: "High blood sugar first seen in pregnancy",
  },
  { value: "SHORT_STATURE", label: "Short stature", hint: "Height under 145 cm" },
  { value: "PRE_LSCS", label: "Pre-LSCS", hint: "Previous caesarean section" },
  { value: "MULTI_GRAVIDA", label: "Multi gravida", hint: "Third or later pregnancy" },
  {
    value: "TWINS_MULTIPLE_PREGNANCY",
    label: "Twins / Multiple Pregnancy",
    hint: "More than one fetus on scan",
  },
  {
    value: "TEENAGE_PREGNANCY",
    label: "Teenage Pregnancy",
    hint: "Mother is under 18 years",
  },
  { value: "EDEMA", label: "Edema", hint: "Swelling of feet or face" },
];

const COMPLICATION_BY_VALUE = new Map<HrpComplication, HrpComplicationOption>(
  HRP_COMPLICATIONS.map((option) => [option.value, option])
);

export function getHrpComplicationOption(
  value: HrpComplication | null | undefined
): HrpComplicationOption | undefined {
  return value ? COMPLICATION_BY_VALUE.get(value) : undefined;
}

export function getHrpComplicationLabel(value: HrpComplication | null | undefined): string {
  return getHrpComplicationOption(value)?.label ?? "Not recorded";
}

/**
 * Maps the intake dropdown onto the risk-engine reason vocabulary.
 *
 * The server scores risk from `hrpReason`; without this bridge every new
 * registration would score GREEN even though the ANM recorded a complication.
 */
const REASON_BY_COMPLICATION: Record<HrpComplication, HrpReason> = {
  ANEMIA: "SEVERE_ANEMIA",
  PIH: "HYPERTENSION",
  GDM: "GESTATIONAL_DIABETES",
  SHORT_STATURE: "SHORT_STATURE",
  PRE_LSCS: "PREVIOUS_C_SECTION",
  MULTI_GRAVIDA: "OTHER",
  TWINS_MULTIPLE_PREGNANCY: "MULTIPLE_PREGNANCY",
  TEENAGE_PREGNANCY: "TEENAGE_PREGNANCY",
  EDEMA: "HYPERTENSION",
};

export function hrpReasonForComplication(
  value: HrpComplication | null | undefined
): HrpReason | null {
  return value ? REASON_BY_COMPLICATION[value] : null;
}
