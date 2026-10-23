import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const productionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://hrp:strong-password@db:5432/hrp",
  JWT_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  CORS_ORIGINS: "https://hrp.example.gov.in",
};

describe("loadConfig", () => {
  it("uses development defaults outside production", () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.cookieSecure).toBe(false);
    expect(config.corsOrigins).toEqual([]);
  });

  it("accepts an explicit production configuration", () => {
    const config = loadConfig(productionEnv);

    expect(config.nodeEnv).toBe("production");
    expect(config.cookieSecure).toBe(true);
    expect(config.trustProxy).toBe(true);
    expect(config.corsOrigins).toEqual(["https://hrp.example.gov.in"]);
  });

  it("rejects missing production secrets", () => {
    expect(() => loadConfig({ ...productionEnv, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...productionEnv, JWT_REFRESH_SECRET: undefined })).toThrow(
      /JWT_REFRESH_SECRET/
    );
  });

  it("rejects short and shared secrets", () => {
    expect(() => loadConfig({ ...productionEnv, JWT_SECRET: "short" })).toThrow(/at least 32/);
    expect(() =>
      loadConfig({ ...productionEnv, JWT_REFRESH_SECRET: productionEnv.JWT_SECRET })
    ).toThrow(/must differ/);
  });

  it("rejects known development secrets", () => {
    expect(() =>
      loadConfig({ ...productionEnv, JWT_SECRET: "dev-secret-change-in-production-32chars" })
    ).toThrow(/development value/);
  });

  it("rejects wildcard CORS in production", () => {
    expect(() => loadConfig({ ...productionEnv, CORS_ORIGINS: "*" })).toThrow(/wildcard/);
  });

  it("parses explicit false booleans without coercion surprises", () => {
    const config = loadConfig({ COOKIE_SECURE: "false", TRUST_PROXY: "0" });

    expect(config.cookieSecure).toBe(false);
    expect(config.trustProxy).toBe(false);
  });

  it("does not include secret values in validation errors", () => {
    const secret = "short-secret-value";

    try {
      loadConfig({ ...productionEnv, JWT_SECRET: secret });
      throw new Error("expected configuration to fail");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
