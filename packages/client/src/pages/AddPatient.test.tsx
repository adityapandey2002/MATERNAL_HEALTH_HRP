import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import AddPatientPage from "./AddPatient";

vi.mock("../lib/api", () => ({
  api: {
    patients: {
      create: vi.fn(),
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
  phone: null,
  address: null,
  hrpReason: "HYPERTENSION",
  ashaName: null,
  ashaPhone: null,
  referred: false,
  lmp: null,
  edd: null,
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
          <Route path="/" element={<p>Dashboard page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AddPatientPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.patients.create).mockResolvedValue(patient);
  });

  it("shows only the registration fields on the add form", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Add HRP Woman" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Age/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Reason for high-risk pregnancy/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, referred" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, not referred" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^ASHA name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ASHA mobile number/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("requires a name, age, and reason before saving", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Enter the woman's name")).toBeInTheDocument();
    expect(screen.getByText("Enter her age")).toBeInTheDocument();
    expect(screen.getByText("Select the reason this pregnancy is high-risk")).toBeInTheDocument();
    expect(api.patients.create).not.toHaveBeenCalled();
  });

  it("saves the registration and goes to the dashboard", async () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Sita Devi" } });
    fireEvent.change(screen.getByLabelText(/^Age/), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText(/^Reason for high-risk pregnancy/), {
      target: { value: "HYPERTENSION" },
    });
    fireEvent.change(screen.getByLabelText(/^ASHA name/), { target: { value: "Asha Kumari" } });
    fireEvent.change(screen.getByLabelText(/^ASHA mobile number/), {
      target: { value: "99887 76655" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(api.patients.create).toHaveBeenCalledWith({
        name: "Sita Devi",
        age: 24,
        hrpReason: "HYPERTENSION",
        referred: false,
        ashaName: "Asha Kumari",
        ashaPhone: "9988776655",
        lmp: null,
        gravida: 0,
        para: 0,
        abortions: 0,
        riskFactors: [],
      });
    });
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("rejects an ASHA number that is not 10 digits", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Sita Devi" } });
    fireEvent.change(screen.getByLabelText(/^Age/), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText(/^Reason for high-risk pregnancy/), {
      target: { value: "HYPERTENSION" },
    });
    fireEvent.change(screen.getByLabelText(/^ASHA mobile number/), {
      target: { value: "12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Enter a 10-digit mobile number")).toBeInTheDocument();
    expect(api.patients.create).not.toHaveBeenCalled();
  });
});
