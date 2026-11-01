import type { User } from "@hrp/shared";

const KEY = "hrp-cached-session";

export interface CachedSession {
  user: User;
  cachedAt: number;
}

export function getCachedSession(): CachedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed || typeof parsed !== "object" || !parsed.user || !parsed.cachedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedSession(user: User): void {
  try {
    const payload: CachedSession = { user, cachedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable (private mode, quota). Offline session then
    // degrades gracefully to the least-privileged role.
  }
}

export function clearCachedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
