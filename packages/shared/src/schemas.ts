import { z } from 'zod';
import {
  FacilitySchema,
  UserSchema,
  PatientSchema,
  VisitSchema,
  ReferralSchema,
  SyncQueueSchema,
  SupervisionAlertSchema,
  DangerSign,
  RiskLevel,
  FacilityLevel,
  UserRole,
} from './types.js';

export const CreatePatientSchema = PatientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  riskLevel: true,
  riskScore: true,
  isHighRisk: true,
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

export const CreateVisitSchema = VisitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateVisitSchema = CreateVisitSchema.partial();

export const CreateReferralSchema = ReferralSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  respondedAt: true,
  respondedBy: true,
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
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const PatientFilterSchema = z.object({
  facilityId: z.string().uuid().optional(),
  riskLevel: RiskLevel.optional(),
  isHighRisk: z.coerce.boolean().optional(),
  search: z.string().optional(),
  gestationalWeeksMin: z.coerce.number().optional(),
  gestationalWeeksMax: z.coerce.number().optional(),
});

export const VisitFilterSchema = z.object({
  patientId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  conductedBy: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const SupervisionFilterSchema = z.object({
  facilityId: z.string().uuid().optional(),
  type: SupervisionAlertSchema.shape.type.optional(),
  severity: RiskLevel.optional(),
  acknowledged: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const SyncPayloadSchema = z.object({
  patients: z.array(CreatePatientSchema).optional(),
  visits: z.array(CreateVisitSchema).optional(),
  referrals: z.array(CreateReferralSchema).optional(),
  lastSyncTimestamp: z.coerce.date().optional(),
});

export const SyncResponseSchema = z.object({
  patients: z.array(PatientSchema).optional(),
  visits: z.array(VisitSchema).optional(),
  referrals: z.array(ReferralSchema).optional(),
  serverTimestamp: z.date(),
  conflicts: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
    serverVersion: z.unknown(),
    clientVersion: z.unknown(),
  })).optional(),
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
export type SyncPayload = z.infer<typeof SyncPayloadSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

export const apiSchemas = {
  patient: { create: CreatePatientSchema, update: UpdatePatientSchema, filter: PatientFilterSchema },
  visit: { create: CreateVisitSchema, update: UpdateVisitSchema, filter: VisitFilterSchema },
  referral: { create: CreateReferralSchema },
  auth: { login: LoginSchema, refresh: RefreshTokenSchema },
  pagination: PaginationSchema,
  supervision: { filter: SupervisionFilterSchema },
  sync: { payload: SyncPayloadSchema, response: SyncResponseSchema },
} as const;