import { describe, expect, it } from "vitest";
import type { PatientRow, UserRow } from "../db/types.js";
import { serializePatient, serializeUser } from "./serializers.js";

const row: PatientRow = {
  id: "11111111-1111-4111-8111-111111111111",
  abha_id: null,
  facility_id: "22222222-2222-4222-8222-222222222222",
  registered_by: "33333333-3333-4333-8333-333333333333",
  name: "Rekha Devi",
  age: 26,
  phone: "9988776655",
  address: "Pasunj Village",
  hrp_reason: "PREVIOUS_C_SECTION",
  asha_name: "Sunita Devi",
  asha_phone: "9988776655",
  referred: true,
  lmp: new Date("2026-01-01"),
  edd: null,
  gravida: 2,
  para: 1,
  abortions: 0,
  risk_factors: ["HYPERTENSION"],
  risk_level: "RED",
  risk_score: 95,
  is_high_risk: true,
  created_at: new Date("2026-01-02T00:00:00.000Z"),
  updated_at: new Date("2026-01-02T00:00:00.000Z"),
};

describe("serializePatient", () => {
  it("maps snake_case columns to the camelCase API contract", () => {
    const patient = serializePatient(row);

    expect(patient).toMatchObject({
      id: row.id,
      facilityId: row.facility_id,
      registeredBy: row.registered_by,
      hrpReason: "PREVIOUS_C_SECTION",
      ashaName: "Sunita Devi",
      ashaPhone: "9988776655",
      referred: true,
      riskFactors: ["HYPERTENSION"],
      riskLevel: "RED",
      isHighRisk: true,
      anmName: null,
    });
  });

  it("accepts the joined ANM name", () => {
    expect(serializePatient(row, "Asha Ben").anmName).toBe("Asha Ben");
  });

  it("tolerates a null risk factor array", () => {
    const patient = serializePatient({ ...row, risk_factors: null as unknown as string[] });

    expect(patient.riskFactors).toEqual([]);
  });
});

const userRow: UserRow = {
  id: "44444444-4444-4444-8444-444444444444",
  employee_id: "ANM001",
  name: "Asha Ben",
  phone: "9876543210",
  password_hash: "hash",
  role: "ANM",
  facility_id: "22222222-2222-4222-8222-222222222222",
  language: "hi",
  is_active: true,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

describe("serializeUser", () => {
  it("maps an active login role", () => {
    expect(serializeUser(userRow)).toMatchObject({
      id: userRow.id,
      employeeId: "ANM001",
      role: "ANM",
      facilityId: userRow.facility_id,
      isActive: true,
    });
  });

  it("rejects inactive legacy roles from the database union", () => {
    expect(() => serializeUser({ ...userRow, role: "ASHA" })).toThrow();
    expect(() => serializeUser({ ...userRow, role: "STATE_ADMIN" })).toThrow();
  });
});
