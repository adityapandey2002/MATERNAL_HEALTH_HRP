import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import NodalDashboard from "./NodalDashboard";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    hrp: {
      followUps: { list: vi.fn() },
      patients: { list: vi.fn() },
    },
    staff: { list: vi.fn() },
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("NodalDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "u1",
      name: "Block Officer",
      employeeId: "BHM001",
      phone: "9988776655",
      role: "BHM",
      facilityId: "f1",
      language: "en",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
    vi.mocked(api.staff.list).mockResolvedValue({ data: [], total: 0 });
  });

  it("renders the block dashboard", async () => {
    render(<NodalDashboard />, { wrapper: createWrapper() });
    expect(await screen.findByRole("heading", { name: "Block dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Total HRPs")).toBeInTheDocument();
  });
});
