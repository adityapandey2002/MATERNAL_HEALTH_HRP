import { describe, expect, it, vi } from "vitest";

vi.unmock("./client.js");
vi.mock("pg", () => ({
  Pool: class {
    end = vi.fn(async () => undefined);
  },
}));

describe("database client", () => {
  it("constructs the Kysely instance from validated configuration", async () => {
    const { closeDb, db } = await import("./client.js");

    expect(db).toBeDefined();
    await closeDb();
  });
});
