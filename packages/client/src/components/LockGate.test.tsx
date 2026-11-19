import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LockGate } from "./LockGate";

vi.mock("../lib/lock", () => ({
  isPinSet: vi.fn(),
  isLocked: vi.fn(),
  onLockChange: vi.fn(() => () => {}),
  registerAutoLock: vi.fn(),
  verifyPin: vi.fn(),
  getFailedAttempts: vi.fn(() => 0),
  unlockWithDeviceKey: vi.fn(async () => {}),
  removePin: vi.fn(async () => {}),
}));

import { isLocked, isPinSet, removePin, unlockWithDeviceKey, verifyPin } from "../lib/lock";

describe("LockGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPinSet).mockReturnValue(false);
    vi.mocked(isLocked).mockReturnValue(false);
    vi.mocked(verifyPin).mockResolvedValue(true);
    vi.mocked(unlockWithDeviceKey).mockResolvedValue(undefined as never);
    vi.mocked(removePin).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays out of the way in a demo build", () => {
    render(
      <LockGate>
        <p>Field home</p>
      </LockGate>
    );

    expect(screen.getByText("Field home")).toBeInTheDocument();
    expect(screen.queryByText("Create your PIN")).not.toBeInTheDocument();
  });

  it("loads a device key and renders straight away in a pilot build", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");

    render(
      <LockGate>
        <p>Field home</p>
      </LockGate>
    );

    expect(await screen.findByText("Field home")).toBeInTheDocument();
    expect(unlockWithDeviceKey).toHaveBeenCalled();
    expect(screen.queryByText("Create your PIN")).not.toBeInTheDocument();
  });

  it("asks for the old PIN once on a device that still has one, then drops it", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "false");
    vi.mocked(isPinSet).mockReturnValue(true);
    vi.mocked(isLocked).mockReturnValue(true);

    render(
      <LockGate>
        <p>Field home</p>
      </LockGate>
    );

    expect(screen.getByText("Enter your PIN")).toBeInTheDocument();
    expect(screen.queryByText("Field home")).not.toBeInTheDocument();

    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }

    expect(await screen.findByText("Field home")).toBeInTheDocument();
    expect(verifyPin).toHaveBeenCalledWith("123456");
    expect(removePin).toHaveBeenCalled();
  });
});
