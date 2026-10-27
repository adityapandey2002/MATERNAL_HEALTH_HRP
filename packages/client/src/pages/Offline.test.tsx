import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfflinePage from "./Offline";

vi.mock("../utils/sw", () => ({
  isOnline: () => false,
  onOnlineChange: () => () => {},
}));

describe("OfflinePage", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    localStorage.setItem("lastSyncTime", String(Date.now()));
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("shows when data was last synced", async () => {
    render(<OfflinePage />);

    expect(await screen.findByText(/Last synced:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /offline/i })).toBeInTheDocument();
  });
});
