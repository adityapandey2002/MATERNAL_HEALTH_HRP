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
