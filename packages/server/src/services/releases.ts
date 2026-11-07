/**
 * Latest published Android release.
 *
 * The field app checks this on launch and offers the APK for download when the
 * installed build is older. Deriving the version from GitHub instead of an
 * environment variable keeps the answer honest: `APP_VERSION` on the server and
 * the `version_name` baked into an APK are set by different people at different
 * times, and a stale value either hides a real update or advertises a release
 * page that does not exist.
 *
 * The response is cached so a busy server does not spend the anonymous GitHub
 * API budget (60 requests/hour per egress IP).
 */

const DEFAULT_REPO = "adityapandey2002/MATERNAL_HEALTH_HRP";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

export interface LatestRelease {
  /** Version without the leading `v`, e.g. `1.0.5-pilot`. */
  version: string;
  /** Direct browser download URL for the release APK. */
  apkDownloadUrl: string | null;
}

interface GitHubAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubRelease {
  tag_name?: string;
  assets?: GitHubAsset[];
}

let cache: { expiresAt: number; value: LatestRelease | null } | null = null;

/** Clears the memoised response. Used by tests and the manual refresh path. */
export function resetReleaseCache(): void {
  cache = null;
}

function toRelease(payload: GitHubRelease, repo: string): LatestRelease | null {
  const version = (payload.tag_name ?? "").replace(/^v/, "").trim();
  if (!version) return null;

  const apk = (payload.assets ?? []).find(
    (asset) => asset.name?.toLowerCase().endsWith(".apk") && asset.browser_download_url
  );

  // Without a direct APK asset the release page still lists the files, so the
  // banner keeps a working link instead of offering a dead download.
  return {
    version,
    apkDownloadUrl: apk?.browser_download_url ?? `https://github.com/${repo}/releases/latest`,
  };
}

/**
 * Returns the newest GitHub release, or `null` when GitHub cannot be reached.
 * Callers are expected to have a fallback: a failed lookup must never take the
 * version endpoint down.
 */
export async function getLatestRelease(
  options: { repo?: string; fetchImpl?: typeof fetch; now?: number } = {}
): Promise<LatestRelease | null> {
  const now = options.now ?? Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const repo = options.repo ?? DEFAULT_REPO;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "matru-suraksha-server",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      cache = { expiresAt: now + FAILURE_TTL_MS, value: null };
      return null;
    }

    const value = toRelease((await response.json()) as GitHubRelease, repo);
    cache = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  } catch {
    // Offline, DNS failure or timeout: remember the miss briefly so a launch
    // burst does not hammer GitHub, then try again.
    cache = { expiresAt: now + FAILURE_TTL_MS, value: null };
    return null;
  }
}
