/**
 * Stable identifier for this install.
 *
 * The server has to be able to end one phone's access without disabling the
 * account (a replacement ANM inherits the area and signs in on a new device).
 * A random UUID generated before the first sign-in gives it something to point
 * at that survives re-login, PIN changes and app updates.
 *
 * The value is not a secret: it authenticates nothing on its own. It only lets
 * the district say "that handset, not this one".
 */

const KEY = "hrp-device-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newId(): string {
  // `randomUUID` needs a secure context, which both the HTTPS PWA and the
  // Capacitor `https://localhost` origin are.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** This install's id, creating and persisting one on first call. */
export function getDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && UUID.test(existing)) return existing;

    const created = newId();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    // Private mode or a full quota: fall back to no header rather than
    // blocking sign-in. The device simply cannot be revoked remotely.
    return null;
  }
}

/** Platform string the registry stores, derived from the build. */
export function getDevicePlatform(): "android" | "web" {
  return import.meta.env.VITE_NATIVE_APP === "true" ? "android" : "web";
}

/** Test seam: forget the id so the next call generates a new one. */
export function clearDeviceId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
