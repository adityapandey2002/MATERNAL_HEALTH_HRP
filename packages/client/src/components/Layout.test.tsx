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

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function sidebar() {
  // The sidebar is the first "Primary" navigation in the document; the fixed
  // bottom tab bar is the second and is hidden from desktop layout.
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

    // Wait for the session query to resolve before reading the nav, otherwise
    // the shell is still showing its least-privileged ANM default.
    await screen.findByText("Asha Ben");

    const nav = sidebar();
    expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "Patients" })).toHaveAttribute("href", "/patients");
    expect(nav.getByRole("link", { name: "Register woman" })).toHaveAttribute(
      "href",
      "/patients/new"
    );
    // Supervision is an oversight tool and must not be offered to a field worker.
    expect(nav.queryByRole("link", { name: "Supervision" })).not.toBeInTheDocument();
  });

  it("gives a CHO the oversight navigation", async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ ...baseUser, role: "CHO", employeeId: "CHO001" });

    renderLayout();

    await screen.findByText("CHO · facility");

    const nav = sidebar();
    expect(nav.getByRole("link", { name: "Triage line list" })).toHaveAttribute("href", "/");
    expect(nav.getByRole("link", { name: "Supervision" })).toHaveAttribute("href", "/supervision");
    // CHOs review the register; they do not use the field registration form.
    expect(nav.queryByRole("link", { name: "Register woman" })).not.toBeInTheDocument();
  });
});
