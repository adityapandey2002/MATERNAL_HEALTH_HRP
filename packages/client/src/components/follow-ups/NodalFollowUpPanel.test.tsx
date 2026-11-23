import type { Patient } from "@hrp/shared";
import type { FollowUpListItem } from "@hrp/shared/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../lib/api";
import NodalFollowUpPanel from "./NodalFollowUpPanel";

vi.mock("../../lib/api", () => ({
  api: {
    hrp: {
      followUps: {
        list: vi.fn(),
        update: vi.fn(),
      },
      patients: { list: vi.fn() },
    },
  },
}));

const mockSevereAnemiaPatient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  abhaId: null,
  facilityId: "22222222-2222-4222-8222-222222222222",
  registeredBy: "33333333-3333-4333-8333-333333333333",
  anmName: "Asha Ben",
  name: "Sunita Devi",
  age: 26,
  phone: "9876543210",
  address: "Rampur",
  hrpComplication: "ANEMIA",
  hrpReason: "SEVERE_ANEMIA",
  registrationHb: 6.5,
  anemiaGrade: "SEVERE",
  ashaName: null,
  ashaPhone: null,
  referred: true,
  isHrp: true,
  followUpTrack: "BLOCK_15_DAY",
  followUpScheduledDate: new Date(),
  followUpStatus: "PENDING",
  lmp: new Date("2026-08-01"),
  edd: new Date("2027-05-08"),
  gravida: 1,
  para: 0,
  abortions: 0,
  riskFactors: [],
  riskLevel: "RED",
  riskScore: 70,
  isHighRisk: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFollowUpItem: FollowUpListItem = {
  id: "fu-1",
  patientId: "11111111-1111-4111-8111-111111111111",
  assignedToUserId: "33333333-3333-4333-8333-333333333333",
  assignedByUserId: "33333333-3333-4333-8333-333333333333",
  level: "BLOCK_NODAL",
  patientName: "Sunita Devi",
  patientAge: 26,
  patientPhone: "9876543210",
  village: "Rampur",
  blockName: "Raniganj",
  hrpComplication: "ANEMIA",
  patientRiskLevel: "RED",
  track: "BLOCK_15_DAY",
  status: "PENDING",
  scheduledDate: new Date().toISOString(),
  assignedToName: null,
  assignedToRole: null,
  completedAt: null,
  completedByUserId: null,
  completedByName: null,
  completedByRole: null,
  notes: null,
  registrationHb: 6.5,
  anemiaGrade: "SEVERE",
  fcmAdministered: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("NodalFollowUpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
    vi.mocked(api.hrp.followUps.update).mockResolvedValue(mockFollowUpItem);
  });

  it("renders the empty state", async () => {
    render(<NodalFollowUpPanel />, { wrapper: createWrapper() });
    expect(await screen.findByText("No follow-ups match these filters")).toBeInTheDocument();
  });

  it("displays unique patient ID and anemia grade badge for follow-up patients", async () => {
    vi.mocked(api.hrp.patients.list).mockResolvedValue({
      data: [mockSevereAnemiaPatient],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [mockFollowUpItem],
      total: 1,
      page: 1,
      limit: 100,
    });

    render(<NodalFollowUpPanel />, { wrapper: createWrapper() });

    expect(await screen.findAllByText("Sunita Devi")).toHaveLength(2); // desktop + mobile
    expect(screen.getAllByText("MS-2026-111111")).toHaveLength(2);
    expect(screen.getAllByText("Severe Anemia (Hb < 7 g/dL)")).toHaveLength(2);
  });

  it("renders FCM Administered checkbox for severe anemia and allows toggling", async () => {
    vi.mocked(api.hrp.patients.list).mockResolvedValue({
      data: [mockSevereAnemiaPatient],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [mockFollowUpItem],
      total: 1,
      page: 1,
      limit: 100,
    });

    render(<NodalFollowUpPanel />, { wrapper: createWrapper() });

    const fcmCheckboxes = await screen.findAllByRole("checkbox");
    expect(fcmCheckboxes.length).toBeGreaterThan(0);
    const firstCheckbox = fcmCheckboxes[0];
    if (!firstCheckbox) {
      throw new Error("FCM checkbox not found");
    }
    expect(firstCheckbox).not.toBeChecked();

    fireEvent.click(firstCheckbox);

    await vi.waitFor(() => {
      expect(api.hrp.followUps.update).toHaveBeenCalledWith("fu-1", {
        status: "PENDING",
        fcmAdministered: true,
      });
    });
  });

  it("does not render FCM Administered for non-anemic cases", async () => {
    const nonAnemicPatient: Patient = {
      ...mockSevereAnemiaPatient,
      id: "22222222-2222-4222-8222-222222222222",
      hrpComplication: "PIH",
      hrpReason: "HYPERTENSION",
      registrationHb: null,
      anemiaGrade: null,
    };
    const nonAnemicFollowUp: FollowUpListItem = {
      ...mockFollowUpItem,
      id: "fu-2",
      patientId: "22222222-2222-4222-8222-222222222222",
      hrpComplication: "PIH",
      registrationHb: null,
      anemiaGrade: null,
      fcmAdministered: null,
    };

    vi.mocked(api.hrp.patients.list).mockResolvedValue({
      data: [nonAnemicPatient],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [nonAnemicFollowUp],
      total: 1,
      page: 1,
      limit: 100,
    });

    render(<NodalFollowUpPanel />, { wrapper: createWrapper() });

    expect(await screen.findAllByText("Sunita Devi")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
