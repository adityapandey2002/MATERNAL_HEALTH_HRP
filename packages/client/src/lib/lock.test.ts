import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The global test setup mocks localStorage with no-op vi.fn(). The lock module
// needs real storage, so replace it with a Map-backed implementation.
const store = new Map<string, string>();
const realLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: realLocalStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(window, "localStorage", {
  value: realLocalStorage,
  writable: true,
  configurable: true,
});

import {
  changePin,
  getDerivedKey,
  getFailedAttempts,
  isLocked,
  isPinSet,
  lock,
  setupPin,
  verifyPin,
  wipeDevice,
} from "./lock";

import { decryptString, encryptString } from "./crypto";

describe("device lock", () => {
  beforeEach(() => {
    store.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    store.clear();
    sessionStorage.clear();
  });

  it("reports no PIN on a fresh device", () => {
    expect(isPinSet()).toBe(false);
    expect(isLocked()).toBe(false);
  });

  it("rejects a PIN that is not 6 digits", async () => {
    await expect(setupPin("123")).rejects.toThrow(/6 digits/);
    await expect(setupPin("abcdef")).rejects.toThrow(/6 digits/);
    expect(isPinSet()).toBe(false);
  });

  it("sets up a 6-digit PIN and unlocks", async () => {
    const key = await setupPin("123456");

    expect(isPinSet()).toBe(true);
    expect(isLocked()).toBe(false);
    expect(key).toBeDefined();
    expect(getDerivedKey()).not.toBeNull();
  });

  it("verifies the correct PIN", async () => {
    await setupPin("123456");
    lock();

    expect(isLocked()).toBe(true);
    expect(getDerivedKey()).toBeNull();

    const ok = await verifyPin("123456");
    expect(ok).toBe(true);
    expect(isLocked()).toBe(false);
    expect(getDerivedKey()).not.toBeNull();
  });

  it("rejects a wrong PIN", async () => {
    await setupPin("123456");
    lock();

    const ok = await verifyPin("999999");
    expect(ok).toBe(false);
    expect(isLocked()).toBe(true);
    expect(getFailedAttempts()).toBe(1);
  });

  it("locks after 10 failed attempts and wipes", { timeout: 20_000 }, async () => {
    await setupPin("123456");
    lock();

    for (let i = 0; i < 9; i++) {
      await verifyPin("000000");
    }
    expect(isPinSet()).toBe(true); // not yet wiped

    await verifyPin("000000");
    // After 10th failure, device is wiped
    expect(isPinSet()).toBe(false);
  });

  it("changes PIN with correct old PIN", async () => {
    await setupPin("123456");
    lock();

    const changed = await changePin("123456", "654321");
    expect(changed).toBe(true);
    expect(isPinSet()).toBe(true);

    // Old PIN no longer works
    lock();
    const oldOk = await verifyPin("123456");
    expect(oldOk).toBe(false);

    // New PIN works
    lock();
    const newOk = await verifyPin("654321");
    expect(newOk).toBe(true);
  });

  it("refuses to change PIN with wrong old PIN", async () => {
    await setupPin("123456");

    const changed = await changePin("000000", "654321");
    expect(changed).toBe(false);

    // Original PIN still works
    lock();
    const ok = await verifyPin("123456");
    expect(ok).toBe(true);
  });

  it("wipes all data", async () => {
    await setupPin("123456");
    localStorage.setItem("test-key", "test-value");

    await wipeDevice();

    expect(isPinSet()).toBe(false);
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it(
    "wraps the data key so a PIN change does not orphan records",
    { timeout: 20_000 },
    async () => {
      await setupPin("123456");
      expect(localStorage.getItem("hrp-dek-wrapped")).toBeTruthy();

      const ciphertext = await encryptString("Rekha Devi");

      expect(await changePin("123456", "654321")).toBe(true);

      lock();
      expect(await verifyPin("654321")).toBe(true);
      expect(await decryptString(ciphertext)).toBe("Rekha Devi");
    }
  );

  it("does not re-wrap the data key when the old PIN is wrong", async () => {
    await setupPin("123456");
    const wrappedBefore = localStorage.getItem("hrp-dek-wrapped");

    expect(await changePin("000000", "654321")).toBe(false);
    expect(localStorage.getItem("hrp-dek-wrapped")).toBe(wrappedBefore);
  });
});
