import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AddHome from "./AddHome";

describe("AddHome", () => {
  it("shows only the big add button on the front page", () => {
    render(
      <MemoryRouter>
        <AddHome />
      </MemoryRouter>
    );

    // Page is named "Add" and contains nothing but the big add button
    expect(screen.getByRole("heading", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add hrp woman/i })).toHaveAttribute(
      "href",
      "/patients/new"
    );

    // Nothing else on the page: no dashboard content, no patient list
    expect(screen.queryByRole("heading", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
