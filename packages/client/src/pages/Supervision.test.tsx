import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import SupervisionPage from "./Supervision";

vi.mock("../lib/api", () => ({
  api: {
    supervision: {
      alerts: vi.fn(),
      acknowledge: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SupervisionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.supervision.alerts).mockResolvedValue({ data: [], total: 0 });
  });

  it("gives both filter selects accessible names", async () => {
    render(<SupervisionPage />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText("Filter by alert type")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by severity")).toBeInTheDocument();
  });
});
