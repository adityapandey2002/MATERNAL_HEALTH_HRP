import { z } from "zod";
import { HrpReason } from "./hrp-reasons.js";
import {
  BooleanInput,
  DangerSign,
  DateInput,
  FacilityLevel,
  FacilitySchema,
  PatientSchema,
  ReferralSchema,
  RiskLevel,
  SupervisionAlertSchema,
  SyncQueueSchema,
  UserRole,
  UserSchema,
  VisitSchema,
} from "./types.js";

/**
 * Create payloads.
 *
 * `facility_id` and the acting user are derived from the access token on the
 * server, so they are not part of the client-supplied contract. Accepting
 * them would let a client record data against another facility.
 */
export const CreatePatientSchema = PatientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  riskLevel: true,
  riskScore: true,
  isHighRisk: true,
  facilityId: true,
  registeredBy: true,
  anmName: true,
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

export const CreateVisitSchema = VisitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  facilityId: true,
  conductedBy: true,
});

export const UpdateVisitSchema = CreateVisitSchema.partial();

export const CreateReferralSchema = ReferralSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  respondedAt: true,
  respondedBy: true,
  fromFacilityId: true,
  referredBy: true,
});

export const LoginSchema = z.object({
  employeeId: z.string().min(1),
  password: z.string().min(6),
  fcmToken: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const PatientFilterSchema = z.object({
  facilityId: z.string().uuid().optional(),
  registeredBy: z.string().uuid().optional(),
  anmName: z.string().optional(),
  hrpReason: HrpReason.optional(),
  riskLevel: RiskLevel.optional(),
  isHighRisk: BooleanInput.optional(),
  search: z.string().optional(),
  gestationalWeeksMin: z.coerce.number().optional(),
  gestationalWeeksMax: z.coerce.number().optional(),
});

export const VisitFilterSchema = z.object({
  patientId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  conductedBy: z.string().uuid().optional(),
  dateFrom: DateInput.optional(),
  dateTo: DateInput.optional(),
});

export const SupervisionFilterSchema = z.object({
  facilityId: z.string().uuid().optional(),
  type: SupervisionAlertSchema.shape.type.optional(),
  severity: RiskLevel.optional(),
  acknowledged: BooleanInput.optional(),
  dateFrom: DateInput.optional(),
  dateTo: DateInput.optional(),
});

export const ReferralFilterSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMPLETED"]).optional(),
  patientId: z.string().uuid().optional(),
  fromFacilityId: z.string().uuid().optional(),
  toFacilityId: z.string().uuid().optional(),
});

export const SyncPatientSchema = CreatePatientSchema.extend({
  id: z.string().uuid().optional(),
  updatedAt: DateInput.optional(),
});

export const SyncVisitSchema = CreateVisitSchema.extend({
  id: z.string().uuid().optional(),
  updatedAt: DateInput.optional(),
});

export const SyncReferralSchema = CreateReferralSchema.extend({
  id: z.string().uuid().optional(),
  updatedAt: DateInput.optional(),
});

export const SyncPayloadSchema = z.object({
  patients: z.array(SyncPatientSchema).max(100).optional(),
  visits: z.array(SyncVisitSchema).max(100).optional(),
  referrals: z.array(SyncReferralSchema).max(100).optional(),
  lastSyncTimestamp: DateInput.optional(),
});

export const SyncPullQuerySchema = z.object({
  since: DateInput.optional(),
});

export const SyncResponseSchema = z.object({
  patients: z.array(PatientSchema).optional(),
  visits: z.array(VisitSchema).optional(),
  referrals: z.array(ReferralSchema).optional(),
  serverTimestamp: z.date(),
  conflicts: z
    .array(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        serverVersion: z.unknown(),
        clientVersion: z.unknown(),
      })
    )
    .optional(),
});

export type CreatePatient = z.infer<typeof CreatePatientSchema>;
export type UpdatePatient = z.infer<typeof UpdatePatientSchema>;
export type CreateVisit = z.infer<typeof CreateVisitSchema>;
export type UpdateVisit = z.infer<typeof UpdateVisitSchema>;
export type CreateReferral = z.infer<typeof CreateReferralSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type PatientFilter = z.infer<typeof PatientFilterSchema>;
export type VisitFilter = z.infer<typeof VisitFilterSchema>;
export type SupervisionFilter = z.infer<typeof SupervisionFilterSchema>;
export type ReferralFilter = z.infer<typeof ReferralFilterSchema>;
export type SyncPatient = z.infer<typeof SyncPatientSchema>;
export type SyncVisit = z.infer<typeof SyncVisitSchema>;
export type SyncReferral = z.infer<typeof SyncReferralSchema>;
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

export const apiSchemas = {
  patient: {
    create: CreatePatientSchema,
    update: UpdatePatientSchema,
    filter: PatientFilterSchema,
  },
  visit: { create: CreateVisitSchema, update: UpdateVisitSchema, filter: VisitFilterSchema },
  referral: { create: CreateReferralSchema, filter: ReferralFilterSchema },
  auth: { login: LoginSchema, refresh: RefreshTokenSchema },
  pagination: PaginationSchema,
  supervision: { filter: SupervisionFilterSchema },
  sync: { payload: SyncPayloadSchema, response: SyncResponseSchema, pull: SyncPullQuerySchema },
} as const;
