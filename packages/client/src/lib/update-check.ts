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
  const a = numericParts(candidate.replace(/^v/i, ""));
  const b = numericParts(current.replace(/^v/i, ""));
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const left = Number.isFinite(a[index]) ? (a[index] ?? 0) : 0;
    const right = Number.isFinite(b[index]) ? (b[index] ?? 0) : 0;
    if (left !== right) return left > right;
  }

  return false;
}

const GITHUB_REPO = "adityapandey2002/MATERNAL_HEALTH_HRP";

async function fetchGitHubRelease(): Promise<UpdateInfo | null> {
  const current = (import.meta.env.VITE_APP_VERSION ?? "0.0.0").replace(/^v/i, "").trim();
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      tag_name?: string;
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const version = (data.tag_name ?? "").replace(/^v/i, "").trim();
    if (!version || !isNewerVersion(version, current)) return null;
    const apk = (data.assets ?? []).find(
      (asset) => asset.name?.toLowerCase().endsWith(".apk") && asset.browser_download_url
    );
    const downloadUrl = apk?.browser_download_url ?? null;
    if (!downloadUrl) return null;
    return { available: true, version, downloadUrl, sha256: null };
  } catch {
    return null;
  }
}

/**
 * Checks whether a newer app version is available.
 *
 * The sideloaded APK cannot be updated silently, so this only reports
 * availability; the UI offers a download link the user taps once.
 *
 * The server is the primary source (it caches the GitHub answer), but if it is
 * asleep, misconfigured, or returns an unusable version, we fall back to
 * asking GitHub directly so a phone is never stuck on an old build because of
 * a server hiccup.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = (import.meta.env.VITE_APP_VERSION ?? "0.0.0").replace(/^v/i, "").trim();
  try {
    const response = await fetch(
      `${(import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "")}/version`,
      { method: "GET" }
    );
    if (response.ok) {
      const data = (await response.json()) as {
        version?: string;
        apkDownloadUrl?: string | null;
        apkSha256?: string | null;
      };
      const latest = (data.version ?? current).replace(/^v/i, "").trim() || current;
      // Repair a server that advertised a doubled "v" (vv1.0.9) in the path.
      const downloadUrl = (data.apkDownloadUrl ?? null)?.replace(/\/vv(?=[0-9])/, "/v") ?? null;
      if (isNewerVersion(latest, current) && downloadUrl) {
        return {
          available: true,
          version: latest,
          downloadUrl,
          sha256: data.apkSha256 ?? null,
        };
      }
    }
  } catch {
    // Server asleep or unreachable: try GitHub directly below.
  }

  return fetchGitHubRelease();
}
