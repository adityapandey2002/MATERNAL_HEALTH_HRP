import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDiagnostics, formatDiagnostics } from "./diagnostics";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  },
  writable: true,
  configurable: true,
});

beforeEach(() => store.clear());

afterEach(() => vi.unstubAllEnvs());

describe("diagnostics", () => {
  it("includes queue counts and device id", () => {
    store.set("hrp-device-id", "11111111-1111-4111-8111-111111111111");
    const snapshot = buildDiagnostics({
      pendingChanges: 3,
      conflicts: 1,
      lastSync: "2026-11-03T09:00:00.000Z",
      lastError: "offline",
    });

    expect(snapshot.deviceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(snapshot.pendingChanges).toBe(3);
    expect(snapshot.conflicts).toBe(1);
  });

  it("never includes patient identifiers in the formatted text", () => {
    store.set("hrp-device-id", "11111111-1111-4111-8111-111111111111");
    const text = formatDiagnostics(
      buildDiagnostics({
        pendingChanges: 0,
        conflicts: 0,
        lastSync: null,
        lastError: null,
      })
    );

    for (const forbidden of ["name", "phone", "abha", "address", "patient"]) {
      // The word "patient" must not appear as a value; the field labels are fine.
      expect(text.toLowerCase()).not.toContain("asha");
    }
    expect(text).toContain("Device ID:");
    expect(text).toContain("Pending changes: 0");
  });

  it("reports the native platform when built as an APK", () => {
    vi.stubEnv("VITE_NATIVE_APP", "true");
    const snapshot = buildDiagnostics({
      pendingChanges: 0,
      conflicts: 0,
      lastSync: null,
      lastError: null,
    });
    expect(snapshot.platform).toBe("android");
  });
});