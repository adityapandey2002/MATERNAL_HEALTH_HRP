import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import DevicesPage from "./Devices";

vi.mock("../lib/api", () => ({
  api: {
    devices: {
      list: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const DEVICE = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "33333333-3333-4333-8333-333333333333",
  userName: "Radha Kumari",
  employeeId: "ARR_RANIGANJ_HSC01_01",
  userRole: "ANM" as const,
  label: null,
  platform: "android" as const,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-11-02T00:00:00.000Z"),
  revokedAt: null,
};

describe("DevicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.devices.list).mockResolvedValue({ data: [DEVICE], total: 1 });
    vi.mocked(api.devices.revoke).mockResolvedValue({
      ...DEVICE,
      revokedAt: new Date("2026-11-03T09:00:00.000Z"),
    });
  });

  it("lists a registered device with its owner", async () => {
    render(<DevicesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Radha Kumari")).toBeInTheDocument();
    expect(screen.getByText("Android app")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("asks for confirmation before revoking", async () => {
    render(<DevicesPage />, { wrapper: createWrapper() });

    await screen.findByText("Radha Kumari");
    fireEvent.click(screen.getByRole("button", { name: /revoke device for radha kumari/i }));

    expect(screen.getByRole("button", { name: /confirm revoke/i })).toBeInTheDocument();
  });

  it("calls revoke and refreshes the list", async () => {
    render(<DevicesPage />, { wrapper: createWrapper() });

    await screen.findByText("Radha Kumari");
    fireEvent.click(screen.getByRole("button", { name: /revoke device for radha kumari/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm revoke/i }));

    await waitFor(() => expect(api.devices.revoke).toHaveBeenCalledWith(DEVICE.id));
  });

  it("shows an empty state when there are no devices", async () => {
    vi.mocked(api.devices.list).mockResolvedValue({ data: [], total: 0 });
    render(<DevicesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("No devices yet")).toBeInTheDocument();
  });
});
