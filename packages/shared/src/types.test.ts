import { describe, expect, it } from "vitest";
import {
  BooleanInput,
  DateInput,
  FacilityLevel,
  PatientSchema,
  RiskLevel,
  UserRole,
  VisitSchema,
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
    expect(FacilityLevel.safeParse("CLINIC").success).toBe(false);
  });

  it("accepts known user roles and risk levels", () => {
    expect(UserRole.parse("ANM")).toBe("ANM");
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
