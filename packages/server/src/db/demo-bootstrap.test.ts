import { describe, expect, it, vi } from "vitest";
import { bootstrapDemoData, truncateDatabase } from "./demo-bootstrap.js";

function deps(env: Record<string, string | undefined>, userCount: number) {
  return {
    env,
    countUsers: vi.fn().mockResolvedValue(userCount),
    truncateDatabase: vi.fn().mockResolvedValue(undefined),
    seedDemoData: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
  };
}

describe("bootstrapDemoData", () => {
  it("does nothing unless SEED_DEMO_DATA is exactly true", async () => {
    const options = deps({}, 0);

    await expect(bootstrapDemoData(options)).resolves.toBe("disabled");
    expect(options.countUsers).not.toHaveBeenCalled();
    expect(options.seedDemoData).not.toHaveBeenCalled();
  });

  it("never reseeds a database that already has users", async () => {
    const options = deps({ SEED_DEMO_DATA: "true" }, 4);

    await expect(bootstrapDemoData(options)).resolves.toBe("already-populated");
    expect(options.seedDemoData).not.toHaveBeenCalled();
  });

  it("truncates and reseeds when RESET_DEMO_DATA is set", async () => {
    const options = deps({ SEED_DEMO_DATA: "true", RESET_DEMO_DATA: "true" }, 4);

    await expect(bootstrapDemoData(options)).resolves.toBe("seeded");
    expect(options.truncateDatabase).toHaveBeenCalledTimes(1);
    expect(options.seedDemoData).toHaveBeenCalledTimes(1);
    expect(options.countUsers).not.toHaveBeenCalled();
  });

  it("does not reset unless SEED_DEMO_DATA is also true", async () => {
    const options = deps({ RESET_DEMO_DATA: "true" }, 4);

    await expect(bootstrapDemoData(options)).resolves.toBe("disabled");
    expect(options.truncateDatabase).not.toHaveBeenCalled();
  });

  it("truncates every demo table", async () => {
    await truncateDatabase();
  });
});
