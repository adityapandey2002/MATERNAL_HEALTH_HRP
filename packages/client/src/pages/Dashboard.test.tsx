import type { Patient, Visit } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import Dashboard from "./Dashboard";

vi.mock("../lib/api", () => ({
  api: {
    patients: { list: vi.fn() },
    visits: { list: vi.fn() },
    supervision: { alerts: vi.fn() },
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
  phone: null,
  address: null,
  hrpReason: "HYPERTENSION",
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
  riskScore: 65,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const visit: Visit = {
  id: "44444444-4444-4444-8444-444444444444",
  patientId: patient.id,
  facilityId: patient.facilityId,
  conductedBy: patient.registeredBy,
  visitNumber: 1,
  gestationalWeeks: 12,
  visitDate: new Date(),
  bpSystolic: 120,
  bpDiastolic: 80,
  hb: 11,
  weight: 55,
  fundalHeight: null,
  fetalHeartRate: null,
  dangerSigns: [],
  ifaGiven: true,
  calciumGiven: true,
  albendazoleGiven: false,
  referred: false,
  referralReason: null,
  referralFacilityId: null,
  notes: null,
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

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leads with the Add HRP Woman action and lists follow-ups", async () => {
    vi.mocked(api.patients.list).mockResolvedValue({
      data: [patient],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.visits.list).mockResolvedValue({ data: [visit], total: 1, page: 1, limit: 50 });
    vi.mocked(api.supervision.alerts).mockResolvedValue({ data: [], total: 0 });

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(await screen.findByRole("link", { name: /add a new hrp woman/i })).toBeInTheDocument();
    expect(screen.getAllByText("Rekha Devi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Asha Ben").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Follow-ups Due" })).toBeInTheDocument();
    // One ANC visit is recorded, so the plan starts at visit 2, which is
    // already past its window for an LMP in early January.
    expect(screen.getByText(/visit 2/i)).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows empty states when nothing is due", async () => {
    vi.mocked(api.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
    vi.mocked(api.visits.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
    vi.mocked(api.supervision.alerts).mockResolvedValue({ data: [], total: 0 });

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(await screen.findByText("No follow-ups due")).toBeInTheDocument();
    expect(screen.getByText("No high-risk patients")).toBeInTheDocument();
    expect(screen.getByText("No alerts")).toBeInTheDocument();
  });
});
