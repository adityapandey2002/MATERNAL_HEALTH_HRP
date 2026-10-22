import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

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

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("no body");
    },
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  // jsdom does not implement navigation; replace it so the logout redirect is
  // observable without printing "Not implemented: navigation" noise.
  Object.defineProperty(window, "location", {
    value: { href: "/", pathname: "/" },
    writable: true,
    configurable: true,
  });
});

describe("request", () => {
  it("only sends a JSON content type when there is a body", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    await api.patients.delete("11111111-1111-4111-8111-111111111111");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/patients/11111111-1111-4111-8111-111111111111");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("sends JSON with a body-bearing request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p1" }, 201));

    await api.patients.create({
      name: "Asha Patel",
      age: 24,
    } as never);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "Asha Patel" });
  });

  it("attaches the bearer token and sends cookies", async () => {
    store.set("accessToken", "token-123");
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p1" }));

    await api.patients.get("p1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-123" });
    expect(init.credentials).toBe("include");
  });

  it("omits the Authorization header when there is no token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p1" }));

    await api.patients.get("p1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("throws ApiError with the server message on a failed request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Validation failed" }, 400));

    const error = await api.patients.get("p1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "Validation failed" });
  });

  it("falls back to a generic message when the body has none", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    const error = await api.patients.get("p1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).toBe("Request failed");
  });

  it("refreshes the access token once on 401 and retries", async () => {
    store.set("accessToken", "expired");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: "p1", name: "Asha" }));

    const result = await api.patients.get("p1");

    expect(result).toMatchObject({ id: "p1" });
    expect(store.get("accessToken")).toBe("fresh-token");

    const refreshCall = fetchMock.mock.calls[1];
    expect(refreshCall[0]).toBe("/api/auth/refresh");
    expect(refreshCall[1]).toMatchObject({ method: "POST", credentials: "include" });

    const retried = fetchMock.mock.calls[2];
    expect(retried[1].headers).toMatchObject({ Authorization: "Bearer fresh-token" });
  });

  it("never persists a refresh token in localStorage", async () => {
    store.set("accessToken", "expired");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: "fresh-token", refreshToken: "leaked" }))
      .mockResolvedValueOnce(jsonResponse({ id: "p1" }));

    await api.patients.get("p1");

    for (const key of store.keys()) {
      expect(store.get(key)).not.toBe("leaked");
    }
    expect(store.has("refreshToken")).toBe(false);
  });

  it("clears the session and throws when the refresh fails", async () => {
    store.set("accessToken", "expired");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));

    await expect(api.patients.get("p1")).rejects.toBeInstanceOf(ApiError);
    expect(store.size).toBe(0);
  });
});

describe("query building", () => {
  it("serialises defined filters and skips undefined ones", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }));

    await api.patients.list({ riskLevel: "RED", page: 2, limit: 10, search: undefined });

    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url as string, "http://localhost").searchParams;
    expect(params.get("riskLevel")).toBe("RED");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("10");
    expect(params.has("search")).toBe(false);
  });

  it("passes the sync cursor as an ISO timestamp", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ serverTimestamp: new Date().toISOString() }));

    await api.sync.pull(new Date("2026-05-01T12:00:00.000Z"));

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sync/pull?since=2026-05-01T12:00:00.000Z");
  });

  it("omits the cursor when none is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await api.sync.pull();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/sync/pull");
  });
});
