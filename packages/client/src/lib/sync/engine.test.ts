import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncNow, useSyncStatus } from "./engine";

const bridge = vi.hoisted(() => ({
  listeners: [] as ((status: unknown) => void)[],
  off: vi.fn(),
  drain: vi.fn(async () => {}),
  pullCohort: vi.fn(async () => {}),
  summary: {
    pending: 0,
    conflicts: 0,
    lastSync: null as string | null,
    lastError: null as string | null,
    online: true,
  },
}));

vi.mock("./queue", () => ({
  drain: bridge.drain,
  onSyncStatus: (cb: (status: unknown) => void) => {
    bridge.listeners.push(cb);
    cb(bridge.summary);
    return bridge.off;
  },
}));

vi.mock("./pull", () => ({ pullCohort: bridge.pullCohort }));

describe("sync engine", () => {
  beforeEach(() => {
    bridge.listeners = [];
    bridge.off.mockReset();
    bridge.drain.mockClear();
    bridge.pullCohort.mockClear();
  });

  it("publishes the current device status to a screen", async () => {
    bridge.summary = { ...bridge.summary, pending: 3, conflicts: 1 };

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => expect(result.current?.pending).toBe(3));
    expect(result.current?.conflicts).toBe(1);
  });

  it("stops listening when the screen unmounts", () => {
    const { unmount } = renderHook(() => useSyncStatus());

    unmount();

    expect(bridge.off).toHaveBeenCalledTimes(1);
  });

  it("pushes local edits before pulling the cohort", async () => {
    const order: string[] = [];
    bridge.drain.mockImplementation(async () => {
      order.push("push");
    });
    bridge.pullCohort.mockImplementation(async () => {
      order.push("pull");
    });

    await syncNow();

    expect(order).toEqual(["push", "pull"]);
  });
});
