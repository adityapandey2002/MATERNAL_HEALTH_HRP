import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import FieldFollowUpPanel from "./FieldFollowUpPanel";

vi.mock("../../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    hrp: {
      followUps: { list: vi.fn() },
      patients: { list: vi.fn() },
    },
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

describe("FieldFollowUpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "u1",
      name: "Asha Ben",
      employeeId: "ANM001",
      phone: "9988776655",
      role: "ANM",
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
  });

  it("renders the empty state", async () => {
    render(<FieldFollowUpPanel />, { wrapper: createWrapper() });
    expect(await screen.findByText("No follow-up list assigned yet")).toBeInTheDocument();
  });
});
