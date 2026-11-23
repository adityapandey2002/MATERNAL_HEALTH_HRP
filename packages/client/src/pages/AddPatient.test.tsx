import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { LocalPatient } from "../lib/db/local-db";
import { clearAllLocalData, patientRepo } from "../lib/db/repositories";
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
  beforeEach(async () => {
    await clearAllLocalData();
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
    expect(screen.getByText(/^Complications/)).toBeInTheDocument();
    expect(screen.getByText(/Referring or not\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to HRP register" })).toBeInTheDocument();
  });

  it("requires mandatory fields before saving", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: "Add to HRP register" }));

    expect(screen.getByText("Enter the mother's full name")).toBeInTheDocument();
    expect(screen.getByText("Enter her 10-digit mobile number")).toBeInTheDocument();
    expect(screen.getByText("Enter her age in completed years")).toBeInTheDocument();
    expect(screen.getByText("Select at least one HRP complication")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("checkbox", { name: /PIH/i }));

    fireEvent.click(screen.getByRole("button", { name: "Add to HRP register" }));

    await vi.waitFor(() => {
      expect(screen.getByText("Follow-ups page")).toBeInTheDocument();
    });
  });

  it("warns when the same name is already registered at the facility", async () => {
    localStorage.getItem = vi.fn((key: string) => {
      if (key !== "hrp-cached-session") return null;
      return JSON.stringify({
        user: {
          id: "111",
          name: "Radha",
          employeeId: "ANM001",
          phone: "9988776655",
          role: "ANM",
          facilityId: "fac1",
          language: "en",
          isActive: true,
        },
        cachedAt: Date.now(),
      });
    });

    const existing: LocalPatient = {
      id: "existing-1",
      abhaId: null,
      facilityId: "fac1",
      registeredBy: "111",
      anmName: "Radha",
      name: "Sita Devi",
      age: 24,
      phone: "9988776655",
      address: null,
      hrpComplication: "PIH",
      hrpReason: "HYPERTENSION",
      registrationHb: null,
      anemiaGrade: null,
      ashaName: null,
      ashaPhone: null,
      referred: false,
      isHrp: true,
      followUpTrack: null,
      followUpScheduledDate: null,
      followUpStatus: "PENDING",
      lmp: null,
      edd: null,
      gravida: 0,
      para: 0,
      abortions: 0,
      riskFactors: [],
      riskLevel: "AMBER",
      riskScore: 40,
      isHighRisk: true,
      createdAt: "2026-10-31T00:00:00Z",
      updatedAt: "2026-10-31T00:00:00Z",
      syncStatus: "synced",
    };
    await patientRepo.upsert(existing);

    render(<AddPatientPage />, { wrapper: createWrapper() });

    const nameInput = screen.getByLabelText(/^Mother's full name/);
    fireEvent.change(nameInput, { target: { value: "  sita   devi " } });
    fireEvent.blur(nameInput);

    expect(await screen.findByText(/already registered at this facility/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sita Devi" })).toHaveAttribute(
      "href",
      "/patients/existing-1"
    );

    await clearAllLocalData();
  });

  it("shows referral destination dropdown when Yes is selected", async () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    expect(screen.queryByLabelText(/Referral destination facility/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Yes — Refer case/i));

    const select = screen.getByLabelText(/Referral destination facility/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /CHC \/ FRU/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /DH \/ Sadar Hospital/i })).toBeInTheDocument();
  });

  it("displays the generated unique patient ID on the intake form", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/Unique Patient ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/MS-2026-/i)).toBeInTheDocument();
  });

  it("shows Hb input and validates single-line anemia grade when complication includes ANEMIA", () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    expect(screen.queryByLabelText(/Haemoglobin \(Hb\)/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /^Anemia/i }));

    const hbInput = screen.getByLabelText(/Haemoglobin \(Hb\)/i);
    expect(hbInput).toBeInTheDocument();

    fireEvent.change(hbInput, { target: { value: "6.5" } });
    expect(screen.getByText("Severe Anemic (< 7 g/dL)")).toBeInTheDocument();

    fireEvent.change(hbInput, { target: { value: "7.8" } });
    expect(screen.getByText("Moderate Anemic (7–8.9 g/dL)")).toBeInTheDocument();

    fireEvent.change(hbInput, { target: { value: "9.5" } });
    expect(screen.getByText("Mild Anemic (9–10.9 g/dL)")).toBeInTheDocument();

    fireEvent.change(hbInput, { target: { value: "12.0" } });
    expect(screen.getByText("Normal (≥ 11 g/dL)")).toBeInTheDocument();

    // Verify verbose multi-line reference box is removed
    expect(screen.queryByText(/NHM Anemia Classification/i)).not.toBeInTheDocument();
  });

  it("submits multiple complications, referralFacilityType, and registrationHb", async () => {
    render(<AddPatientPage />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^Mother's full name/), {
      target: { value: "Anjali Kumari" },
    });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByLabelText(/^Age \(completed years\)/), {
      target: { value: "22" },
    });
    fireEvent.change(screen.getByLabelText(/^Village \/ HWC/), {
      target: { value: "fac-1" },
    });
    fireEvent.change(screen.getByLabelText(/^LMP/), {
      target: { value: "2026-08-01" },
    });

    // Multi-select complications: Anemia and PIH
    fireEvent.click(screen.getByRole("checkbox", { name: /^Anemia/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /PIH/i }));

    const hbInput = screen.getByLabelText(/Haemoglobin \(Hb\)/i);
    fireEvent.change(hbInput, { target: { value: "6.8" } });

    // Select referral to DH (District Sadar Hospital)
    fireEvent.click(screen.getByLabelText(/Yes — Refer case/i));
    fireEvent.change(screen.getByLabelText(/Referral destination facility/i), {
      target: { value: "DH" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add to HRP register" }));

    await vi.waitFor(async () => {
      const all = await patientRepo.list();
      expect(all).toHaveLength(1);
      const saved = all[0];
      if (!saved) {
        throw new Error("Patient not saved in repository");
      }
      expect(saved.name).toBe("Anjali Kumari");
      expect(saved.hrpComplication).toBe("ANEMIA");
      expect(saved.hrpComplications).toContain("ANEMIA");
      expect(saved.hrpComplications).toContain("PIH");
      expect(saved.registrationHb).toBe(6.8);
      expect(saved.anemiaGrade).toBe("SEVERE");
      expect(saved.referred).toBe(true);
      expect(saved.referralFacilityType).toBe("DH");
    });
  });
});
