import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Explode(): never {
  throw new Error("local database is closed");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the screen when nothing throws", () => {
    render(
      <ErrorBoundary label="home">
        <p>Follow-ups for today</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("Follow-ups for today")).toBeInTheDocument();
  });

  it("shows a readable panel instead of a blank screen when a child throws", () => {
    // React logs the caught error; the test output does not need the stack.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary label="home">
        <Explode />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "This screen stopped responding" })
    ).toBeInTheDocument();
    expect(screen.getByText("local database is closed")).toBeInTheDocument();
    expect(screen.getByText(/^Build /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload the app" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy details" })).toBeInTheDocument();
  });

  it("lets the worker reload or copy the fault details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload },
      writable: true,
      configurable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ErrorBoundary label="home">
        <Explode />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy details" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(String(writeText.mock.calls[0]?.[0])).toContain("local database is closed");

    fireEvent.click(screen.getByRole("button", { name: "Reload the app" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
