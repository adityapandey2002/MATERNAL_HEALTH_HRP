import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import PatientsPage from "./Patients";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    patients: {
      list: vi.fn(),
    },
    visits: {
      list: vi.fn(),
    },
  },
}));

const patient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  abhaId: null,
  facilityId: "22222222-2222-4222-8222-222222222222",
  registeredBy: "33333333-3333-4333-8333-333333333333",
  anmName: "Asha Ben",
  name: "Rekha Devi",
  age: 26,
  phone: "9988776655",
  address: null,
  hrpReason: "PREVIOUS_C_SECTION",
  ashaName: "Sunita Devi",
  ashaPhone: "9988776655",
  referred: true,
  isHrp: true,
  followUpStatus: "PENDING",
  lmp: new Date(2026, 0, 1),
  edd: null,
  gravida: 2,
  para: 1,
  abortions: 0,
  riskFactors: [],
  riskLevel: "AMBER",
  riskScore: 35,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("PatientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      employeeId: "ANM001",
      name: "Asha Ben",
      phone: "9988776655",
      role: "ANM",
      facilityId: "22222222-2222-4222-8222-222222222222",
      language: "en",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(api.patients.list).mockResolvedValue({
      data: [patient],
      total: 1,
      page: 1,
      limit: 20,
    });
    vi.mocked(api.visits.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
  });

  it("shows the reason and the ANM who registered each woman", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    expect((await screen.findAllByText("Rekha Devi")).length).toBeGreaterThan(0);
    // The desktop table and the mobile card stack both render the reason.
    expect(screen.getAllByText("Previous C-section").length).toBeGreaterThan(0);
    expect(screen.getByText("Asha Ben")).toBeInTheDocument();
  });

  it("refilters the block list by ANM name", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findAllByText("Rekha Devi");
    fireEvent.change(screen.getByLabelText("Filter by ANM name"), { target: { value: "Asha" } });

    await vi.waitFor(() => {
      expect(api.patients.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ anmName: "Asha" })
      );
    });
  });

  it("refilters by risk level", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findAllByText("Rekha Devi");
    fireEvent.click(screen.getByRole("button", { name: "Moderate" }));

    await vi.waitFor(() => {
      expect(api.patients.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ riskLevel: "AMBER" })
      );
    });
  });

  it("shows an empty state", async () => {
    vi.mocked(api.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    render(<PatientsPage />, { wrapper: createWrapper() });

    expect((await screen.findAllByText("No patients found")).length).toBeGreaterThan(0);
  });
});
