import { z } from "zod";
import { HrpReason } from "./hrp-reasons.js";

export const FacilityLevel = z.enum([
  "VILLAGE",
  "HSC",
  "HWC",
  "PHC",
  "CHC",
  "BLOCK",
  "DISTRICT",
  "STATE",
]);
export const UserRole = z.enum(["ANM", "CHO", "BHM", "DHS", "HELPDESK"]);

export const NodalLevel = z.enum(["BLOCK", "DISTRICT"]);
export type NodalLevel = "BLOCK" | "DISTRICT";

/**
 * HRP Complication dropdown — exactly 9 values, in this exact sequence.
 * No additional values, no reordering.
 */
export const HrpComplication = z.enum([
  "ANEMIA",
  "PIH",
  "GDM",
  "SHORT_STATURE",
  "PRE_LSCS",
  "MULTI_GRAVIDA",
  "TWINS_MULTIPLE_PREGNANCY",
  "TEENAGE_PREGNANCY",
  "EDEMA",
]);
export type HrpComplication =
  | "ANEMIA"
  | "PIH"
  | "GDM"
  | "SHORT_STATURE"
  | "PRE_LSCS"
  | "MULTI_GRAVIDA"
  | "TWINS_MULTIPLE_PREGNANCY"
  | "TEENAGE_PREGNANCY"
  | "EDEMA";

export const RiskLevel = z.enum(["GREEN", "AMBER", "RED"]);

export const HrpFollowUpStatus = z.enum(["COMPLETE", "PENDING", "NOT_REACHABLE"]);
export type HrpFollowUpStatus = "COMPLETE" | "PENDING" | "NOT_REACHABLE";

export const HrpFollowUpTrack = z.enum(["IMMEDIATE_7_DAYS", "PMSMA_SESSION", "VHSND_COMMUNITY"]);
export type HrpFollowUpTrack = "IMMEDIATE_7_DAYS" | "PMSMA_SESSION" | "VHSND_COMMUNITY";

/**
 * Date field that accepts a Date (in-process) or an ISO date string (JSON
 * over the wire). JSON has no date type, so a request body always carries
 * dates as strings; validating with `z.date()` alone would reject every
 * legitimate request.
 */
export const DateInput = z.union([z.date(), z.string().min(1)]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
    return z.NEVER;
  }
  return date;
});

/**
 * Boolean field that accepts a real boolean or the string form used in query
 * parameters. `z.coerce.boolean()` would turn the string "false" into true.
 */
export const BooleanInput = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => (typeof value === "boolean" ? value : value === "true" || value === "1"));

export const DangerSign = z.enum([
  "HYPERTENSION",
  "GESTATIONAL_DIABETES",
  "SEVERE_ANEMIA",
  "VAGINAL_BLEEDING",
  "REDUCED_FETAL_MOVEMENT",
  "SEVERE_HEADACHE",
  "VISION_DISTURBANCE",
  "EPILEPSY",
]);

export const FacilitySchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  level: FacilityLevel,
  parentId: z.string().uuid().nullable(),
  path: z.string(), // materialized path: INDIA.GUJARAT.AHMEDABAD.DASKROI.CHC_BAREJA
  state: z.string().min(1),
  district: z.string().min(1),
  block: z.string().min(1),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().min(1),
  /** Login email. Only staff accounts provisioned by a nodal officer set one. */
  email: z.string().nullable().optional(),
  name: z.string().min(1),
  phone: z.string().min(10),
  role: UserRole,
  facilityId: z.string().uuid(),
  language: z.string().default("hi"),
  isActive: z.boolean().default(true),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const PatientSchema = z.object({
  id: z.string().uuid(),
  abhaId: z.string().nullable().optional(), // 14-digit ABHA, nullable for v1
  facilityId: z.string().uuid(),
  registeredBy: z.string().uuid(), // ANM user ID
  anmName: z.string().nullable().optional(), // joined from users for block-level views
  name: z.string().min(1),
  age: z.number().int().min(15).max(55),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  hrpReason: HrpReason.nullable().optional(), // why this pregnancy is high-risk
  hrpComplication: HrpComplication.nullable().optional(), // HRP complication dropdown (8 values)
  ashaName: z.string().nullable().optional(),
  ashaPhone: z.string().nullable().optional(),
  referred: z.boolean().default(false), // referred to a higher facility at registration
  isHrp: z.boolean().default(false), // marked as high-risk pregnancy
  // Automated follow-up scheduling (no manual toggle — server-calculated)
  followUpTrack: HrpFollowUpTrack.nullable().optional(),
  followUpScheduledDate: DateInput.nullable().optional(),
  followUpStatus: HrpFollowUpStatus.default("PENDING"),
  lmp: DateInput.nullable().optional(), // Last Menstrual Period
  edd: DateInput.nullable().optional(), // Expected Date of Delivery
  gravida: z.number().int().min(0).default(0),
  para: z.number().int().min(0).default(0),
  abortions: z.number().int().min(0).default(0),
  riskFactors: z.array(DangerSign).default([]),
  riskLevel: RiskLevel.default("GREEN"),
  riskScore: z.number().default(0),
  isHighRisk: z.boolean().default(false),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const VisitSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  facilityId: z.string().uuid(),
  conductedBy: z.string().uuid(),
  visitNumber: z.number().int().min(1),
  gestationalWeeks: z.number().min(0).max(45),
  visitDate: DateInput,
  // Vitals
  bpSystolic: z.number().int().nullable().optional(),
  bpDiastolic: z.number().int().nullable().optional(),
  hb: z.number().nullable().optional(), // Hemoglobin g/dL
  weight: z.number().nullable().optional(), // kg
  fundalHeight: z.number().nullable().optional(), // cm
  fetalHeartRate: z.number().int().nullable().optional(),
  // Danger signs observed this visit
  dangerSigns: z.array(DangerSign).default([]),
  // Supplements given
  ifaGiven: z.boolean().default(false),
  calciumGiven: z.boolean().default(false),
  albendazoleGiven: z.boolean().default(false),
  // Referral
  referred: z.boolean().default(false),
  referralReason: z.string().nullable().optional(),
  referralFacilityId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const ReferralSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  fromFacilityId: z.string().uuid(),
  toFacilityId: z.string().uuid(),
  referredBy: z.string().uuid(),
  reason: z.string(),
  urgency: RiskLevel,
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"]).default("PENDING"),
  respondedAt: DateInput.nullable(),
  respondedBy: z.string().uuid().nullable(),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const SyncQueueSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  entityType: z.enum(["PATIENT", "VISIT", "REFERRAL"]),
  entityId: z.string().uuid(),
  operation: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payload: z.record(z.unknown()),
  status: z.enum(["PENDING", "SYNCING", "COMPLETED", "FAILED", "CONFLICT"]).default("PENDING"),
  retryCount: z.number().int().default(0),
  lastError: z.string().nullable(),
  createdAt: DateInput,
  updatedAt: DateInput,
});

export const SupervisionAlertSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  type: z.enum(["ANM_OFFLINE", "VISIT_OVERDUE", "SYNC_FAILED", "HIGH_RISK_UNATTENDED"]),
  severity: RiskLevel,
  message: z.string(),
  relatedEntityId: z.string().uuid().nullable(),
  acknowledged: z.boolean().default(false),
  acknowledgedBy: z.string().uuid().nullable(),
  acknowledgedAt: DateInput.nullable(),
  createdAt: DateInput,
});

export type Facility = z.infer<typeof FacilitySchema>;
export type User = z.infer<typeof UserSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type Visit = z.infer<typeof VisitSchema>;
export type Referral = z.infer<typeof ReferralSchema>;
export type SyncQueue = z.infer<typeof SyncQueueSchema>;
export type SupervisionAlert = z.infer<typeof SupervisionAlertSchema>;
export type FacilityLevel = z.infer<typeof FacilityLevel>;
export type UserRole = z.infer<typeof UserRole>;
export type RiskLevel = z.infer<typeof RiskLevel>;
export type DangerSign = z.infer<typeof DangerSign>;
