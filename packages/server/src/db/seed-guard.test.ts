import { describe, expect, it } from "vitest";
import { assertSeedAllowed } from "./seed-guard.js";

describe("assertSeedAllowed", () => {
  it("allows seeding outside production", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: "test" })).not.toThrow();
  });

  it("blocks production seeding by default", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(/Refusing to seed/);
  });

  it("allows an explicitly approved production bootstrap", () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: "production", ALLOW_PRODUCTION_SEED: "true" })
    ).not.toThrow();
  });

  it("requires the literal approval value", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production", ALLOW_PRODUCTION_SEED: "1" })).toThrow(
      /Refusing to seed/
    );
  });
});
