import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import PatientsPage from "./Patients";

vi.mock("../lib/api", () => ({
  api: {
    patients: {
      list: vi.fn(),
      delete: vi.fn(),
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
    vi.mocked(api.patients.list).mockResolvedValue({
      data: [patient],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("shows the reason and the ANM who registered each woman", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Rekha Devi")).toBeInTheDocument();
    expect(screen.getByText("Previous C-section")).toBeInTheDocument();
    expect(screen.getByText("Asha Ben")).toBeInTheDocument();
  });

  it("refilters the block list by ANM name", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findByText("Rekha Devi");
    fireEvent.change(screen.getByLabelText("Filter by ANM name"), { target: { value: "Asha" } });

    await vi.waitFor(() => {
      expect(api.patients.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ anmName: "Asha" })
      );
    });
  });

  it("refilters by risk level", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findByText("Rekha Devi");
    fireEvent.change(screen.getByLabelText("Filter by risk level"), { target: { value: "AMBER" } });

    await vi.waitFor(() => {
      expect(api.patients.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ riskLevel: "AMBER" })
      );
    });
  });

  it("shows an empty state", async () => {
    vi.mocked(api.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    render(<PatientsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("No patients found")).toBeInTheDocument();
  });
});
