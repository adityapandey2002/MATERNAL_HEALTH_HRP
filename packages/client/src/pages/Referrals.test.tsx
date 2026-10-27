import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import ReferralsPage from "./Referrals";

vi.mock("../lib/api", () => ({
  api: {
    referrals: {
      list: vi.fn(),
      update: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ReferralsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.referrals.list).mockResolvedValue({ data: [], total: 0 });
  });

  it("gives the status filter an accessible name", async () => {
    render(<ReferralsPage />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Referrals" })).toBeInTheDocument();
  });
});
