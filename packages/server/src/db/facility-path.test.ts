import { describe, expect, it } from "vitest";
import { facilityPathFor } from "./facility-path.js";

describe("facilityPathFor", () => {
  it("starts the chain at a root facility", () => {
    expect(facilityPathFor(null, "BIHAR")).toBe("BIHAR");
    expect(facilityPathFor(undefined, "BIHAR")).toBe("BIHAR");
    expect(facilityPathFor("   ", "BIHAR")).toBe("BIHAR");
  });

  it("extends the parent path so descendants stay in scope", () => {
    const district = facilityPathFor("BIHAR", "ARARIA");
    const block = facilityPathFor(district, "ARR_RANIGANJ");
    const hsc = facilityPathFor(block, "ARR_RANIGANJ_SIKTI");

    expect(district).toBe("BIHAR.ARARIA");
    expect(block).toBe("BIHAR.ARARIA.ARR_RANIGANJ");
    expect(hsc).toBe("BIHAR.ARARIA.ARR_RANIGANJ.ARR_RANIGANJ_SIKTI");
  });

  it("never returns a path that merely equals the parent", () => {
    // A flat path (the Raniganj pilot seed wrote `path: code`) is what hid
    // every HSC registration from the BHM and DHS.
    const block = "BIHAR.ARARIA.ARR_RANIGANJ";
    const hsc = facilityPathFor(block, "ARR_RANIGANJ_SIKTI");
    expect(hsc).not.toBe(block);
    expect(hsc.startsWith(`${block}.`)).toBe(true);
  });
});
