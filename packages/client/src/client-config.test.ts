import { describe, expect, it } from "vitest";
import { loadClientConfig } from "../build.config";

describe("loadClientConfig", () => {
  it("defaults the web build to a same-origin API path", () => {
    const config = loadClientConfig({});

    expect(config.apiUrl).toBe("/api");
    expect(config.nativeApp).toBe(false);
    expect(config.demoMode).toBe(true);
    expect(config.appVersion).toBe("0.0.0");
  });

  it("accepts an absolute https API for the bundled app", () => {
    const config = loadClientConfig({
      VITE_API_URL: "https://pilot-api.example.gov.in/api",
      VITE_NATIVE_APP: "true",
      VITE_DEMO_MODE: "false",
      VITE_APP_VERSION: "1.2.3",
      VITE_GIT_SHA: "abc1234",
    });

    expect(config.apiUrl).toBe("https://pilot-api.example.gov.in/api");
    expect(config.nativeApp).toBe(true);
    expect(config.demoMode).toBe(false);
    expect(config.appVersion).toBe("1.2.3");
    expect(config.gitSha).toBe("abc1234");
  });

  it("rejects a relative API path in the bundled app", () => {
    expect(() => loadClientConfig({ VITE_NATIVE_APP: "true" })).toThrow(/VITE_API_URL/);
  });

  it("rejects a plain http API URL", () => {
    expect(() => loadClientConfig({ VITE_API_URL: "http://hrp.example.gov.in/api" })).toThrow(
      /VITE_API_URL/
    );
  });

  it("rejects a demo bundle for the Android app", () => {
    expect(() =>
      loadClientConfig({
        VITE_API_URL: "https://pilot-api.example.gov.in/api",
        VITE_NATIVE_APP: "true",
      })
    ).toThrow(/VITE_DEMO_MODE/);
  });

  it("rejects a flag that is neither true nor false", () => {
    expect(() => loadClientConfig({ VITE_NATIVE_APP: "yes" })).toThrow(/VITE_NATIVE_APP/);
  });
});
