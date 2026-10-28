import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  const wrapper = ({
    children,
    initialEntries = ["/"],
  }: { children: React.ReactNode; initialEntries?: string[] }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem = vi.fn().mockReturnValue("test-token");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown = {};
      if (url.endsWith("/auth/me")) body = user;
      else if (url.endsWith("/facilities")) body = [];
      else if (url.includes("/patients")) body = { data: [], total: 0, page: 1, limit: 20 };
      else if (url.includes("/visits")) body = { data: [], total: 0, page: 1, limit: 20 };
      else if (url.includes("/supervision/alerts")) body = { data: [], total: 0 };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  });

  afterEach(() => {
    localStorage.getItem = vi.fn();
    vi.restoreAllMocks();
  });

  it("renders the field dashboard at the front page (/)", async () => {
    render(wrapper({ children: <App /> }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
    const registerLinks = screen.getAllByRole("link", { name: /register woman/i });
    expect(registerLinks[0]).toHaveAttribute("href", "/patients/new");
  });

  it("renders the field dashboard at /dashboard", async () => {
    render(wrapper({ children: <App />, initialEntries: ["/dashboard"] }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("renders the registration form at /patients/new", async () => {
    render(wrapper({ children: <App />, initialEntries: ["/patients/new"] }));

    expect(await screen.findByRole("heading", { name: "Add HRP Woman" })).toBeInTheDocument();
  });
});
