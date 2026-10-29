import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import Layout from "./Layout";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn(), logout: vi.fn() },
    facilities: { list: vi.fn() },
  },
}));

const baseUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Asha Ben",
  employeeId: "ANM001",
  phone: "9988776655",
  facilityId: "22222222-2222-4222-8222-222222222222",
  language: "en" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderLayout(initialEntry = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function sidebar() {
  const [primary] = screen.getAllByRole("navigation", { name: "Primary" });
  if (!primary) throw new Error("Primary navigation not rendered");
  return within(primary);
}

describe("Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({ ...baseUser, role: "ANM" });
    vi.mocked(api.facilities.list).mockResolvedValue([]);
  });

  it("gives an ANM the field-work navigation", async () => {
    renderLayout();

    await screen.findByText("Asha Ben");

    const nav = sidebar();
    expect(nav.getByRole("link", { name: "Add case" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(nav.getByRole("link", { name: "Follow-ups" })).toHaveAttribute("href", "/follow-ups");
    expect(nav.getByRole("link", { name: "Patients" })).toHaveAttribute("href", "/patients");
    expect(nav.queryByRole("link", { name: "Supervision" })).not.toBeInTheDocument();
  });

  it("gives a CHO the oversight supervision navigation", async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ ...baseUser, role: "CHO", employeeId: "CHO001" });

    renderLayout();

    await screen.findByText("CHO · facility");

    const nav = sidebar();
    expect(nav.getByRole("link", { name: "Add case" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(nav.getByRole("link", { name: "Supervision" })).toHaveAttribute("href", "/supervision");
  });

  it("does not double-select Add HRP case and All people for oversight role on /patients/new", async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ ...baseUser, role: "BHM", employeeId: "BHM001" });

    renderLayout("/patients/new");

    await screen.findByText("Block nodal officer");

    const nav = sidebar();
    const addCaseLink = nav.getByRole("link", { name: "Add HRP case" });
    const allPeopleLink = nav.getByRole("link", { name: "All people" });

    expect(addCaseLink).toHaveAttribute("href", "/patients/new");
    expect(addCaseLink).toHaveAttribute("aria-current", "page");
    expect(allPeopleLink).toHaveAttribute("href", "/patients");
    expect(allPeopleLink).not.toHaveAttribute("aria-current");
  });
});
