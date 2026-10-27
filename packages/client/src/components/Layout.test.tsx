import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import Layout from "./Layout";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn(), logout: vi.fn() },
  },
}));

describe("Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Asha Ben",
      employeeId: "ANM001",
      phone: "9988776655",
      role: "ANM",
      facilityId: "22222222-2222-4222-8222-222222222222",
      language: "en",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("shows Add as the first nav link, then Dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Layout />
      </MemoryRouter>
    );

    const navLinks = screen.getAllByRole("link", { name: /^(add|dashboard)$/i });
    expect(navLinks.map((l) => l.textContent)).toEqual(["Add", "Dashboard"]);
    expect(screen.getByRole("link", { name: /^add$/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });
});
