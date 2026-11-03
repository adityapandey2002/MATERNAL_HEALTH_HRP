import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DeviceLockedError,
  blindIndex,
  decryptJson,
  decryptString,
  encryptJson,
  encryptNullable,
  encryptString,
  isEncryptedValue,
  setDataKey,
} from "./crypto";

const PREFIX = "enc:v1:";

async function freshKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]) as Promise<CryptoKey>;
}

describe("field encryption", () => {
  beforeEach(async () => {
    setDataKey(await freshKey());
  });

  afterEach(() => {
    setDataKey(null);
  });

  it("round-trips a string and never stores the plaintext", async () => {
    const ciphertext = await encryptString("Rekha Devi");

    expect(isEncryptedValue(ciphertext)).toBe(true);
    expect(ciphertext.startsWith(PREFIX)).toBe(true);
    expect(ciphertext).not.toContain("Rekha");
    expect(await decryptString(ciphertext)).toBe("Rekha Devi");
  });

  it("uses a fresh IV per value", async () => {
    const a = await encryptString("same");
    const b = await encryptString("same");
    expect(a).not.toBe(b);
    expect(await decryptString(a)).toBe("same");
    expect(await decryptString(b)).toBe("same");
  });

  it("passes legacy plaintext through unchanged", async () => {
    expect(await decryptString("Rekha Devi")).toBe("Rekha Devi");
  });

  it("round-trips JSON", async () => {
    const payload = { name: "Rekha", age: 26, nested: { phone: "9988776655" } };
    const stored = await encryptJson(payload);
    expect(isEncryptedValue(stored)).toBe(true);
    expect(await decryptJson(stored)).toEqual(payload);
  });

  it("passes plaintext JSON through unchanged", async () => {
    const payload = { name: "Rekha" };
    expect(await decryptJson(payload)).toEqual(payload);
  });

  it("leaves empty values unencrypted", async () => {
    expect(await encryptNullable(null)).toBeNull();
    expect(await encryptNullable(undefined)).toBeNull();
    expect(await encryptNullable("")).toBe("");
  });

  it("rejects a tampered ciphertext", async () => {
    const ciphertext = await encryptString("Rekha Devi");
    const bytes = Uint8Array.from(atob(ciphertext.slice(PREFIX.length)), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    const tampered = PREFIX + btoa(String.fromCharCode(...bytes));

    await expect(decryptString(tampered)).rejects.toThrow();
  });

  it("fails closed when the device is locked", async () => {
    setDataKey(null);
    await expect(encryptString("Rekha")).rejects.toBeInstanceOf(DeviceLockedError);
    await expect(blindIndex("Rekha")).rejects.toBeInstanceOf(DeviceLockedError);
  });
});

describe("blind index", () => {
  beforeEach(async () => {
    setDataKey(await freshKey());
  });

  afterEach(() => {
    setDataKey(null);
  });

  it("is deterministic and normalises case and whitespace", async () => {
    const a = await blindIndex("Rekha   Devi");
    const b = await blindIndex("  rekha devi ");
    expect(a).toBe(b);
    expect(a).not.toContain("Rekha");
  });

  it("separates different values and scopes", async () => {
    const base = await blindIndex("f1|Rekha Devi");
    expect(await blindIndex("f1|Sunita Devi")).not.toBe(base);
    expect(await blindIndex("f2|Rekha Devi")).not.toBe(base);
  });

  it("changes when the data key changes", async () => {
    const before = await blindIndex("f1|Rekha Devi");
    setDataKey(await freshKey());
    const after = await blindIndex("f1|Rekha Devi");
    expect(after).not.toBe(before);
  });
});
