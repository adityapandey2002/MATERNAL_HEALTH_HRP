import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  Object.defineProperty(window, "location", {
    value: { href: "/", pathname: "/" },
    writable: true,
    configurable: true,
  });
});

describe("device headers", () => {
  it("sends an X-Device-Id header derived from storage", async () => {
    store.set("hrp-device-id", "11111111-1111-4111-8111-111111111111");
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p1" }));

    await api.patients.get("p1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({
      "X-Device-Id": "11111111-1111-4111-8111-111111111111",
    });
  });

  it("generates and persists a device id when none exists", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p1" }));

    await api.patients.get("p1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Device-Id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(store.get("hrp-device-id")).toBe(init.headers["X-Device-Id"]);
  });

  it("revokes the device and redirects on a DEVICE_REVOKED 401", async () => {
    store.set("hrp-device-id", "11111111-1111-4111-8111-111111111111");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "DEVICE_REVOKED", message: "Device revoked" }, 401)
    );

    await expect(api.patients.get("p1")).rejects.toBeInstanceOf(ApiError);

    expect(window.location.href).toBe("/login");
  });
});
