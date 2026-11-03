import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate } from "./update-check";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  },
  writable: true,
  configurable: true,
});

const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_APP_VERSION", "1.0.0");
  vi.stubEnv("VITE_API_URL", "https://api.example.com/api");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkForUpdate", () => {
  it("returns null when the server reports the same version", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "1.0.0", apkDownloadUrl: null, apkSha256: null }),
    } as Response);

    expect(await checkForUpdate()).toBeNull();
  });

  it("returns update info when a newer version is available", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        version: "1.0.1",
        apkDownloadUrl: "https://example.com/app.apk",
        apkSha256: "abc123",
      }),
    } as Response);

    const info = await checkForUpdate();
    expect(info).toMatchObject({
      available: true,
      version: "1.0.1",
      downloadUrl: "https://example.com/app.apk",
      sha256: "abc123",
    });
  });

  it("returns null when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await checkForUpdate()).toBeNull();
  });

  it("returns null when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response);
    expect(await checkForUpdate()).toBeNull();
  });
});