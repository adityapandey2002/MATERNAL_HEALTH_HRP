import { describe, expect, it } from "vitest";
import {
  BooleanInput,
  DateInput,
  DeviceSchema,
  FacilityLevel,
  PatientSchema,
  RiskLevel,
  UserRole,
  VisitSchema,
  anemiaGradeFromHb,
  getPatientDisplayId,
  isFcmIndicated,
} from "./types.js";

describe("DateInput", () => {
  it("keeps a Date instance unchanged", () => {
    const value = new Date("2026-01-15T00:00:00.000Z");
    const parsed = DateInput.parse(value);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe(value.toISOString());
  });

  it("parses an ISO string from a JSON body", () => {
    const parsed = DateInput.parse("2026-03-01T10:30:00.000Z");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe("2026-03-01T10:30:00.000Z");
  });

  it("parses a plain date string (no time component)", () => {
    const parsed = DateInput.parse("2026-02-28");
    expect(parsed).toBeInstanceOf(Date);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(DateInput.safeParse("").success).toBe(false);
  });

  it("rejects an unparseable date", () => {
    const result = DateInput.safeParse("not-a-date");
    expect(result.success).toBe(false);
  });

  it("rejects non-string non-date values", () => {
    expect(DateInput.safeParse(12345).success).toBe(false);
    expect(DateInput.safeParse(null).success).toBe(false);
  });
});

describe("BooleanInput", () => {
  it("passes real booleans through", () => {
    expect(BooleanInput.parse(true)).toBe(true);
    expect(BooleanInput.parse(false)).toBe(false);
  });

  it("does not coerce the string 'false' to true", () => {
    expect(BooleanInput.parse("false")).toBe(false);
  });

  it("parses the other accepted string forms", () => {
    expect(BooleanInput.parse("true")).toBe(true);
    expect(BooleanInput.parse("1")).toBe(true);
    expect(BooleanInput.parse("0")).toBe(false);
  });

  it("rejects arbitrary strings and numbers", () => {
    expect(BooleanInput.safeParse("yes").success).toBe(false);
    expect(BooleanInput.safeParse("FALSE").success).toBe(false);
    expect(BooleanInput.safeParse(1).success).toBe(false);
  });
});

describe("enums", () => {
  it("accepts known facility levels and rejects others", () => {
    expect(FacilityLevel.parse("PHC")).toBe("PHC");
    expect(FacilityLevel.parse("HSC")).toBe("HSC");
    expect(FacilityLevel.parse("BLOCK")).toBe("BLOCK");
    expect(FacilityLevel.safeParse("CLINIC").success).toBe(false);
  });

  it("accepts the four login roles and rejects retired roles", () => {
    for (const role of ["ANM", "CHO", "BHM", "DHS"]) {
      expect(UserRole.parse(role)).toBe(role);
    }

    for (const retired of ["ASHA", "MO", "DISTRICT_ADMIN", "STATE_ADMIN"]) {
      expect(UserRole.safeParse(retired).success).toBe(false);
    }
  });

  it("accepts risk levels and rejects others", () => {
    expect(RiskLevel.parse("RED")).toBe("RED");
    expect(RiskLevel.safeParse("BLUE").success).toBe(false);
  });
});

describe("PatientSchema", () => {
  const valid = {
    id: "11111111-1111-4111-8111-111111111111",
    facilityId: "22222222-2222-4222-8222-222222222222",
    registeredBy: "33333333-3333-4333-8333-333333333333",
    name: "Asha Patel",
    age: 24,
    lmp: "2026-01-01",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  it("accepts a minimal payload and applies defaults", () => {
    const parsed = PatientSchema.parse(valid);
    expect(parsed.lmp).toBeInstanceOf(Date);
    expect(parsed.gravida).toBe(0);
    expect(parsed.para).toBe(0);
    expect(parsed.abortions).toBe(0);
    expect(parsed.riskLevel).toBe("GREEN");
    expect(parsed.isHighRisk).toBe(false);
    expect(parsed.referred).toBe(false);
    expect(parsed.riskFactors).toEqual([]);
  });

  it("accepts the HRP registration fields", () => {
    const parsed = PatientSchema.parse({
      ...valid,
      hrpReason: "PREVIOUS_C_SECTION",
      ashaName: "Sunita Devi",
      ashaPhone: "9988776655",
      referred: true,
    });

    expect(parsed.hrpReason).toBe("PREVIOUS_C_SECTION");
    expect(parsed.ashaName).toBe("Sunita Devi");
    expect(parsed.ashaPhone).toBe("9988776655");
    expect(parsed.referred).toBe(true);
  });

  it("accepts registrationHb and anemiaGrade", () => {
    const parsed = PatientSchema.parse({
      ...valid,
      registrationHb: 6.8,
      anemiaGrade: "SEVERE",
    });
    expect(parsed.registrationHb).toBe(6.8);
    expect(parsed.anemiaGrade).toBe("SEVERE");
  });

  it("accepts hrpComplications array and referralFacilityType", () => {
    const parsed = PatientSchema.parse({
      ...valid,
      hrpComplication: "ANEMIA",
      hrpComplications: ["ANEMIA", "PIH"],
      referred: true,
      referralFacilityType: "DH",
    });
    expect(parsed.hrpComplications).toEqual(["ANEMIA", "PIH"]);
    expect(parsed.referralFacilityType).toBe("DH");
  });

  it("rejects an invalid anemiaGrade", () => {
    expect(PatientSchema.safeParse({ ...valid, anemiaGrade: "CRITICAL" }).success).toBe(false);
  });

  it("rejects an unknown HRP reason", () => {
    expect(PatientSchema.safeParse({ ...valid, hrpReason: "BAD_LUCK" }).success).toBe(false);
  });

  it("rejects an age outside the 15-55 reproductive window", () => {
    expect(PatientSchema.safeParse({ ...valid, age: 14 }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...valid, age: 56 }).success).toBe(false);
  });

  it("rejects an unknown danger sign", () => {
    const result = PatientSchema.safeParse({ ...valid, riskFactors: ["SWOLLEN_FEET"] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed UUID", () => {
    expect(PatientSchema.safeParse({ ...valid, id: "not-a-uuid" }).success).toBe(false);
  });

  it("allows a null LMP for patients with unknown dates", () => {
    const parsed = PatientSchema.parse({ ...valid, lmp: null });
    expect(parsed.lmp).toBeNull();
  });
});

describe("VisitSchema", () => {
  const valid = {
    id: "44444444-4444-4444-8444-444444444444",
    patientId: "11111111-1111-4111-8111-111111111111",
    facilityId: "22222222-2222-4222-8222-222222222222",
    conductedBy: "33333333-3333-4333-8333-333333333333",
    visitNumber: 1,
    gestationalWeeks: 12,
    visitDate: "2026-02-01",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };

  it("accepts a visit recorded from a JSON body and applies defaults", () => {
    const parsed = VisitSchema.parse(valid);
    expect(parsed.visitDate).toBeInstanceOf(Date);
    expect(parsed.dangerSigns).toEqual([]);
    expect(parsed.ifaGiven).toBe(false);
    expect(parsed.referred).toBe(false);
  });

  it("rejects a visit number below 1", () => {
    expect(VisitSchema.safeParse({ ...valid, visitNumber: 0 }).success).toBe(false);
  });

  it("rejects a gestational age beyond 45 weeks", () => {
    expect(VisitSchema.safeParse({ ...valid, gestationalWeeks: 46 }).success).toBe(false);
  });
});

describe("DeviceSchema", () => {
  const valid = {
    id: "55555555-5555-4555-8555-555555555555",
    userId: "33333333-3333-4333-8333-333333333333",
    userName: "Radha Kumari",
    employeeId: "ARR_RANIGANJ_HSC01_01",
    userRole: "ANM",
    label: null,
    platform: "android",
    createdAt: "2026-11-01T00:00:00.000Z",
    lastSeenAt: "2026-11-02T00:00:00.000Z",
    revokedAt: null,
  };

  it("accepts a registered install", () => {
    const parsed = DeviceSchema.parse(valid);
    expect(parsed.platform).toBe("android");
    expect(parsed.revokedAt).toBeNull();
    expect(parsed.lastSeenAt).toBeInstanceOf(Date);
  });

  it("parses a revocation timestamp", () => {
    const parsed = DeviceSchema.parse({ ...valid, revokedAt: "2026-11-03T09:00:00.000Z" });
    expect(parsed.revokedAt).toBeInstanceOf(Date);
  });

  it("rejects an unknown platform", () => {
    expect(DeviceSchema.safeParse({ ...valid, platform: "ios" }).success).toBe(false);
  });
});

describe("anemiaGradeFromHb", () => {
  it("classifies Hb < 7 g/dL as SEVERE", () => {
    expect(anemiaGradeFromHb(5.5)).toBe("SEVERE");
    expect(anemiaGradeFromHb(6.9)).toBe("SEVERE");
    expect(anemiaGradeFromHb(0)).toBe("SEVERE");
  });

  it("classifies Hb between 7 and 9.9 g/dL as MODERATE", () => {
    expect(anemiaGradeFromHb(7.0)).toBe("MODERATE");
    expect(anemiaGradeFromHb(8.0)).toBe("MODERATE");
    expect(anemiaGradeFromHb(8.9)).toBe("MODERATE");
    expect(anemiaGradeFromHb(9.0)).toBe("MODERATE");
    expect(anemiaGradeFromHb(9.9)).toBe("MODERATE");
  });

  it("classifies Hb between 10 and 10.9 g/dL as MILD", () => {
    expect(anemiaGradeFromHb(10.0)).toBe("MILD");
    expect(anemiaGradeFromHb(10.9)).toBe("MILD");
  });

  it("classifies Hb >= 11 g/dL as NORMAL", () => {
    expect(anemiaGradeFromHb(11.0)).toBe("NORMAL");
    expect(anemiaGradeFromHb(12.5)).toBe("NORMAL");
    expect(anemiaGradeFromHb(16.0)).toBe("NORMAL");
  });

  it("returns null for non-numeric or missing values", () => {
    expect(anemiaGradeFromHb(null)).toBeNull();
    expect(anemiaGradeFromHb(undefined)).toBeNull();
    expect(anemiaGradeFromHb(Number.NaN)).toBeNull();
  });
});

describe("isFcmIndicated", () => {
  it("returns true for all anemia grades (SEVERE, MODERATE, MILD)", () => {
    expect(isFcmIndicated("SEVERE")).toBe(true);
    expect(isFcmIndicated("MODERATE")).toBe(true);
    expect(isFcmIndicated("MILD")).toBe(true);
  });

  it("returns true when complication or complications includes ANEMIA", () => {
    expect(isFcmIndicated("NORMAL", "ANEMIA")).toBe(true);
    expect(isFcmIndicated(null, null, ["ANEMIA", "PIH"])).toBe(true);
  });

  it("returns false for NORMAL without anemia complication, or unrecorded", () => {
    expect(isFcmIndicated("NORMAL")).toBe(false);
    expect(isFcmIndicated("NORMAL", "PIH")).toBe(false);
    expect(isFcmIndicated(null)).toBe(false);
    expect(isFcmIndicated(undefined)).toBe(false);
  });
});

describe("getPatientDisplayId", () => {
  it("formats standard UUID into MS-2026-<6 HEX>", () => {
    expect(getPatientDisplayId("11111111-1111-4111-8111-111111111111")).toBe("MS-2026-111111");
    expect(getPatientDisplayId("a3f9c122-0000-0000-0000-000000000000")).toBe("MS-2026-A3F9C1");
  });

  it("returns empty string for null, undefined, or empty ID", () => {
    expect(getPatientDisplayId(null)).toBe("");
    expect(getPatientDisplayId(undefined)).toBe("");
    expect(getPatientDisplayId("")).toBe("");
  });
});
