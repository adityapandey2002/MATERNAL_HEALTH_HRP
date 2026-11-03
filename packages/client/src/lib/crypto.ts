/**
 * Field-level encryption for data at rest on the device.
 *
 * IndexedDB is not encrypted by the WebView, so anything the app persists is
 * readable by a forensic tool or a rooted device. The PIN (see `lock.ts`) is
 * used to unlock a random 256-bit data key; that key encrypts the direct
 * identifiers and free-text notes before they reach Dexie.
 *
 * - Cipher: AES-256-GCM with a fresh 96-bit IV per value. The GCM tag makes
 *   tampering detectable on read.
 * - Format: `enc:v1:<base64(iv || ciphertext || tag)>`. Values without the
 *   prefix are legacy plaintext and are returned unchanged, which lets a
 *   device migrate in place.
 * - Search: HMAC-SHA-256 over a normalised value gives an equality index
 *   without storing the value itself. The HMAC key is derived from the data
 *   key with HKDF, so the same key that decrypts also answers exact matches.
 *
 * The key lives only in memory. When the device locks, every call here throws
 * `DeviceLockedError` rather than silently writing plaintext.
 */

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const HKDF_INFO = "hrp-blind-index-v1";

export class DeviceLockedError extends Error {
  constructor() {
    super("Device is locked; unlock with the PIN before reading or writing data");
    this.name = "DeviceLockedError";
  }
}

let dataKey: CryptoKey | null = null;
let hmacKey: CryptoKey | null = null;
let hmacForKey: CryptoKey | null = null;

// ---------------------------------------------------------------------------
// Key lifecycle
// ---------------------------------------------------------------------------

/** Called by the lock screen when the PIN is verified. */
export function setDataKey(key: CryptoKey | null): void {
  dataKey = key;
  hmacKey = null;
  hmacForKey = null;
}

export function hasDataKey(): boolean {
  return dataKey !== null;
}

/** The in-memory data key, or null while locked. */
export function getDataKey(): CryptoKey | null {
  return dataKey;
}

/**
 * Whether the build must encrypt. Demo builds carry synthetic data only and
 * may run without a PIN; pilot builds (`VITE_DEMO_MODE=false`) must not write
 * patient data before the key is unlocked.
 */
export function isEncryptionRequired(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "false";
}

/** True when the app may read or write local data right now. */
export function canUseLocalData(): boolean {
  return hasDataKey() || !isEncryptionRequired();
}

export function requireDataKey(): CryptoKey {
  if (!dataKey) throw new DeviceLockedError();
  return dataKey;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// ---------------------------------------------------------------------------
// String / JSON encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt one string. Empty strings and `null` pass through: there is nothing
 * to protect and the UI already treats them as absent.
 */
export async function encryptNullable(value: string | null | undefined): Promise<string | null> {
  if (value === null || value === undefined || value === "") return value ?? null;
  return encryptString(value);
}

export async function encryptString(plain: string): Promise<string> {
  if (plain === "") return plain;
  const key = requireDataKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain)
  );
  const payload = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), IV_BYTES);
  return PREFIX + toBase64(payload);
}

export async function decryptNullable(value: string | null | undefined): Promise<string | null> {
  if (value === null || value === undefined) return null;
  return decryptString(value);
}

/**
 * Decrypt one value. Legacy plaintext (no prefix) is returned unchanged so a
 * device that has not migrated yet still renders; `migrateLocalData()` rewrites
 * those rows under the key.
 */
export async function decryptString(value: string): Promise<string> {
  if (!isEncryptedValue(value)) return value;
  const key = requireDataKey();
  const payload = fromBase64(value.slice(PREFIX.length));
  const iv = payload.slice(0, IV_BYTES);
  const ciphertext = payload.slice(IV_BYTES);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return new TextDecoder().decode(plain);
}

/** Encrypt an arbitrary JSON value for storage in a queue payload or conflict row. */
export async function encryptJson(value: unknown): Promise<string> {
  return encryptString(JSON.stringify(value));
}

/** Decrypt a JSON value. Plaintext objects (legacy rows) pass through. */
export async function decryptJson<T>(value: unknown): Promise<T> {
  if (!isEncryptedValue(value)) return value as T;
  return JSON.parse(await decryptString(value)) as T;
}

// ---------------------------------------------------------------------------
// Blind index
// ---------------------------------------------------------------------------

export function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function getHmacKey(): Promise<CryptoKey> {
  const key = requireDataKey();
  if (hmacKey && hmacForKey === key) return hmacKey;

  // HKDF keeps the index key separate from the AES key: recovering one does
  // not weaken the other.
  const raw = await crypto.subtle.exportKey("raw", key);
  const hkdf = await crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  const derived = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as BufferSource,
      info: new TextEncoder().encode(HKDF_INFO) as BufferSource,
    },
    hkdf,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );

  hmacKey = derived;
  hmacForKey = key;
  return derived;
}

/**
 * Deterministic equality token for `value`. Callers add their own scope (for
 * example the facility id) before hashing so the same name at two facilities
 * does not produce the same token.
 */
export async function blindIndex(value: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(normaliseName(value))
  );
  return toBase64(new Uint8Array(signature));
}
