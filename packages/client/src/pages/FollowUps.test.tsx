import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import FollowUpsPage from "./FollowUps";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    hrp: {
      followUps: {
        list: vi.fn(),
        update: vi.fn(),
      },
      patients: {
        list: vi.fn(),
      },
    },
    patients: { list: vi.fn() },
  },
}));

const basePatient: Patient = {
  id: "11111111-1111-4111-8111-111111111111",
  abhaId: null,
  facilityId: "22222222-2222-4222-8222-222222222222",
  registeredBy: "33333333-3333-4333-8333-333333333333",
  anmName: "Asha Ben",
  name: "Patient",
  age: 24,
  phone: "9876543210",
  address: "Shivrajpur",
  hrpReason: "HYPERTENSION",
  hrpComplication: "PIH",
  ashaName: null,
  ashaPhone: null,
  referred: false,
  isHrp: true,
  followUpStatus: "PENDING",
  followUpTrack: "IMMEDIATE_7_DAYS",
  followUpScheduledDate: new Date(),
  lmp: new Date("2026-08-01"),
  edd: new Date("2027-05-08"),
  gravida: 1,
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
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("FollowUpsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.auth.me).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Asha Ben",
      employeeId: "ANM001",
      phone: "9988776655",
      role: "ANM",
      facilityId: "22222222-2222-4222-8222-222222222222",
      language: "en",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("renders the assigned follow-up contacts with three tracks", async () => {
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [
        {
          id: "fu-1",
          patientId: basePatient.id,
          assignedToUserId: "33333333-3333-4333-8333-333333333333",
          assignedByUserId: "admin",
          level: "ANM",
          track: "IMMEDIATE_7_DAYS",
          scheduledDate: new Date().toISOString(),
          status: "PENDING",
          completedAt: null,
          completedByUserId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          patientName: "Urgent Woman",
          patientAge: 25,
          patientPhone: "9876543210",
          patientRiskLevel: "RED",
          hrpComplication: "PIH",
          village: "Shivrajpur",
          assignedToName: "Asha Ben",
          assignedToRole: "ANM",
          completedByName: null,
          completedByRole: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.patients.list).mockResolvedValue({
      data: [{ ...basePatient, name: "Urgent Woman" }],
      total: 1,
      page: 1,
      limit: 100,
    });

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Urgent Woman")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mark complete for Urgent Woman/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mark not reachable for Urgent Woman/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call mother/i })).toBeInTheDocument();
  });

  it("shows the empty state when no follow-ups are assigned", async () => {
    vi.mocked(api.hrp.followUps.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    vi.mocked(api.hrp.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("No follow-up list assigned yet")).toBeInTheDocument();
  });
});
