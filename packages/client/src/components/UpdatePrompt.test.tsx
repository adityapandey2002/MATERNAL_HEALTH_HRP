import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "./UpdatePrompt";

const state = vi.hoisted(() => ({
  trigger: null as null | (() => void),
  applyUpdate: vi.fn(),
}));

vi.mock("../utils/sw", () => ({
  onUpdateReady: (callback: () => void) => {
    state.trigger = callback;
    return () => {
      state.trigger = null;
    };
  },
  applyUpdate: state.applyUpdate,
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    state.trigger = null;
    state.applyUpdate.mockReset();
  });

  it("stays hidden until a new build is waiting", () => {
    render(<UpdatePrompt />);

    expect(screen.queryByText("A new version is ready")).not.toBeInTheDocument();
  });

  it("dismisses without reloading when the worker taps Later", () => {
    render(<UpdatePrompt />);

    act(() => state.trigger?.());
    fireEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(screen.queryByText("A new version is ready")).not.toBeInTheDocument();
    expect(state.applyUpdate).not.toHaveBeenCalled();
  });

  it("applies the waiting build only on an explicit tap", () => {
    render(<UpdatePrompt />);

    act(() => state.trigger?.());
    fireEvent.click(screen.getByRole("button", { name: "Reload now" }));

    expect(state.applyUpdate).toHaveBeenCalledTimes(1);
  });
});
