import type { User } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { clearAllLocalData, conflictRepo, opRepo } from "../lib/db/repositories";
import SettingsPage from "./Settings";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    facilities: { list: vi.fn() },
    sync: { push: vi.fn(), pull: vi.fn().mockRejectedValue(new Error("offline in test")) },
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAllLocalData();
    vi.mocked(api.auth.me).mockResolvedValue(user);
    vi.mocked(api.facilities.list).mockResolvedValue([]);
  });

  it("shows the signed-in user's employee ID in the profile", async () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Employee ID: ANM001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("shows the queued changes and conflicts from the device store", async () => {
    await opRepo.enqueue({
      entityType: "patient",
      entityId: "11111111-1111-4111-8111-111111111111",
      op: "create",
      payload: {},
      clientUpdatedAt: "2026-10-31T00:00:00Z",
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      createdAt: "2026-10-31T00:00:00Z",
    });
    await conflictRepo.add({
      entityType: "PATIENT",
      entityId: "11111111-1111-4111-8111-111111111111",
      serverVersion: { name: "Server name" },
      clientVersion: { name: "Local name" },
      seenAt: "2026-10-31T00:00:00Z",
    });

    render(<SettingsPage />, { wrapper: createWrapper() });

    const sections = screen.getByRole("group", { name: "Settings sections" });
    fireEvent.click(within(sections).getByRole("button", { name: "Sync" }));

    expect(await screen.findByText("1 change")).toBeInTheDocument();
    expect(await screen.findByText("1 to review")).toBeInTheDocument();
    expect(screen.getByText(/The server kept a newer version/i)).toBeInTheDocument();
  });
});
