import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestRelease, resetReleaseCache } from "./releases.js";

const REPO = "example/repo";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  resetReleaseCache();
});

describe("getLatestRelease", () => {
  it("returns the tag without its v prefix and the APK asset URL", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        tag_name: "v1.0.5-pilot",
        assets: [
          { name: "matru-suraksha-1.0.5-pilot.apk.sha256", browser_download_url: "https://x/sha" },
          { name: "matru-suraksha-1.0.5-pilot.apk", browser_download_url: "https://x/app.apk" },
        ],
      })
    );

    await expect(
      getLatestRelease({ repo: REPO, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).resolves.toEqual({
      version: "1.0.5-pilot",
      apkDownloadUrl: "https://x/app.apk",
    });
  });

  it("falls back to the release page when the release has no APK asset", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ tag_name: "v2.0.0", assets: [] }));

    const release = await getLatestRelease({
      repo: REPO,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(release?.apkDownloadUrl).toBe(`https://github.com/${REPO}/releases/latest`);
  });

  it("returns null when GitHub answers with an error status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));

    await expect(
      getLatestRelease({ repo: REPO, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).resolves.toBeNull();
  });

  it("returns null when the request throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(
      getLatestRelease({ repo: REPO, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).resolves.toBeNull();
  });

  it("caches a successful lookup until the TTL expires", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        tag_name: "v1.0.5-pilot",
        assets: [{ name: "app.apk", browser_download_url: "https://x/app.apk" }],
      })
    );
    const asFetch = fetchImpl as unknown as typeof fetch;

    await getLatestRelease({ repo: REPO, fetchImpl: asFetch, now: 1_000 });
    await getLatestRelease({ repo: REPO, fetchImpl: asFetch, now: 2_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await getLatestRelease({ repo: REPO, fetchImpl: asFetch, now: 1_000 + 10 * 60 * 1000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns null for a malformed payload", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ assets: [] }));

    await expect(
      getLatestRelease({ repo: REPO, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).resolves.toBeNull();
  });
});
