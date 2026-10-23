import { describe, expect, it } from "vitest";
import {
  CreatePatientSchema,
  CreateReferralSchema,
  CreateVisitSchema,
  LoginSchema,
  PaginationSchema,
  PatientFilterSchema,
  ReferralFilterSchema,
  SupervisionFilterSchema,
  SyncPatientSchema,
  SyncPayloadSchema,
  SyncPullQuerySchema,
  SyncReferralSchema,
  SyncVisitSchema,
  UpdatePatientSchema,
  UpdateVisitSchema,
  VisitFilterSchema,
  apiSchemas,
} from "./schemas.js";

const patient = {
  name: "Asha Patel",
  age: 24,
  lmp: "2026-01-01",
};

const visit = {
  patientId: "11111111-1111-4111-8111-111111111111",
  visitNumber: 1,
  gestationalWeeks: 12,
  visitDate: "2026-02-01",
};

const referral = {
  patientId: "11111111-1111-4111-8111-111111111111",
  toFacilityId: "22222222-2222-4222-8222-222222222222",
  reason: "Severe anaemia",
  urgency: "RED",
};

describe("CreatePatientSchema", () => {
  it("accepts a client payload with an ISO LMP", () => {
    const parsed = CreatePatientSchema.parse(patient);
    expect(parsed.lmp).toBeInstanceOf(Date);
  });

  it("strips server-derived fields rather than trusting the client", () => {
    const parsed = CreatePatientSchema.parse({
      ...patient,
      facilityId: "22222222-2222-4222-8222-222222222222",
      registeredBy: "33333333-3333-4333-8333-333333333333",
      anmName: "Spoofed ANM",
      riskLevel: "RED",
      riskScore: 65,
      isHighRisk: true,
    });

    expect(parsed).not.toHaveProperty("facilityId");
    expect(parsed).not.toHaveProperty("registeredBy");
    expect(parsed).not.toHaveProperty("anmName");
    expect(parsed).not.toHaveProperty("riskLevel");
    expect(parsed).not.toHaveProperty("riskScore");
    expect(parsed).not.toHaveProperty("isHighRisk");
  });

  it("keeps the ANM-recorded HRP details", () => {
    const parsed = CreatePatientSchema.parse({
      ...patient,
      hrpReason: "SEVERE_ANEMIA",
      ashaName: "Sunita Devi",
      ashaPhone: "9988776655",
      referred: true,
    });

    expect(parsed.hrpReason).toBe("SEVERE_ANEMIA");
    expect(parsed.ashaName).toBe("Sunita Devi");
    expect(parsed.ashaPhone).toBe("9988776655");
    expect(parsed.referred).toBe(true);
  });

  it("requires a name", () => {
    expect(CreatePatientSchema.safeParse({ ...patient, name: "" }).success).toBe(false);
  });
});

describe("UpdatePatientSchema", () => {
  it("accepts a partial payload", () => {
    expect(UpdatePatientSchema.parse({ name: "Asha P." })).toEqual({ name: "Asha P." });
  });

  it("rejects an invalid field when present", () => {
    expect(UpdatePatientSchema.safeParse({ age: 12 }).success).toBe(false);
  });
});

describe("CreateVisitSchema", () => {
  it("accepts a client payload and parses the visit date", () => {
    const parsed = CreateVisitSchema.parse(visit);
    expect(parsed.visitDate).toBeInstanceOf(Date);
  });

  it("strips facilityId and conductedBy", () => {
    const parsed = CreateVisitSchema.parse({
      ...visit,
      facilityId: "22222222-2222-4222-8222-222222222222",
      conductedBy: "33333333-3333-4333-8333-333333333333",
    });
    expect(parsed).not.toHaveProperty("facilityId");
    expect(parsed).not.toHaveProperty("conductedBy");
  });

  it("rejects a visit number below 1", () => {
    expect(CreateVisitSchema.safeParse({ ...visit, visitNumber: 0 }).success).toBe(false);
  });
});

describe("UpdateVisitSchema", () => {
  it("accepts a partial payload", () => {
    expect(UpdateVisitSchema.parse({ notes: "Improved" })).toEqual({ notes: "Improved" });
  });
});

describe("CreateReferralSchema", () => {
  it("accepts a client payload", () => {
    const parsed = CreateReferralSchema.parse(referral);
    expect(parsed.toFacilityId).toBe(referral.toFacilityId);
  });

  it("strips fromFacilityId, referredBy and status", () => {
    const parsed = CreateReferralSchema.parse({
      ...referral,
      fromFacilityId: "33333333-3333-4333-8333-333333333333",
      referredBy: "44444444-4444-4444-8444-444444444444",
      status: "ACCEPTED",
    });
    expect(parsed).not.toHaveProperty("fromFacilityId");
    expect(parsed).not.toHaveProperty("referredBy");
    expect(parsed).not.toHaveProperty("status");
  });

  it("requires a known urgency", () => {
    expect(CreateReferralSchema.safeParse({ ...referral, urgency: "SOON" }).success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("accepts a valid login", () => {
    expect(LoginSchema.parse({ employeeId: "ANM001", password: "password123" })).toEqual({
      employeeId: "ANM001",
      password: "password123",
    });
  });

  it("rejects a short password", () => {
    expect(LoginSchema.safeParse({ employeeId: "ANM001", password: "123" }).success).toBe(false);
  });
});

describe("PaginationSchema", () => {
  it("applies defaults", () => {
    expect(PaginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("coerces query-string numbers", () => {
    expect(PaginationSchema.parse({ page: "3", limit: "50" })).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it("caps the page size at 100", () => {
    expect(PaginationSchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects an unknown sort order", () => {
    expect(PaginationSchema.safeParse({ sortOrder: "sideways" }).success).toBe(false);
  });
});

describe("PatientFilterSchema", () => {
  it("parses the isHighRisk string flag without coercing 'false' to true", () => {
    expect(PatientFilterSchema.parse({ isHighRisk: "false" }).isHighRisk).toBe(false);
    expect(PatientFilterSchema.parse({ isHighRisk: "true" }).isHighRisk).toBe(true);
  });

  it("rejects an unknown risk level", () => {
    expect(PatientFilterSchema.safeParse({ riskLevel: "BLUE" }).success).toBe(false);
  });

  it("accepts block-level filters by ANM name and HRP reason", () => {
    const parsed = PatientFilterSchema.parse({
      anmName: "Sunita",
      hrpReason: "PREVIOUS_C_SECTION",
    });

    expect(parsed.anmName).toBe("Sunita");
    expect(parsed.hrpReason).toBe("PREVIOUS_C_SECTION");
  });

  it("rejects an unknown HRP reason filter", () => {
    expect(PatientFilterSchema.safeParse({ hrpReason: "BAD_LUCK" }).success).toBe(false);
  });

  it("coerces gestational week bounds", () => {
    const parsed = PatientFilterSchema.parse({ gestationalWeeksMin: "28" });
    expect(parsed.gestationalWeeksMin).toBe(28);
  });
});

describe("VisitFilterSchema", () => {
  it("parses date bounds into Date objects", () => {
    const parsed = VisitFilterSchema.parse({ dateFrom: "2026-01-01", dateTo: "2026-02-01" });
    expect(parsed.dateFrom).toBeInstanceOf(Date);
    expect(parsed.dateTo).toBeInstanceOf(Date);
  });
});

describe("SupervisionFilterSchema", () => {
  it("parses the acknowledged flag", () => {
    expect(SupervisionFilterSchema.parse({ acknowledged: "1" }).acknowledged).toBe(true);
    expect(SupervisionFilterSchema.parse({ acknowledged: "0" }).acknowledged).toBe(false);
  });
});

describe("ReferralFilterSchema", () => {
  it("accepts a known status", () => {
    expect(ReferralFilterSchema.parse({ status: "PENDING" }).status).toBe("PENDING");
  });

  it("rejects an unknown status", () => {
    expect(ReferralFilterSchema.safeParse({ status: "LOST" }).success).toBe(false);
  });
});

describe("SyncPayloadSchema", () => {
  it("accepts batched entities and a timestamp", () => {
    const parsed = SyncPayloadSchema.parse({
      patients: [patient],
      visits: [visit],
      referrals: [referral],
      lastSyncTimestamp: "2026-02-01T00:00:00.000Z",
    });
    expect(parsed.patients).toHaveLength(1);
    expect(parsed.lastSyncTimestamp).toBeInstanceOf(Date);
  });

  it("validates every entity in the batch", () => {
    expect(SyncPayloadSchema.safeParse({ patients: [{ ...patient, age: 10 }] }).success).toBe(
      false
    );
  });

  it("caps each entity batch at 100", () => {
    const patients = Array.from({ length: 101 }, (_, index) => ({
      ...patient,
      name: `Patient ${index}`,
    }));

    expect(SyncPayloadSchema.safeParse({ patients }).success).toBe(false);
    expect(SyncPayloadSchema.safeParse({ patients: patients.slice(0, 100) }).success).toBe(true);
  });
});

describe("sync entity schemas", () => {
  it("accepts client ids and server versions while stripping server-owned fields", () => {
    const patientId = "11111111-1111-4111-8111-111111111111";
    const updatedAt = "2026-02-01T00:00:00.000Z";

    const parsedPatient = SyncPatientSchema.parse({
      ...patient,
      id: patientId,
      updatedAt,
      facilityId: "22222222-2222-4222-8222-222222222222",
      registeredBy: "33333333-3333-4333-8333-333333333333",
    });
    expect(parsedPatient.id).toBe(patientId);
    expect(parsedPatient.updatedAt).toBeInstanceOf(Date);
    expect(parsedPatient).not.toHaveProperty("facilityId");
    expect(parsedPatient).not.toHaveProperty("registeredBy");

    const parsedVisit = SyncVisitSchema.parse({
      ...visit,
      id: patientId,
      updatedAt,
      facilityId: "22222222-2222-4222-8222-222222222222",
      conductedBy: "33333333-3333-4333-8333-333333333333",
    });
    expect(parsedVisit.id).toBe(patientId);
    expect(parsedVisit).not.toHaveProperty("facilityId");
    expect(parsedVisit).not.toHaveProperty("conductedBy");

    const parsedReferral = SyncReferralSchema.parse({
      ...referral,
      id: patientId,
      updatedAt,
      fromFacilityId: "22222222-2222-4222-8222-222222222222",
      referredBy: "33333333-3333-4333-8333-333333333333",
      status: "COMPLETED",
    });
    expect(parsedReferral.id).toBe(patientId);
    expect(parsedReferral).not.toHaveProperty("fromFacilityId");
    expect(parsedReferral).not.toHaveProperty("referredBy");
    expect(parsedReferral).not.toHaveProperty("status");
  });
});

describe("SyncPullQuerySchema", () => {
  it("parses a since cursor", () => {
    const parsed = SyncPullQuerySchema.parse({ since: "2026-02-01T00:00:00.000Z" });
    expect(parsed.since).toBeInstanceOf(Date);
  });

  it("rejects invalid or empty cursors", () => {
    expect(SyncPullQuerySchema.safeParse({ since: "not-a-date" }).success).toBe(false);
    expect(SyncPullQuerySchema.safeParse({ since: "" }).success).toBe(false);
  });
});

describe("apiSchemas", () => {
  it("exposes the schemas used by the routes", () => {
    expect(apiSchemas.patient.create).toBe(CreatePatientSchema);
    expect(apiSchemas.visit.create).toBe(CreateVisitSchema);
    expect(apiSchemas.auth.login).toBe(LoginSchema);
    expect(apiSchemas.pagination).toBe(PaginationSchema);
  });
});
