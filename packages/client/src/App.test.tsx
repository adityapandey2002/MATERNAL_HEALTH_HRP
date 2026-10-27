import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

const user = {
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
};

describe("App", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({
    children,
    initialEntries = ["/"],
  }: { children: React.ReactNode; initialEntries?: string[] }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn().mockReturnValue("test-token");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterEach(() => {
    localStorage.getItem = vi.fn();
    vi.restoreAllMocks();
  });

  it("renders the Add page at the front page (/)", async () => {
    render(wrapper({ children: <App /> }));

    expect(await screen.findByRole("link", { name: /add hrp woman/i })).toBeInTheDocument();
  });

  it("renders Dashboard at /dashboard", async () => {
    render(wrapper({ children: <App />, initialEntries: ["/dashboard"] }));

    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
