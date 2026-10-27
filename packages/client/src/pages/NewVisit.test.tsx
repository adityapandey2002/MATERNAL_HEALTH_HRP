import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import NewVisitPage from "./NewVisit";

vi.mock("../lib/api", () => ({
  api: {
    patients: { get: vi.fn() },
    visits: { byPatient: vi.fn(), create: vi.fn() },
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
  address: "Pasunj Village",
  hrpReason: "PREVIOUS_C_SECTION",
  ashaName: "Sunita Devi",
  ashaPhone: "9988776655",
  referred: true,
  lmp: new Date(2026, 0, 1),
  edd: null,
  gravida: 2,
  para: 1,
  abortions: 0,
  riskFactors: ["HYPERTENSION"],
  riskLevel: "RED",
  riskScore: 95,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/patients/${patient.id}/visit`]}>
        <Routes>
          <Route path="/patients/:id/visit" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("NewVisitPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.patients.get).mockResolvedValue(patient);
    vi.mocked(api.visits.byPatient).mockResolvedValue([]);
  });

  it("renders the vitals labels with their units", async () => {
    render(<NewVisitPage />, { wrapper: createWrapper() });

    expect(await screen.findByText(/BP Systolic/)).toBeInTheDocument();
    expect(screen.getByText(/Hemoglobin/)).toBeInTheDocument();
    expect(screen.getAllByText(/\(mmHg\)/).length).toBeGreaterThan(0);
  });
});
