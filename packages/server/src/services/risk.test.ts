import { describe, expect, it } from "vitest";
import { scoreUnregisteredPatient } from "./risk.js";

describe("scoreUnregisteredPatient", () => {
  it("scores the registration reason so a new HRP is never GREEN", () => {
    const result = scoreUnregisteredPatient({
      name: "Rekha Devi",
      age: 26,
      riskFactors: [],
      hrpReason: "PREVIOUS_C_SECTION",
    });

    expect(result.score).toBe(30);
    expect(result.level).toBe("AMBER");
  });

  it("keeps danger signs and the registration reason together", () => {
    const result = scoreUnregisteredPatient({
      name: "Rekha Devi",
      age: 26,
      riskFactors: ["SEVERE_ANEMIA"],
      hrpReason: "CARDIAC_DISEASE",
    });

    // 20 (severe anaemia) + 50 (cardiac disease) = 70
    expect(result.score).toBe(70);
    expect(result.level).toBe("RED");
  });

  it("stays GREEN when there is no reason and no danger sign", () => {
    const result = scoreUnregisteredPatient({ name: "Rekha Devi", age: 26, riskFactors: [] });

    expect(result.score).toBe(0);
    expect(result.level).toBe("GREEN");
  });
});
