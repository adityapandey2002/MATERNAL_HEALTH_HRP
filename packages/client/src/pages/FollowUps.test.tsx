import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalFollowUp, LocalPatient } from "../lib/db/local-db";
import { db } from "../lib/db/local-db";
import { opRepo } from "../lib/db/repositories";
import FollowUpsPage from "./FollowUps";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    hrp: {
      followUps: { list: vi.fn(), update: vi.fn() },
      patients: { list: vi.fn() },
    },
    patients: { list: vi.fn() },
    sync: {
      pull: vi.fn().mockRejectedValue(new Error("offline in test")),
      push: vi.fn(),
    },
  },
}));

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const ANM_ID = "33333333-3333-4333-8333-333333333333";

function makePatient(overrides: Partial<LocalPatient> = {}): LocalPatient {
  return {
    id: PATIENT_ID,
    abhaId: null,
    facilityId: "22222222-2222-4222-8222-222222222222",
    registeredBy: ANM_ID,
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
    followUpTrack: "FIELD_15_DAY",
    followUpScheduledDate: new Date().toISOString(),
    followUpStatus: "PENDING",
    lmp: "2026-08-01T00:00:00.000Z",
    edd: "2027-05-08T00:00:00.000Z",
    gravida: 1,
    para: 0,
    abortions: 0,
    riskFactors: [],
    riskLevel: "AMBER",
    riskScore: 40,
    isHighRisk: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "synced",
    ...overrides,
  };
}

function makeFollowUp(overrides: Partial<LocalFollowUp> = {}): LocalFollowUp {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    patientId: PATIENT_ID,
    assignedToUserId: ANM_ID,
    assignedByUserId: "55555555-5555-4555-8555-555555555555",
    level: "ANM",
    track: "FIELD_15_DAY",
    status: "PENDING",
    scheduledDate: new Date().toISOString(),
    completedAt: null,
    completedByUserId: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: "synced",
    ...overrides,
  };
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("FollowUpsPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  it("renders the assigned follow-up contacts for the 15-day stage from the device cache", async () => {
    await db.patients.put(makePatient({ name: "Urgent Woman" }));
    await db.followUps.put(makeFollowUp());

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

  it("writes a completion to the local store and queues it for sync", async () => {
    await db.patients.put(makePatient({ name: "Urgent Woman" }));
    const followUp = makeFollowUp();
    await db.followUps.put(followUp);

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: /Mark complete for Urgent Woman/i }));

    await vi.waitFor(async () => {
      const local = await db.followUps.get(followUp.id);
      expect(local?.status).toBe("COMPLETE");
      expect(local?.completedAt).not.toBeNull();
      expect(local?.syncStatus).toBe("pending");
    });

    const ops = await opRepo.list();
    expect(
      ops.some(
        (op) => op.entityType === "followUp" && op.entityId === followUp.id && op.op === "update"
      )
    ).toBe(true);
  });

  it("shows a referred woman's first cycle as awaiting block review", async () => {
    await db.patients.put(
      makePatient({ name: "Referred Woman", referred: true, followUpTrack: "BLOCK_15_DAY" })
    );
    await db.followUps.put(
      makeFollowUp({
        id: "66666666-6666-4666-8666-666666666666",
        assignedToUserId: "77777777-7777-4777-8777-777777777777",
        level: "BLOCK_NODAL",
        track: "BLOCK_15_DAY",
      })
    );

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Referred Woman")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Awaiting block review/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mark complete for Referred Woman/i })
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when no follow-ups are assigned", async () => {
    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("No follow-up list assigned yet")).toBeInTheDocument();
  });
});
