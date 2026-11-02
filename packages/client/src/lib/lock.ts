/**
 * Device lock for the pilot build.
 *
 * A 6-digit PIN protects everything stored on the phone. The PIN is never
 * stored in plain text: PBKDF2 (600 000 iterations, SHA-256) derives a 256-bit
 * key from the PIN and a random salt. Only the salt and a verification hash
 * are persisted; the key lives in memory and is cleared on lock or app kill.
 *
 * Ten consecutive wrong PINs wipe the device. The app also locks after three
 * minutes in the background.
 */

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 10;
const AUTO_LOCK_MS = 3 * 60 * 1000;
const PBKDF2_ITERATIONS = 600_000;

const SALT_KEY = "hrp-pin-salt";
const VERIFY_KEY = "hrp-pin-verify";
const ATTEMPTS_KEY = "hrp-pin-attempts";

let unlockedKey: CryptoKey | null = null;
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
  for (let i = 0; i < binary.length; i++) (bytes as Uint8Array)[i] = binary.charCodeAt(i);
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

export function getDerivedKey(): CryptoKey | null {
  return unlockedKey;
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
 * Create a new PIN. Stores a random salt and a verification hash derived
 * from the PIN. Returns the derived CryptoKey for use by the encryption layer.
 */
export async function setupPin(pin: string): Promise<CryptoKey> {
  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    throw new Error("PIN must be exactly 6 digits");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(pin, salt);
  const hash = await sha256(bits);

  try {
    localStorage.setItem(SALT_KEY, toBase64(salt));
    localStorage.setItem(VERIFY_KEY, toBase64(hash));
    localStorage.setItem(ATTEMPTS_KEY, "0");
  } catch {
    throw new Error("Could not store PIN data");
  }

  const key = await crypto.subtle.importKey("raw", bits, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);

  unlockedKey = key;
  locked = false;
  notify();
  return key;
}

/**
 * Verify a PIN. On success, stores the derived key in memory and unlocks.
 * On failure, increments the attempt counter; at MAX_ATTEMPTS, wipes.
 * Returns true on success, false on failure.
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
    // Success — reset attempts, store key, unlock
    try {
      localStorage.setItem(ATTEMPTS_KEY, "0");
    } catch {
      /* ignore */
    }
    const key = await crypto.subtle.importKey(
      "raw",
      bits,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    unlockedKey = key;
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
 * Change the PIN. Requires the old PIN to be correct first.
 */
export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  if (newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) {
    throw new Error("New PIN must be exactly 6 digits");
  }
  // Verify old PIN first (but don't unlock if it was locked)
  const wasLocked = locked;
  const success = await verifyPin(oldPin);
  if (!success) return false;

  // Re-lock if it was locked before
  if (wasLocked) {
    locked = true;
    // Keep the key in memory briefly for re-encryption (5A.2 will use it)
  }

  await setupPin(newPin);
  return true;
}

/**
 * Lock the device. Clears the derived key from memory.
 */
export function lock(): void {
  unlockedKey = null;
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

  // Clear all storage
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

  unlockedKey = null;
  locked = true;
  notify();
}

/**
 * Register auto-lock on background. Call once at startup.
 */
export function registerAutoLock(): void {
  if (registered) return;
  registered = true;

  document.addEventListener("visibilitychange", () => {
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
