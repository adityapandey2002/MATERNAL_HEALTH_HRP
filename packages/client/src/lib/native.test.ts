import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/native.ts` talks to the Android bridge. In tests the bridge is mocked so
 * the lifecycle rules (drain on resume, guard a dirty form) can be asserted
 * without a device.
 */
const bridge = vi.hoisted(() => ({
  native: true,
  handlers: new Map<string, (payload: unknown) => void>(),
  minimizeApp: vi.fn(),
  drain: vi.fn(async () => {}),
  pullCohort: vi.fn(async () => {}),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => bridge.native },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (event: string, cb: (payload: unknown) => void) => {
      bridge.handlers.set(event, cb);
      return { remove: vi.fn() };
    }),
    minimizeApp: bridge.minimizeApp,
  },
}));

vi.mock("@capacitor/network", () => ({
  Network: {
    addListener: vi.fn(async (event: string, cb: (payload: unknown) => void) => {
      bridge.handlers.set(event, cb);
      return { remove: vi.fn() };
    }),
  },
}));

vi.mock("./sync/queue", () => ({ drain: bridge.drain }));
vi.mock("./sync/pull", () => ({ pullCohort: bridge.pullCohort }));

async function loadNative() {
  vi.resetModules();
  return import("./native");
}

function pressBack(): void {
  bridge.handlers.get("backButton")?.({ canGoBack: true });
}

describe("native lifecycle", () => {
  beforeEach(() => {
    bridge.native = true;
    bridge.handlers.clear();
    bridge.minimizeApp.mockReset();
    bridge.drain.mockClear();
    bridge.pullCohort.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("does not touch the Android bridge in a browser", async () => {
    bridge.native = false;
    const native = await loadNative();

    await native.registerNativeLifecycle();

    expect(bridge.handlers.size).toBe(0);
  });

  it("drains the queue and refreshes the cohort when the app resumes", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();

    bridge.handlers.get("appStateChange")?.({ isActive: false });
    expect(bridge.drain).not.toHaveBeenCalled();

    bridge.handlers.get("appStateChange")?.({ isActive: true });
    expect(bridge.drain).toHaveBeenCalledTimes(1);
    expect(bridge.pullCohort).toHaveBeenCalledTimes(1);
  });

  it("syncs when the phone regains a connection", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();

    bridge.handlers.get("networkStatusChange")?.({ connected: false });
    expect(bridge.drain).not.toHaveBeenCalled();

    bridge.handlers.get("networkStatusChange")?.({ connected: true });
    expect(bridge.drain).toHaveBeenCalledTimes(1);
  });

  it("registers the bridge only once", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    await native.registerNativeLifecycle();

    const app = await import("@capacitor/app");
    expect(app.App.addListener).toHaveBeenCalledTimes(2);
  });

  it("navigates back from a sub-screen", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    window.history.pushState({}, "", "/patients");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    pressBack();

    expect(back).toHaveBeenCalledTimes(1);
    expect(bridge.minimizeApp).not.toHaveBeenCalled();
  });

  it("keeps the app warm instead of closing it on the home screen", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    window.history.pushState({}, "", "/");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    pressBack();

    expect(back).not.toHaveBeenCalled();
    expect(bridge.minimizeApp).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding a dirty form", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    window.history.pushState({}, "", "/patients/new");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderHook(() => native.useUnsavedChangesGuard(true));
    pressBack();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });

  it("leaves once the worker confirms the discard", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    window.history.pushState({}, "", "/patients/new");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderHook(() => native.useUnsavedChangesGuard(true));
    pressBack();

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("does not guard a clean form", async () => {
    const native = await loadNative();
    await native.registerNativeLifecycle();
    window.history.pushState({}, "", "/patients/new");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm");

    renderHook(() => native.useUnsavedChangesGuard(false));
    pressBack();

    expect(confirm).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(1);
  });
});
