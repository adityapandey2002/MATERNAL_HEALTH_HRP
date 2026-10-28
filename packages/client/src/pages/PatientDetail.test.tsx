import type { Patient, Visit } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import PatientDetailPage from "./PatientDetail";

vi.mock("../lib/api", () => ({
  api: {
    patients: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    visits: {
      byPatient: vi.fn(),
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
  address: "Pasunj Village",
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
  riskFactors: ["HYPERTENSION"],
  riskLevel: "RED",
  riskScore: 95,
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
  visitDate: new Date(2026, 2, 1),
  bpSystolic: 120,
  bpDiastolic: 80,
  hb: 10.5,
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

const createWrapper = (path = `/patients/${patient.id}`) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/patients/:id" element={children} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("PatientDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.patients.get).mockResolvedValue(patient);
    vi.mocked(api.patients.update).mockResolvedValue(patient);
    vi.mocked(api.visits.byPatient).mockResolvedValue([visit]);
  });

  it("shows the registration details and the follow-up plan", async () => {
    render(<PatientDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Previous C-section")).toBeInTheDocument();
    expect(screen.getByText("Sunita Devi · 9988776655")).toBeInTheDocument();
    expect(screen.getByText("Asha Ben")).toBeInTheDocument();
    expect(screen.getByText("Referred")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Follow-up Plan" })).toBeInTheDocument();
    expect(screen.getByText(/visit 2/i)).toBeInTheDocument();
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("120/80")).toBeInTheDocument();
  });

  it("prefills the edit form and saves the ANM-editable HRP fields", async () => {
    render(<PatientDetailPage />, { wrapper: createWrapper() });

    await screen.findByText("Previous C-section");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const nameInput = screen.getByDisplayValue("Rekha Devi");
    fireEvent.change(nameInput, { target: { value: "Rekha Kumari" } });
    fireEvent.change(screen.getByLabelText("Reason for high-risk pregnancy"), {
      target: { value: "CARDIAC_DISEASE" },
    });
    fireEvent.click(screen.getByLabelText("Referred to a higher facility"));

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await vi.waitFor(() => {
      expect(api.patients.update).toHaveBeenCalledWith(
        patient.id,
        expect.objectContaining({
          name: "Rekha Kumari",
          hrpReason: "CARDIAC_DISEASE",
          referred: false,
          ashaName: "Sunita Devi",
          ashaPhone: "9988776655",
        })
      );
    });
  });

  it("does not offer a hard-delete action", async () => {
    render(<PatientDetailPage />, { wrapper: createWrapper() });

    await screen.findByText("Previous C-section");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows a not-found state when the patient does not exist", async () => {
    vi.mocked(api.patients.get).mockResolvedValue(null as unknown as Patient);
    vi.mocked(api.visits.byPatient).mockResolvedValue([]);

    render(<PatientDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Patient not found")).toBeInTheDocument();
  });
});
