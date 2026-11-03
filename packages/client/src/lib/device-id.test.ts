import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDeviceId, getDeviceId, getDevicePlatform } from "./device-id";

const KEY = "hrp-device-id";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("device id", () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates a v4 UUID and remembers it", () => {
    const first = getDeviceId();

    expect(first).toMatch(UUID);
    expect(store.get(KEY)).toBe(first);
    expect(getDeviceId()).toBe(first);
  });

  it("replaces a malformed stored value", () => {
    store.set(KEY, "not-a-uuid");
    const id = getDeviceId();

    expect(id).toMatch(UUID);
    expect(store.get(KEY)).toBe(id);
  });

  it("generates a new id after the stored one is cleared", () => {
    const first = getDeviceId();
    clearDeviceId();
    expect(getDeviceId()).not.toBe(first);
  });

  it("returns null when storage is unavailable", () => {
    const getItem = vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(getDeviceId()).toBeNull();
    getItem.mockRestore();
  });

  it("reports the build's platform", () => {
    expect(getDevicePlatform()).toBe("web");

    vi.stubEnv("VITE_NATIVE_APP", "true");
    expect(getDevicePlatform()).toBe("android");
  });
});
