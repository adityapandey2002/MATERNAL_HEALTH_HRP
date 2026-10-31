import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import NodalFollowUpPanel from "./NodalFollowUpPanel";

vi.mock("../../lib/api", () => ({
  api: {
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

describe("NodalFollowUpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
  });

  it("renders the empty state", async () => {
    render(<NodalFollowUpPanel />, { wrapper: createWrapper() });
    expect(await screen.findByText("No follow-ups match these filters")).toBeInTheDocument();
  });
});
