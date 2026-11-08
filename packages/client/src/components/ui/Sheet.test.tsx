import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("opens as a labelled dialog with its items and build footer", () => {
    render(
      <Sheet open onClose={() => {}} title="More" description="Asha Ben · ANM" footer="Build 1.0.7">
        <a href="/settings">Settings</a>
      </Sheet>
    );

    const dialog = screen.getByRole("dialog", { name: "More" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Build 1.0.7")).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="More">
        <p>Items</p>
      </Sheet>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("uses the platform modal methods where the WebView provides them", () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: close,
    });

    try {
      const { rerender } = render(
        <Sheet open onClose={() => {}} title="More">
          <p>Items</p>
        </Sheet>
      );
      expect(showModal).toHaveBeenCalledTimes(1);

      rerender(
        <Sheet open={false} onClose={() => {}} title="More">
          <p>Items</p>
        </Sheet>
      );
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });

  it("removes the open attribute when the parent closes it", () => {
    const { rerender } = render(
      <Sheet open onClose={() => {}} title="More">
        <p>Items</p>
      </Sheet>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");

    rerender(
      <Sheet open={false} onClose={() => {}} title="More">
        <p>Items</p>
      </Sheet>
    );
    expect(dialog).not.toHaveAttribute("open");
  });
});
