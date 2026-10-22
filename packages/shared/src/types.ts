import { z } from "zod";

export const FacilityLevel = z.enum(["VILLAGE", "HWC", "PHC", "CHC", "DISTRICT", "STATE"]);

export const UserRole = z.enum(["ANM", "ASHA", "CHO", "MO", "DISTRICT_ADMIN", "STATE_ADMIN"]);

export const RiskLevel = z.enum(["GREEN", "AMBER", "RED"]);

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
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(10),
  role: UserRole,
  facilityId: z.string().uuid(),
  language: z.string().default("hi"),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PatientSchema = z.object({
  id: z.string().uuid(),
  abhaId: z.string().nullable(), // 14-digit ABHA, nullable for v1
  facilityId: z.string().uuid(),
  registeredBy: z.string().uuid(), // ANM user ID
  name: z.string().min(1),
  age: z.number().int().min(15).max(55),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  lmp: z.date().nullable(), // Last Menstrual Period
  edd: z.date().nullable(), // Expected Date of Delivery
  gravida: z.number().int().min(0).default(0),
  para: z.number().int().min(0).default(0),
  abortions: z.number().int().min(0).default(0),
  riskFactors: z.array(DangerSign).default([]),
  riskLevel: RiskLevel.default("GREEN"),
  riskScore: z.number().default(0),
  isHighRisk: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const VisitSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  facilityId: z.string().uuid(),
  conductedBy: z.string().uuid(),
  visitNumber: z.number().int().min(1),
  gestationalWeeks: z.number().min(0).max(45),
  visitDate: z.date(),
  // Vitals
  bpSystolic: z.number().int().nullable(),
  bpDiastolic: z.number().int().nullable(),
  hb: z.number().nullable(), // Hemoglobin g/dL
  weight: z.number().nullable(), // kg
  fundalHeight: z.number().nullable(), // cm
  fetalHeartRate: z.number().int().nullable(),
  // Danger signs observed this visit
  dangerSigns: z.array(DangerSign).default([]),
  // Supplements given
  ifaGiven: z.boolean().default(false),
  calciumGiven: z.boolean().default(false),
  albendazoleGiven: z.boolean().default(false),
  // Referral
  referred: z.boolean().default(false),
  referralReason: z.string().nullable(),
  referralFacilityId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
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
  respondedAt: z.date().nullable(),
  respondedBy: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SyncQueueSchema = z.object({
  id: z.string().uuid(),
  entityType: z.enum(["PATIENT", "VISIT", "REFERRAL"]),
  entityId: z.string().uuid(),
  operation: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payload: z.record(z.unknown()),
  status: z.enum(["PENDING", "SYNCING", "COMPLETED", "FAILED", "CONFLICT"]).default("PENDING"),
  retryCount: z.number().int().default(0),
  lastError: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
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
  acknowledgedAt: z.date().nullable(),
  createdAt: z.date(),
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
