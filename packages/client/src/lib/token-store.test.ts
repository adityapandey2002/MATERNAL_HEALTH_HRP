import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEncryptedValue, setDataKey } from "./crypto";
import { clearRefreshToken, readRefreshToken, storeRefreshToken } from "./token-store";

const KEY = "hrp-native-refresh-token";
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

async function unlock(): Promise<void> {
  const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ])) as CryptoKey;
  setDataKey(key);
}

describe("native refresh token storage", () => {
  beforeEach(() => {
    store.clear();
    setDataKey(null);
  });

  afterEach(() => {
    setDataKey(null);
    vi.unstubAllEnvs();
  });

  it("encrypts the token when the device key is unlocked", async () => {
    await unlock();
    await storeRefreshToken("refresh-abc");

    expect(isEncryptedValue(store.get(KEY))).toBe(true);
    expect(store.get(KEY)).not.toContain("refresh-abc");
    expect(await readRefreshToken()).toBe("refresh-abc");
  });

  it("keeps plaintext in a demo build without a PIN", async () => {
    await storeRefreshToken("refresh-abc");

    expect(store.get(KEY)).toBe("refresh-abc");
    expect(await readRefreshToken()).toBe("refresh-abc");
  });

  it("refuses to persist a credential in a locked pilot build", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");

    await expect(storeRefreshToken("refresh-abc")).rejects.toThrow(/Unlock the device/);
    expect(store.has(KEY)).toBe(false);
  });

  it("returns null when the stored token cannot be decrypted", async () => {
    await unlock();
    await storeRefreshToken("refresh-abc");
    setDataKey(null);

    expect(await readRefreshToken()).toBeNull();
  });

  it("clears the stored token", async () => {
    await storeRefreshToken("refresh-abc");
    clearRefreshToken();
    expect(store.has(KEY)).toBe(false);
  });
});
