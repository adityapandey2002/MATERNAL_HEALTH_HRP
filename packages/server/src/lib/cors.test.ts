import { describe, expect, it } from "vitest";
import { APP_ORIGINS, corsOriginOption } from "./cors.js";

function allowlist(origins: string[], nodeEnv: string): string[] {
  const result = corsOriginOption(origins, nodeEnv);
  if (result === true) throw new Error("expected an explicit allowlist");
  return result;
}

describe("corsOriginOption", () => {
  it("reflects any origin only for local development without an allowlist", () => {
    expect(corsOriginOption([], "development")).toBe(true);
  });

  it("always allows the bundled app's local origins", () => {
    const origins = allowlist([], "production");

    expect(origins).toEqual(APP_ORIGINS);
    expect(origins).toContain("https://localhost");
    expect(origins).toContain("capacitor://localhost");
  });

  it("keeps an explicit web allowlist and never adds a wildcard", () => {
    const origins = allowlist(["https://hrp.example.gov.in"], "production");

    expect(origins).toEqual(["https://hrp.example.gov.in", ...APP_ORIGINS]);
    expect(origins).not.toContain("*");
  });

  it("de-duplicates when an origin is listed twice", () => {
    const origins = allowlist(["https://localhost", "https://localhost"], "production");

    expect(origins.filter((origin) => origin === "https://localhost")).toHaveLength(1);
  });
});
