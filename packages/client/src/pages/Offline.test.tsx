import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfflinePage from "./Offline";

vi.mock("../utils/sw", () => ({
  isOnline: () => false,
  onOnlineChange: () => () => {},
}));

describe("OfflinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/", reload: vi.fn() },
      writable: true,
      configurable: true,
    });
    vi.mocked(localStorage.getItem).mockReturnValue(String(Date.now()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows when data was last synced", async () => {
    render(<OfflinePage />);

    expect(await screen.findByText(/Last synced:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You're Offline" })).toBeInTheDocument();
  });
});
