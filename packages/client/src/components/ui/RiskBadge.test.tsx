import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskBadge, RiskDot } from "./RiskBadge";

const LABELS = {
  RED: "High risk",
  AMBER: "Moderate",
  GREEN: "Routine",
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
    expect(screen.getByTestId("risk-badge")).toHaveClass("px-1.5 py-0 text-2xs");

    rerender(<RiskBadge level="RED" size="md" />);
    expect(screen.getByTestId("risk-badge")).not.toHaveClass("px-1.5");

    rerender(<RiskBadge level="RED" size="lg" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("px-2.5 py-1 text-xs");
  });

  it("uses the triage token for each risk level", () => {
    const { rerender } = render(<RiskBadge level="RED" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("badge-red");

    rerender(<RiskBadge level="AMBER" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("badge-amber");

    rerender(<RiskBadge level="GREEN" />);
    expect(screen.getByTestId("risk-badge")).toHaveClass("badge-green");
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
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-triage-red-solid");

    rerender(<RiskDot level="AMBER" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-triage-amber-solid");

    rerender(<RiskDot level="GREEN" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("bg-triage-green-solid");
  });

  it("applies size classes correctly", () => {
    const { rerender } = render(<RiskDot level="RED" size="sm" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("h-1.5 w-1.5");

    rerender(<RiskDot level="RED" size="md" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("h-2 w-2");

    rerender(<RiskDot level="RED" size="lg" />);
    expect(screen.getByTestId("risk-dot")).toHaveClass("h-2.5 w-2.5");
  });

  it("exposes the risk level as an accessible name", () => {
    render(<RiskDot level="RED" />);

    // Colour alone must not be the only signal.
    expect(screen.getByRole("img", { name: "High risk" })).toBeInTheDocument();
  });
});
