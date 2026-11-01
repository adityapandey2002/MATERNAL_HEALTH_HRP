import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db/local-db";
import PatientsPage from "./Patients";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    patients: { list: vi.fn() },
    visits: { list: vi.fn() },
    sync: { pull: vi.fn().mockRejectedValue(new Error("offline in test")) },
  },
}));

const patient = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Rekha Devi",
  age: 26,
  hrpReason: "PREVIOUS_C_SECTION",
  referred: true,
  isHrp: true,
  followUpStatus: "PENDING",
  ashaName: "Sunita Devi",
  ashaPhone: "9988776655",
  lmp: "2026-01-01T00:00:00.000Z",
  gravida: 2,
  para: 1,
  abortions: 0,
  riskFactors: [],
  riskLevel: "AMBER",
  riskScore: 35,
  isHighRisk: true,
  facilityId: "22222222-2222-4222-8222-222222222222",
  registeredBy: "33333333-3333-4333-8333-333333333333",
  anmName: "Asha Ben",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncStatus: "synced" as const,
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
    await db.patients.put(patient as unknown as never);
  });

  it("shows the reason and the ANM who registered each woman", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    expect((await screen.findAllByText("Rekha Devi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Previous C-section").length).toBeGreaterThan(0);
    expect(screen.getByText("Asha Ben")).toBeInTheDocument();
  });

  it("refilters the list by ANM name", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findAllByText("Rekha Devi");
    fireEvent.change(screen.getByLabelText("Filter by ANM name"), { target: { value: "zzz" } });

    await vi.waitFor(() => {
      expect(screen.queryByText("Rekha Devi")).not.toBeInTheDocument();
    });
  });

  it("refilters by risk level", async () => {
    render(<PatientsPage />, { wrapper: createWrapper() });

    await screen.findAllByText("Rekha Devi");
    fireEvent.click(screen.getByRole("button", { name: "High" }));

    await vi.waitFor(() => {
      expect(screen.queryByText("Rekha Devi")).not.toBeInTheDocument();
    });
  });

  it("shows an empty state", async () => {
    await db.patients.clear();
    render(<PatientsPage />, { wrapper: createWrapper() });

    expect((await screen.findAllByText("No patients found")).length).toBeGreaterThan(0);
  });
});
