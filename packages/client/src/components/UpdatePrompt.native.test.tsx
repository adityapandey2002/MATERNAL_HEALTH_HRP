import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate } from "../lib/update-check";
import { UpdatePrompt } from "./UpdatePrompt";

vi.mock("../lib/api", () => ({ IS_NATIVE_APP: true }));

vi.mock("../lib/update-check", () => ({
  checkForUpdate: vi.fn(),
}));

vi.mock("../utils/sw", () => ({
  applyUpdate: vi.fn(),
  onUpdateReady: vi.fn(),
}));

const checkForUpdateMock = vi.mocked(checkForUpdate);

beforeEach(() => {
  checkForUpdateMock.mockReset();
  sessionStorage.clear();
});

describe("UpdatePrompt on an APK build", () => {
  it("shows the newer version with a download action", async () => {
    checkForUpdateMock.mockResolvedValue({
      available: true,
      version: "1.0.6-pilot",
      downloadUrl: "https://example.com/app.apk",
      sha256: null,
    });

    render(<UpdatePrompt />);

    expect(await screen.findByText("Update available (v1.0.6-pilot)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download update" })).toBeInTheDocument();
  });

  it("stays hidden when the server has no download URL", async () => {
    checkForUpdateMock.mockResolvedValue({
      available: true,
      version: "1.0.6-pilot",
      downloadUrl: null,
      sha256: null,
    });

    render(<UpdatePrompt />);

    await waitFor(() => expect(checkForUpdateMock).toHaveBeenCalled());
    expect(screen.queryByText(/Update available/)).not.toBeInTheDocument();
  });

  it("does not re-show the same version after the user taps Later", async () => {
    checkForUpdateMock.mockResolvedValue({
      available: true,
      version: "1.0.6-pilot",
      downloadUrl: "https://example.com/app.apk",
      sha256: null,
    });

    render(<UpdatePrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));

    expect(screen.queryByText(/Update available/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem("hrp-update-dismissed")).toBe("1.0.6-pilot");
  });

  it("checks again when the app returns to the foreground", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    checkForUpdateMock.mockResolvedValue(null);

    render(<UpdatePrompt />);
    await waitFor(() => expect(checkForUpdateMock).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(checkForUpdateMock).toHaveBeenCalledTimes(2));
  });
});
