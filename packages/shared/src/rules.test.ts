import { describe, expect, it } from "vitest";
import {
  calculateGestationalWeeks,
  calculateRiskScore,
  gestationalAgeWeeks,
  getDueVisits,
  getRiskLevelColor,
  getUrgencyLabel,
  isVisitOverdue,
} from "./rules.js";
import type { Patient, Visit } from "./types.js";

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    abhaId: null,
    facilityId: "22222222-2222-2222-2222-222222222222",
    registeredBy: "33333333-3333-3333-3333-333333333333",
    name: "Rekha Devi",
    age: 26,
    phone: "9988776655",
    address: "Pasunj Village",
    hrpReason: null,
    ashaName: null,
    ashaPhone: null,
    referred: false,
    lmp: null,
    edd: null,
    gravida: 2,
    para: 1,
    abortions: 0,
    riskFactors: [],
    riskLevel: "GREEN",
    riskScore: 0,
    isHighRisk: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    patientId: "11111111-1111-1111-1111-111111111111",
    facilityId: "22222222-2222-2222-2222-222222222222",
    conductedBy: "33333333-3333-3333-3333-333333333333",
    visitNumber: 1,
    gestationalWeeks: 12,
    visitDate: new Date(),
    bpSystolic: 120,
    bpDiastolic: 80,
    hb: 11,
    weight: 55,
    fundalHeight: 12,
    fetalHeartRate: 140,
    dangerSigns: [],
    ifaGiven: true,
    calciumGiven: true,
    albendazoleGiven: true,
    referred: false,
    referralReason: null,
    referralFacilityId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("calculateRiskScore", () => {
  it("returns GREEN with a zero score when there are no risk factors", () => {
    const result = calculateRiskScore(makePatient(), null);

    expect(result.score).toBe(0);
    expect(result.level).toBe("GREEN");
    expect(result.factors).toEqual([]);
  });

  it("scores a single danger sign by its rule weight", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });

    const result = calculateRiskScore(patient, null);

    expect(result.score).toBe(30);
    expect(result.level).toBe("AMBER");
    expect(result.factors).toContain("Hypertension / Pre-eclampsia");
  });

  it("adds a comorbidity multiplier when two danger signs co-occur", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION", "SEVERE_ANEMIA"] });

    const result = calculateRiskScore(patient, null);

    // 30 (htn) + 20 (anemia) = 50, then +30% of 50 for the comorbidity = 65
    expect(result.score).toBe(65);
    expect(result.level).toBe("RED");
    expect(result.factors).toContain("HTN + Severe Anemia");
  });

  it("merges danger signs observed at the visit into the patient's factors", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 20, dangerSigns: ["SEVERE_ANEMIA"] });

    const result = calculateRiskScore(patient, visit);

    expect(result.score).toBe(65);
    expect(result.level).toBe("RED");
  });

  it("counts a danger sign once even when it appears on both the patient and the visit", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 20, dangerSigns: ["HYPERTENSION"] });

    const result = calculateRiskScore(patient, visit);

    expect(result.score).toBe(30);
  });

  it("reduces urgency for a first-trimester visit", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 12 });

    const result = calculateRiskScore(patient, visit);

    // 30 base, x0.8 for the first trimester = 24
    expect(result.score).toBe(24);
    expect(result.factors.some((f) => f.includes("Gestational age adjustment"))).toBe(true);
  });

  it("applies the third-trimester gestational age multiplier", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 30 });

    const result = calculateRiskScore(patient, visit);

    // 30 base, x1.3 for the third trimester = 39
    expect(result.score).toBe(39);
    expect(result.factors.some((f) => f.includes("Gestational age adjustment"))).toBe(true);
  });

  it("applies the term gestational age multiplier", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 38 });

    const result = calculateRiskScore(patient, visit);

    // 30 base, x1.5 at term = 45
    expect(result.score).toBe(45);
    expect(result.level).toBe("AMBER");
  });

  it("keeps the second trimester score unadjusted", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });
    const visit = makeVisit({ gestationalWeeks: 20 });

    const result = calculateRiskScore(patient, visit);

    expect(result.score).toBe(30);
    expect(result.factors.some((f) => f.includes("Gestational age adjustment"))).toBe(false);
  });

  it("escalates to RED for the triple-threat combination", () => {
    const patient = makePatient({
      riskFactors: ["HYPERTENSION", "SEVERE_ANEMIA", "GESTATIONAL_DIABETES"],
    });

    const result = calculateRiskScore(patient, null);

    expect(result.level).toBe("RED");
    expect(result.factors).toContain("HTN + Anemia + GDM");
  });

  it("does not apply a comorbidity when only one of its signs is present", () => {
    const patient = makePatient({ riskFactors: ["HYPERTENSION"] });

    const result = calculateRiskScore(patient, null);

    expect(result.factors).not.toContain("HTN + Severe Anemia");
    expect(result.score).toBe(30);
  });

  it("scores the reason recorded at registration even without current danger signs", () => {
    const patient = makePatient({ hrpReason: "PREVIOUS_C_SECTION" });

    const result = calculateRiskScore(patient, null);

    expect(result.score).toBe(30);
    expect(result.level).toBe("AMBER");
    expect(result.factors).toContain("Previous C-section");
  });

  it("never scores a registered HRP as GREEN when the LMP is unknown", () => {
    const result = calculateRiskScore(makePatient({ hrpReason: "CARDIAC_DISEASE" }), null);

    expect(result.score).toBe(50);
    expect(result.level).toBe("AMBER");
  });

  it("adds the registration reason to danger signs from a visit", () => {
    const patient = makePatient({ hrpReason: "HYPERTENSION" });
    const visit = makeVisit({ gestationalWeeks: 20, dangerSigns: ["SEVERE_ANEMIA"] });

    const result = calculateRiskScore(patient, visit);

    // 20 (anemia) + 40 (reason) = 60
    expect(result.score).toBe(60);
    expect(result.level).toBe("RED");
  });

  it("does not discount the score when the gestational age is unknown", () => {
    // Regression: an unknown LMP used to be treated as "0 weeks pregnant",
    // which applied the first-trimester multiplier and downgraded a RED
    // patient to AMBER. Understating risk is the dangerous direction to fail.
    const patient = makePatient({
      lmp: null,
      riskFactors: ["HYPERTENSION", "SEVERE_ANEMIA"],
    });

    const result = calculateRiskScore(patient, null);

    expect(result.score).toBe(65);
    expect(result.level).toBe("RED");
    expect(result.factors.some((f) => f.includes("Gestational age adjustment"))).toBe(false);
  });
});

describe("calculateGestationalWeeks", () => {
  it("returns 0 when the LMP is unknown", () => {
    expect(calculateGestationalWeeks(null)).toBe(0);
  });

  it("counts whole weeks since the LMP", () => {
    const lmp = new Date();
    lmp.setDate(lmp.getDate() - 28 * 7);

    expect(calculateGestationalWeeks(lmp)).toBe(28);
  });

  it("never returns a negative age for a future LMP", () => {
    const lmp = new Date();
    lmp.setDate(lmp.getDate() + 14);

    expect(calculateGestationalWeeks(lmp)).toBe(0);
  });
});

describe("gestationalAgeWeeks", () => {
  const now = new Date("2026-10-27T00:00:00Z");

  it("prefers the LMP when both dates exist", () => {
    expect(
      gestationalAgeWeeks({ lmp: "2026-03-24T00:00:00Z", edd: "2026-12-29T00:00:00Z" }, now)
    ).toBe(31);
  });

  it("falls back to the EDD instead of treating GA as unknown", () => {
    expect(gestationalAgeWeeks({ edd: "2027-01-05T00:00:00Z" }, now)).toBe(30);
  });

  it("returns null when neither date is usable", () => {
    expect(gestationalAgeWeeks({ lmp: null, edd: "not-a-date" }, now)).toBeNull();
  });

  it("counts an overdue pregnancy forward instead of going negative", () => {
    expect(gestationalAgeWeeks({ edd: "2026-08-01T00:00:00Z" }, now)).toBe(45);
  });

  it("accepts Date instances and rejects impossible dates", () => {
    expect(gestationalAgeWeeks({ lmp: new Date("2026-09-29T00:00:00Z") }, now)).toBe(4);
    expect(gestationalAgeWeeks({ lmp: new Date("2026-10-10T00:00:00Z") }, now)).toBe(2);
    expect(gestationalAgeWeeks({ lmp: new Date("2026-11-10T00:00:00Z") }, now)).toBe(0);
  });
});

describe("getDueVisits", () => {
  const lmp = new Date("2025-01-15T00:00:00Z");

  it("returns nothing when the LMP is unknown", () => {
    expect(getDueVisits(null, 0)).toEqual([]);
  });

  it("returns the full schedule when no visits are complete", () => {
    const due = getDueVisits(lmp, 0);

    expect(due).toHaveLength(8);
    expect(due[0].visitNumber).toBe(1);
    expect(due[0].dueDate.getTime()).toBe(new Date("2025-04-09T00:00:00Z").getTime());
  });

  it("only returns visits that have not been completed yet", () => {
    const due = getDueVisits(lmp, 3);

    expect(due).toHaveLength(5);
    expect(due[0].visitNumber).toBe(4);
  });

  it("returns nothing once every scheduled visit is complete", () => {
    expect(getDueVisits(lmp, 8)).toEqual([]);
  });

  it("brackets the due date with the visit window", () => {
    const [first] = getDueVisits(lmp, 0);
    const windowDays = 2 * 7 * 24 * 60 * 60 * 1000;

    expect(first.windowStart.getTime()).toBe(first.dueDate.getTime() - windowDays);
    expect(first.windowEnd.getTime()).toBe(first.dueDate.getTime() + windowDays);
  });

  it("uses a one-week window for the weekly near-term visits", () => {
    const due = getDueVisits(lmp, 0);
    const weekly = due.find((v) => v.visitNumber === 5);

    expect(weekly).toBeDefined();
    const windowDays = 1 * 7 * 24 * 60 * 60 * 1000;
    expect(weekly?.windowEnd.getTime()).toBe((weekly?.dueDate.getTime() ?? 0) + windowDays);
  });
});

describe("isVisitOverdue", () => {
  it("is overdue once the visit window has closed", () => {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() - 1);

    expect(isVisitOverdue({ dueDate: new Date(), windowEnd })).toBe(true);
  });

  it("is not overdue while the window is still open", () => {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + 1);

    expect(isVisitOverdue({ dueDate: new Date(), windowEnd })).toBe(false);
  });
});

describe("getRiskLevelColor", () => {
  it("maps each risk level to a distinct colour", () => {
    expect(getRiskLevelColor("RED")).toBe("#dc2626");
    expect(getRiskLevelColor("AMBER")).toBe("#f59e0b");
    expect(getRiskLevelColor("GREEN")).toBe("#16a34a");
  });
});

describe("getUrgencyLabel", () => {
  it("maps each risk level to an escalation instruction", () => {
    expect(getUrgencyLabel("RED")).toBe("Immediate Referral");
    expect(getUrgencyLabel("AMBER")).toBe("Refer within 48 hours");
    expect(getUrgencyLabel("GREEN")).toBe("Routine Follow-up");
  });
});
