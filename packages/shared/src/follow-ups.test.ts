import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleFollowUp } from "./date-utils.js";
import { ANC_TESTS_BY_VISIT, getFollowUpPlan } from "./follow-ups.js";

const LMP = new Date(2026, 0, 1); // 1 Jan 2026

describe("getFollowUpPlan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 1)); // 1 May 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no plan when the LMP is unknown", () => {
    expect(getFollowUpPlan({ lmp: null }, 0)).toEqual([]);
  });

  it("starts at the first contact for a woman with no recorded visits", () => {
    const plan = getFollowUpPlan({ lmp: LMP }, 0, 1);

    expect(plan).toHaveLength(1);
    expect(plan[0].visitNumber).toBe(1);
  });

  it("skips contacts the ANM has already recorded", () => {
    const plan = getFollowUpPlan({ lmp: LMP }, 1, 1);

    expect(plan[0].visitNumber).toBe(2);
  });

  it("marks a contact overdue once its window has closed", () => {
    // Visit 1 is due at 12 weeks (26 Mar) with a two-week window ending 9 Apr.
    const plan = getFollowUpPlan({ lmp: LMP }, 0, 1);

    expect(plan[0].status).toBe("OVERDUE");
  });

  it("marks a contact due inside its window", () => {
    // Move to 10 May: visit 2 (20 weeks, 21 May) is inside its 7-21 May window.
    vi.setSystemTime(new Date(2026, 4, 10));

    const plan = getFollowUpPlan({ lmp: LMP }, 1, 1);

    expect(plan[0].visitNumber).toBe(2);
    expect(plan[0].status).toBe("DUE");
  });

  it("marks a future contact as upcoming", () => {
    const plan = getFollowUpPlan({ lmp: LMP }, 1, 1);

    expect(plan[0].status).toBe("UPCOMING");
  });

  it("carries the tests expected at each contact", () => {
    const plan = getFollowUpPlan({ lmp: LMP }, 0, 1);

    expect(plan[0].tests).toEqual(ANC_TESTS_BY_VISIT[1]);
    expect(plan[0].tests).toContain("Hb");
  });

  it("honours the limit and never returns more than the remaining schedule", () => {
    expect(getFollowUpPlan({ lmp: LMP }, 0, 3)).toHaveLength(3);
    expect(getFollowUpPlan({ lmp: LMP }, 8, 3)).toEqual([]);
  });
});

describe("scheduleFollowUp", () => {
  const baseDate = new Date("2026-10-01T00:00:00.000Z");

  it("assigns IMMEDIATE_7_DAYS for referred patients", () => {
    const result = scheduleFollowUp({ village: "Test Village", referred: true }, baseDate);
    expect(result.track).toBe("IMMEDIATE_7_DAYS");
    expect(result.scheduledDate).toEqual(result.immediateDeadline);
  });

  it("assigns IMMEDIATE_7_DAYS for RED risk level patients", () => {
    const result = scheduleFollowUp(
      { village: "Test Village", referred: false, riskLevel: "RED" },
      baseDate
    );
    expect(result.track).toBe("IMMEDIATE_7_DAYS");
    expect(result.scheduledDate).toEqual(result.immediateDeadline);
  });

  it("assigns PMSMA_SESSION for AMBER risk level patients", () => {
    const result = scheduleFollowUp(
      { village: "Test Village", referred: false, riskLevel: "AMBER" },
      baseDate
    );
    expect(result.track).toBe("PMSMA_SESSION");
    expect(result.scheduledDate).toEqual(result.pmsmaDate);
  });

  it("assigns VHSND_COMMUNITY for GREEN risk level patients", () => {
    const result = scheduleFollowUp(
      { village: "Test Village", referred: false, riskLevel: "GREEN" },
      baseDate
    );
    expect(result.track).toBe("VHSND_COMMUNITY");
    expect(result.scheduledDate).toEqual(result.vhsndDate);
  });
});
