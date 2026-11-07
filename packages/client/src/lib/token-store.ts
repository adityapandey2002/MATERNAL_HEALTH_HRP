/**
 * Native refresh-token storage.
 *
 * The Android build has no httpOnly cookie, so the server returns the refresh
 * token in the response body. That token is a long-lived credential: it is
 * encrypted with the PIN data key before it touches localStorage. Web builds
 * never reach this module's storage path because the cookie carries the token.
 */

import { decryptString, encryptString, hasDataKey, isEncryptionRequired } from "./crypto";

const KEY = "hrp-native-refresh-token";

/** Key for the short-lived access token; shared with the API client. */
export const ACCESS_TOKEN_KEY = "accessToken";

/** True when this install holds a session that can be refreshed. */
export function hasAccessToken(): boolean {
  try {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
  } catch {
    return false;
  }
}

export async function storeRefreshToken(token: string): Promise<void> {
  if (hasDataKey()) {
    localStorage.setItem(KEY, await encryptString(token));
    return;
  }
  if (isEncryptionRequired()) {
    // Pilot build without an unlocked key must not persist the credential.
    throw new Error("Unlock the device before signing in");
  }
  localStorage.setItem(KEY, token);
}

export async function readRefreshToken(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return await decryptString(raw);
  } catch {
    return null;
  }
}

export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Drop the short-lived access token without touching the refresh token. */
export function clearAccessToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Storage unavailable: the reload after sign-out still ends the session.
  }
}
