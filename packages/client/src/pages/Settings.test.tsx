import type { User } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import SettingsPage from "./Settings";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    facilities: { list: vi.fn() },
  },
}));

const user: User = {
  id: "11111111-1111-4111-8111-111111111111",
  employeeId: "ANM001",
  name: "Asha Ben",
  phone: "9988776655",
  role: "ANM",
  facilityId: "22222222-2222-4222-8222-222222222222",
  language: "en",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue(user);
    vi.mocked(api.facilities.list).mockResolvedValue([]);
  });

  it("shows the signed-in user's employee ID in the profile", async () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Employee ID: ANM001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});
