import type { Patient, Visit } from "@hrp/shared";
import { describe, expect, it } from "vitest";
import {
  bpTone,
  dangerSignLabel,
  formatBp,
  formatHb,
  gaLabel,
  hbTone,
  latestVisitByPatient,
  toneTextClass,
  villageLabel,
} from "./clinical";

const baseVisit: Visit = {
  id: "visit-1",
  patientId: "patient-1",
  facilityId: "facility-1",
  conductedBy: "user-1",
  visitNumber: 1,
  gestationalWeeks: 12,
  visitDate: new Date(2026, 0, 10),
  bpSystolic: 120,
  bpDiastolic: 80,
  hb: 11,
  weight: 55,
  fundalHeight: null,
  fetalHeartRate: null,
  dangerSigns: [],
  ifaGiven: true,
  calciumGiven: true,
  albendazoleGiven: false,
  referred: false,
  referralReason: null,
  referralFacilityId: null,
  notes: null,
  createdAt: new Date(2026, 0, 10),
  updatedAt: new Date(2026, 0, 10),
};

const patient: Patient = {
  id: "patient-1",
  abhaId: null,
  facilityId: "facility-1",
  registeredBy: "user-1",
  anmName: "Asha Ben",
  name: "Rekha Devi",
  age: 26,
  phone: null,
  address: null,
  hrpReason: "HYPERTENSION",
  ashaName: null,
  ashaPhone: null,
  referred: false,
  isHrp: true,
  followUpStatus: "PENDING",
  lmp: null,
  edd: null,
  gravida: 2,
  para: 1,
  abortions: 0,
  riskFactors: [],
  riskLevel: "RED",
  riskScore: 65,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("latestVisitByPatient", () => {
  it("keeps the newest visit per woman", () => {
    const older = { ...baseVisit, id: "older", visitDate: new Date(2026, 0, 1) };
    const newer = { ...baseVisit, id: "newer", visitDate: new Date(2026, 2, 1) };
    const other = { ...baseVisit, id: "other", patientId: "patient-2" };

    const map = latestVisitByPatient([newer, older, other]);

    expect(map.get("patient-1")?.id).toBe("newer");
    expect(map.get("patient-2")?.id).toBe("other");
  });

  it("returns an empty map when there are no visits", () => {
    expect(latestVisitByPatient([]).size).toBe(0);
  });
});

describe("formatBp", () => {
  it("formats a complete reading", () => {
    expect(formatBp(baseVisit)).toBe("120/80");
  });

  it("falls back to an em dash when a reading is missing", () => {
    expect(formatBp(undefined)).toBe("—");
    expect(formatBp({ ...baseVisit, bpDiastolic: null })).toBe("—");
  });
});

describe("bpTone", () => {
  it("flags severe hypertension in red", () => {
    expect(bpTone({ ...baseVisit, bpSystolic: 162 })).toBe("red");
    expect(bpTone({ ...baseVisit, bpDiastolic: 110 })).toBe("red");
  });

  it("flags gestational hypertension in amber", () => {
    expect(bpTone({ ...baseVisit, bpSystolic: 145 })).toBe("amber");
    expect(bpTone({ ...baseVisit, bpDiastolic: 92 })).toBe("amber");
  });

  it("keeps a normal reading green", () => {
    expect(bpTone(baseVisit)).toBe("green");
  });

  it("is neutral without a reading", () => {
    expect(bpTone(undefined)).toBe("neutral");
  });
});

describe("hbTone", () => {
  it("uses the anaemia thresholds", () => {
    expect(hbTone(6.9)).toBe("red");
    expect(hbTone(7)).toBe("amber");
    expect(hbTone(9.9)).toBe("amber");
    expect(hbTone(10)).toBe("green");
    expect(hbTone(null)).toBe("neutral");
  });

  it("formats to one decimal place", () => {
    expect(formatHb(baseVisit)).toBe("11.0");
    expect(formatHb({ ...baseVisit, hb: 7.84 })).toBe("7.8");
    expect(formatHb(undefined)).toBe("—");
  });
});

describe("gaLabel", () => {
  it("shows weeks when an LMP is recorded", () => {
    const lmp = new Date();
    lmp.setDate(lmp.getDate() - 7 * 30);
    expect(gaLabel({ ...patient, lmp })).toBe("30w");
  });

  it("says unknown without LMP or EDD", () => {
    expect(gaLabel(patient)).toBe("Unknown");
  });
});

describe("villageLabel and dangerSignLabel", () => {
  it("prefers the address and falls back to an em dash", () => {
    expect(villageLabel({ ...patient, address: "Rampur" })).toBe("Rampur");
    expect(villageLabel({ ...patient, address: "   " })).toBe("—");
  });

  it("turns enum values into readable labels", () => {
    expect(dangerSignLabel("REDUCED_FETAL_MOVEMENT")).toBe("Reduced Fetal Movement");
  });
});

describe("toneTextClass", () => {
  it("maps every tone to a text class", () => {
    expect(toneTextClass("red")).toContain("triage-red");
    expect(toneTextClass("neutral")).toContain("ink");
  });
});
