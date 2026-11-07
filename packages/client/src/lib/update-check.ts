import { api } from "./api";

export interface UpdateInfo {
  available: boolean;
  version: string;
  downloadUrl: string | null;
  sha256: string | null;
}

/**
 * Checks whether a newer app version is available.
 *
 * The sideloaded APK cannot be updated silently, so this only reports
 * availability; the UI offers a download link the user taps once.
 *
 * Comparison is a simple string inequality against the version baked into the
 * build (`VITE_APP_VERSION`). Any difference means "update available".
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const current = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "0.0.0";
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
    if (latest === current) return null;
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
