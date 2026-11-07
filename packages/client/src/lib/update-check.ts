export interface UpdateInfo {
  available: boolean;
  version: string;
  downloadUrl: string | null;
  sha256: string | null;
}

function numericParts(version: string): number[] {
  return version.split(/[.+-]/).map((part) => Number.parseInt(part, 10));
}

/**
 * True when `candidate` is a higher release than `current`.
 *
 * A stale build is worse than a missing one: if a server still advertises
 * 1.0.3 to a phone running 1.0.5, a plain "different" check would invite the
 * ANM to downgrade. Compare the numeric segments instead, so only forward
 * moves are offered. Suffixes such as `-pilot` are ignored.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = numericParts(candidate);
  const b = numericParts(current);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = Number.isFinite(a[index]) ? (a[index] ?? 0) : 0;
    const right = Number.isFinite(b[index]) ? (b[index] ?? 0) : 0;
    if (left !== right) return left > right;
  }

  return false;
}

/**
 * Checks whether a newer app version is available.
 *
 * The sideloaded APK cannot be updated silently, so this only reports
 * availability; the UI offers a download link the user taps once.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
  try {
    const response = await fetch(
      `${(import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "")}/version`,
      { method: "GET" }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      version?: string;
      apkDownloadUrl?: string | null;
      apkSha256?: string | null;
    };
    const latest = data.version ?? current;
    // Equal or older means this build is current: never prompt a downgrade.
    if (!isNewerVersion(latest, current)) return null;
    return {
      available: true,
      version: latest,
      downloadUrl: data.apkDownloadUrl ?? null,
      sha256: data.apkSha256 ?? null,
    };
  } catch {
    // Offline or server unreachable: no update prompt.
    return null;
  }
}
