import type { CreatePatient } from "@hrp/shared/schemas";
import { describe, expect, it } from "vitest";
import { mapPatientChanges, mapPatientToRow, toJson } from "./mappers.js";

const input: CreatePatient = {
  name: "Rekha Devi",
  age: 26,
  hrpReason: "PREVIOUS_C_SECTION",
  ashaName: "Sunita Devi",
  ashaPhone: "9988776655",
  referred: true,
  lmp: new Date("2026-01-01"),
  gravida: 2,
  para: 1,
  abortions: 0,
  riskFactors: ["HYPERTENSION"],
};

describe("mapPatientToRow", () => {
  it("maps camelCase input to snake_case columns and the server-owned fields", () => {
    const row = mapPatientToRow(input, { facilityId: "facility-1", registeredBy: "user-1" });

    expect(row).toMatchObject({
      facility_id: "facility-1",
      registered_by: "user-1",
      hrp_reason: "PREVIOUS_C_SECTION",
      asha_name: "Sunita Devi",
      asha_phone: "9988776655",
      referred: true,
      risk_factors: '["HYPERTENSION"]',
    });
    expect(row.lmp).toBeInstanceOf(Date);
  });

  it("writes null for optional fields that were not supplied", () => {
    const row = mapPatientToRow(
      { ...input, phone: undefined, address: undefined, abhaId: undefined },
      { facilityId: "facility-1", registeredBy: "user-1" }
    );

    expect(row.phone).toBeNull();
    expect(row.address).toBeNull();
    expect(row.abha_id).toBeNull();
  });
});

describe("mapPatientChanges", () => {
  it("maps only the fields present in the patch", () => {
    const row = mapPatientChanges({ hrpReason: null, ashaName: "Sunita", referred: false });

    expect(row).toEqual({ hrp_reason: null, asha_name: "Sunita", referred: false });
    expect(row).not.toHaveProperty("name");
  });

  it("normalises dates and drops invalid ones", () => {
    const row = mapPatientChanges({ lmp: "2026-02-03" });

    expect(row.lmp).toBeInstanceOf(Date);
    expect(mapPatientChanges({ lmp: "not-a-date" })).not.toHaveProperty("lmp");
  });
});

describe("toJson", () => {
  it("defaults missing jsonb values to an empty array", () => {
    expect(toJson(undefined)).toBe("[]");
    expect(toJson(["SEVERE_ANEMIA"])).toBe('["SEVERE_ANEMIA"]');
  });
});
