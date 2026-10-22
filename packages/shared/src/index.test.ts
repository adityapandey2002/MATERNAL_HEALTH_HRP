import { describe, expect, it } from "vitest";
import * as shared from "./index.js";

describe("public API", () => {
  it("re-exports the schema, rule engine and HRP helpers", () => {
    expect(shared.PatientSchema).toBeDefined();
    expect(typeof shared.calculateRiskScore).toBe("function");
    expect(shared.HRP_REASONS.length).toBeGreaterThan(0);
    expect(typeof shared.getFollowUpPlan).toBe("function");
    expect(shared.ANC_TESTS_BY_VISIT[1]).toContain("Hb");
  });
});
