/**
 * Device lock for the pilot build.
 *
 * A 6-digit PIN protects everything stored on the phone. The PIN is never
 * stored in plain text: PBKDF2 (600 000 iterations, SHA-256) derives a 256-bit
 * key-encryption key (KEK) from the PIN and a random salt. The KEK does not
 * encrypt patient data directly; it wraps a random data-encryption key (DEK),
 * which is what `crypto.ts` uses for fields. Changing the PIN only re-wraps the
 * DEK, so re-keying never risks the records already on the device.
 *
 * Only the salt, a verification hash and the wrapped DEK are persisted. The
 * DEK lives in memory and is cleared on lock or app kill.
 *
 * Ten consecutive wrong PINs wipe the device. The app also locks after three
 * minutes in the background.
 *
 * ---------------------------------------------------------------------------
 * Pilot build: the PIN is currently switched off
 * ---------------------------------------------------------------------------
 * The block/district pilot asked for no lock screen on the shared phones, so a
 * device without a PIN keeps its data key in app-private storage and loads it
 * at startup (`unlockWithDeviceKey`). Field names stay encrypted at rest, but
 * there is no user secret in front of the key: this is a deliberate, temporary
 * pilot posture, not the Phase 5A design. A device that still has a PIN is
 * asked for it once, then `removePin()` drops the PIN and keeps the same data
 * key, so records already written stay readable. Re-enable the PIN gate before
 * any real patient data lands on a device.
 */

import { getDataKey, setDataKey } from "./crypto";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 10;
const AUTO_LOCK_MS = 3 * 60 * 1000;
const PBKDF2_ITERATIONS = 600_000;
const IV_BYTES = 12;

const SALT_KEY = "hrp-pin-salt";
const VERIFY_KEY = "hrp-pin-verify";
const ATTEMPTS_KEY = "hrp-pin-attempts";
const DEK_KEY = "hrp-dek-wrapped";
/** Device-held data key, used while the PIN is switched off for the pilot. */
const DEVICE_KEY = "hrp-dek-device";

let locked = true;
let lastHiddenAt = 0;
let registered = false;

const listeners = new Set<(locked: boolean) => void>();

function notify(): void {
  for (const cb of listeners) cb(locked);
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i] ?? 0);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function deriveBits(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
}

async function sha256(data: ArrayBuffer): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

async function importKek(bits: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bits, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * The DEK is extractable because changing the PIN needs its raw bytes to wrap
 * it under the new KEK. Any script that could call `exportKey` already runs
 * with access to the decrypted data, so this adds no practical exposure.
 */
async function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function wrapDek(kek: CryptoKey, raw: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    kek,
    raw as BufferSource
  );
  const payload = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), IV_BYTES);
  return toBase64(payload);
}

async function unwrapDek(kek: CryptoKey, wrapped: string): Promise<Uint8Array> {
  const payload = fromBase64(wrapped);
  const iv = payload.slice(0, IV_BYTES);
  const ciphertext = payload.slice(IV_BYTES);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    kek,
    ciphertext as BufferSource
  );
  return new Uint8Array(raw);
}

/**
 * Store a new salt/verifier for `pin` and wrap `dekRaw` under it. Reused by
 * first-time setup and by a PIN change so the data key survives.
 */
async function installPin(pin: string, dekRaw: Uint8Array): Promise<CryptoKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(pin, salt);
  const hash = await sha256(bits);
  const kek = await importKek(bits);
  const wrapped = await wrapDek(kek, dekRaw);

  try {
    localStorage.setItem(SALT_KEY, toBase64(salt));
    localStorage.setItem(VERIFY_KEY, toBase64(hash));
    localStorage.setItem(ATTEMPTS_KEY, "0");
    localStorage.setItem(DEK_KEY, wrapped);
  } catch {
    throw new Error("Could not store PIN data");
  }

  const key = await importDataKey(dekRaw);
  setDataKey(key);
  locked = false;
  notify();
  return key;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isPinSet(): boolean {
  try {
    return !!localStorage.getItem(SALT_KEY) && !!localStorage.getItem(VERIFY_KEY);
  } catch {
    return false;
  }
}

export function isLocked(): boolean {
  return isPinSet() && locked;
}

/**
 * Load the device-held data key, creating one on first run.
 *
 * Used while the PIN is switched off for the pilot. The key still encrypts
 * identifiers in IndexedDB; it just is not gated behind a user secret.
 */
export async function unlockWithDeviceKey(): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    raw = stored ? fromBase64(stored) : crypto.getRandomValues(new Uint8Array(32));
    if (!stored) localStorage.setItem(DEVICE_KEY, toBase64(raw));
  } catch {
    // Storage unavailable: keep this session working with an ephemeral key
    // rather than refusing to open the app.
    raw = crypto.getRandomValues(new Uint8Array(32));
  }
  const key = await importDataKey(raw);
  setDataKey(key);
  locked = false;
  notify();
  return key;
}

/** True when this device already holds its key without a PIN. */
export function hasDeviceKey(): boolean {
  try {
    return localStorage.getItem(DEVICE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Drop the PIN but keep the data key.
 *
 * Called once the user has verified the existing PIN (or when the session is
 * already unlocked), so records written under the old key stay readable.
 */
export async function removePin(): Promise<void> {
  const current = getDataKey();
  if (!current) throw new Error("Unlock the device before removing the PIN");

  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", current));
  try {
    localStorage.setItem(DEVICE_KEY, toBase64(raw));
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(VERIFY_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(DEK_KEY);
  } catch {
    throw new Error("Could not update the device key");
  }

  locked = false;
  notify();
}

export function getDerivedKey(): CryptoKey | null {
  return getDataKey();
}

export function onLockChange(cb: (locked: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getFailedAttempts(): number {
  try {
    return Number(localStorage.getItem(ATTEMPTS_KEY) ?? "0");
  } catch {
    return 0;
  }
}

/**
 * First-time PIN setup. Generates a fresh data key and wraps it under the PIN.
 * Returns the data key for the encryption layer.
 */
export async function setupPin(pin: string): Promise<CryptoKey> {
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    throw new Error("PIN must be exactly 6 digits");
  }
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));
  return installPin(pin, dekRaw);
}

/**
 * Verify a PIN. On success, unwraps the data key into memory and unlocks.
 * On failure, increments the attempt counter; at MAX_ATTEMPTS, wipes.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  if (!isPinSet()) return false;

  const saltB64 = localStorage.getItem(SALT_KEY);
  const verifyB64 = localStorage.getItem(VERIFY_KEY);
  if (!saltB64 || !verifyB64) return false;

  const salt = fromBase64(saltB64);
  const storedHash = fromBase64(verifyB64);

  const bits = await deriveBits(pin, salt);
  const computedHash = await sha256(bits);

  if (constantTimeEqual(computedHash, storedHash)) {
    try {
      localStorage.setItem(ATTEMPTS_KEY, "0");
    } catch {
      /* ignore */
    }

    const kek = await importKek(bits);
    let wrapped = localStorage.getItem(DEK_KEY);
    let dekRaw: Uint8Array;
    if (wrapped) {
      dekRaw = await unwrapDek(kek, wrapped);
    } else {
      // A device that set a PIN before wrapping existed has no DEK yet. Make
      // one now; no field has been encrypted under an older key.
      dekRaw = crypto.getRandomValues(new Uint8Array(32));
      wrapped = await wrapDek(kek, dekRaw);
      try {
        localStorage.setItem(DEK_KEY, wrapped);
      } catch {
        /* the key still works for this session */
      }
    }

    const key = await importDataKey(dekRaw);
    setDataKey(key);
    locked = false;
    notify();
    return true;
  }

  // Failure — increment attempts
  const attempts = getFailedAttempts() + 1;
  try {
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  } catch {
    /* ignore */
  }

  if (attempts >= MAX_ATTEMPTS) {
    await wipeDevice();
  }

  notify();
  return false;
}

/**
 * Change the PIN. Requires the old PIN, then re-wraps the existing data key so
 * records already on the device stay readable.
 */
export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  if (newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) {
    throw new Error("New PIN must be exactly 6 digits");
  }

  const success = await verifyPin(oldPin);
  if (!success) return false;

  const current = getDataKey();
  if (!current) return false;

  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", current));
  await installPin(newPin, raw);
  return true;
}

/**
 * Lock the device. Clears the data key from memory.
 *
 * With the PIN switched off for the pilot there is no way to derive the key
 * again, so this is a no-op instead of a one-way trip into an empty app.
 */
export function lock(): void {
  if (!isPinSet()) return;
  setDataKey(null);
  locked = true;
  notify();
}

/**
 * Wipe all data on the device. Called after 10 failed PIN attempts or
 * on explicit "clear local data" from Settings.
 */
export async function wipeDevice(): Promise<void> {
  try {
    // Clear IndexedDB via Dexie
    const { clearAllLocalData } = await import("./db/repositories");
    await clearAllLocalData();
  } catch {
    // Best effort — continue even if DB clear fails
  }

  // Clear all storage (this also removes the wrapped data key)
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }

  // Clear caches
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }

  setDataKey(null);
  locked = true;
  notify();

  // localStorage.clear() also removed the device-held key. Without a PIN the
  // app would have no key at all, so replace it for the next session.
  if (!isPinSet()) await unlockWithDeviceKey();
}

/**
 * Register auto-lock on background. Call once at startup.
 */
export function registerAutoLock(): void {
  if (registered) return;
  registered = true;

  document.addEventListener("visibilitychange", () => {
    // Pilot build: no PIN means no lock state to restore.
    if (!isPinSet()) return;
    if (document.visibilityState === "hidden") {
      lastHiddenAt = Date.now();
    } else if (document.visibilityState === "visible") {
      if (lastHiddenAt > 0 && Date.now() - lastHiddenAt > AUTO_LOCK_MS) {
        lock();
      }
      lastHiddenAt = 0;
    }
  });
}

// Auto-register on import (browser only)
if (typeof document !== "undefined") {
  registerAutoLock();
}
