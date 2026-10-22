import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskBadge, RiskDot } from "./RiskBadge";

const LABELS = {
  RED: "High Risk",
  AMBER: "Medium Risk",
  GREEN: "Low Risk",
} as const;

describe("RiskBadge", () => {
  const riskLevels = ["RED", "AMBER", "GREEN"] as const;

  for (const level of riskLevels) {
    it(`renders the ${level} badge with its risk label`, () => {
      render(<RiskBadge level={level} />);

      expect(screen.getByTestId("risk-badge")).toBeInTheDocument();
      expect(screen.getByText(LABELS[level])).toBeInTheDocument();
    });

    it(`keeps the ${level} label available to screen readers when showLabel={false}`, () => {
      render(<RiskBadge level={level} showLabel={false} />);

      // The visible label is hidden, but the text stays in the accessibility
      // tree so the badge is never conveyed by colour alone.
      const badge = screen.getByTestId("risk-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(LABELS[level]);
    });
  }

  it("applies size classes correctly", () => {
    const { rerender } = render(<RiskBadge level="RED" size="sm" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("px-2 py-0.5 text-xs");

    rerender(<RiskBadge level="RED" size="md" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("px-2.5 py-1 text-sm");

    rerender(<RiskBadge level="RED" size="lg" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("px-3 py-1.5 text-base");
  });

  it("does not announce every badge on the page as a live region", () => {
    render(<RiskBadge level="RED" />);

    // A table full of badges must not turn every render into a screen reader
    // announcement, so the badge is not a live region.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("RiskDot", () => {
  it("renders correct color for each risk level", () => {
    const { rerender } = render(<RiskDot level="RED" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-red-500");

    rerender(<RiskDot level="AMBER" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-amber-500");

    rerender(<RiskDot level="GREEN" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-green-500");
  });

  it("applies size classes correctly", () => {
    const { rerender } = render(<RiskDot level="RED" size="sm" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("w-2 h-2");

    rerender(<RiskDot level="RED" size="md" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("w-3 h-3");

    rerender(<RiskDot level="RED" size="lg" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("w-4 h-4");
  });

  it("exposes the risk level as an accessible name", () => {
    render(<RiskDot level="RED" />);

    // Colour alone must not be the only signal.
    expect(screen.getByRole("img", { name: "High risk" })).toBeInTheDocument();
  });
});
