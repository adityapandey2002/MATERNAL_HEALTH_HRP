import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import AddPatientPage from "./AddPatient";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    facilities: { list: vi.fn() },
    hrp: {
      patients: {
        create: vi.fn(),
      },
    },
  },
}));

const patient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  abhaId: null,
  facilityId: "22222222-2222-4222-8222-222222222222",
  registeredBy: "33333333-3333-4333-8333-333333333333",
  anmName: "Asha Ben",
  name: "Sita Devi",
  age: 24,
  phone: "9988776655",
  address: "Shivrajpur HSC",
  hrpComplication: "PIH",
  hrpReason: "HYPERTENSION",
  ashaName: null,
  ashaPhone: null,
  referred: false,
  isHrp: true,
  followUpStatus: "PENDING",
  lmp: new Date("2026-08-01"),
  edd: new Date("2027-05-08"),
  gravida: 0,
  para: 0,
  abortions: 0,
  riskFactors: [],
  riskLevel: "AMBER",
  riskScore: 40,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/patients/new"]}>
        <Routes>
          <Route path="/patients/new" element={children} />
          <Route path="/follow-ups" element={<p>Follow-ups page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AddPatientPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "111",
      name: "Radha",
      employeeId: "ANM001",
      phone: "9988776655",
      role: "ANM",
      facilityId: "fac1",
      language: "en",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(api.facilities.list).mockResolvedValue([
      {
        id: "fac-1",
        code: "HSC001",
        name: "Shivrajpur HSC",
        level: "HSC",
        state: "Bihar",
        district: "Araria",
        block: "Araria",
        parentId: null,
        path: "fac-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(api.hrp.patients.create).mockResolvedValue(patient);
  });

  it("shows the simplified 7-field intake form", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Add case" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mother's full name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mobile number/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Age \(completed years\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Village \/ HWC/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^LMP/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Complication/)).toBeInTheDocument();
    expect(screen.getByText(/Referring or not\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to HRP register" })).toBeInTheDocument();
  });

  it("requires mandatory fields before saving", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Add to HRP register" }));

    expect(screen.getByText("Enter the mother's full name")).toBeInTheDocument();
    expect(screen.getByText("Enter her 10-digit mobile number")).toBeInTheDocument();
    expect(screen.getByText("Enter her age in completed years")).toBeInTheDocument();
    expect(api.hrp.patients.create).not.toHaveBeenCalled();
  });

  it("saves the registration and navigates to follow-ups", async () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^Mother's full name/), {
      target: { value: "Sita Devi" },
    });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), {
      target: { value: "9988776655" },
    });
    fireEvent.change(screen.getByLabelText(/^Age \(completed years\)/), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText(/^Village \/ HWC/), {
      target: { value: "fac-1" },
    });
    fireEvent.change(screen.getByLabelText(/^LMP/), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText(/^Complication/), {
      target: { value: "PIH" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add to HRP register" }));

    await vi.waitFor(() => {
      expect(api.hrp.patients.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sita Devi",
          age: 24,
          phone: "9988776655",
          hrpComplication: "PIH",
          referred: false,
          isHrp: true,
        })
      );
    });
    expect(await screen.findByText("Follow-ups page")).toBeInTheDocument();
  });
});
