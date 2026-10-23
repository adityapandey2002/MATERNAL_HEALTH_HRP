import type { Patient } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import FollowUpsPage from "./FollowUps";

vi.mock("../lib/api", () => ({
  api: {
    patients: { list: vi.fn() },
    visits: { list: vi.fn() },
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
  phone: null,
  address: null,
  hrpReason: "HYPERTENSION",
  ashaName: null,
  ashaPhone: null,
  referred: false,
  lmp: null,
  edd: null,
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

const weeksAgo = (weeks: number) => new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

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
    vi.mocked(api.visits.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });
  });

  it("orders follow-ups by urgency, overdue first", async () => {
    const overdue = {
      ...basePatient,
      id: "11111111-1111-4111-8111-111111111111",
      name: "Overdue Woman",
      lmp: weeksAgo(30),
    };
    const due = {
      ...basePatient,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Due Woman",
      lmp: weeksAgo(12),
    };
    const upcoming = {
      ...basePatient,
      id: "33333333-3333-4333-8333-333333333333",
      name: "Upcoming Woman",
      lmp: weeksAgo(1),
    };
    vi.mocked(api.patients.list).mockResolvedValue({
      data: [upcoming, overdue, due],
      total: 3,
      page: 1,
      limit: 100,
    });

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Overdue Woman")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Overdue Woman");
    expect(rows[2]).toHaveTextContent("Due Woman");
    expect(rows[3]).toHaveTextContent("Upcoming Woman");
    expect(screen.getAllByRole("link", { name: /record visit/i })).toHaveLength(3);
  });

  it("shows the empty state when nothing is pending", async () => {
    vi.mocked(api.patients.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 });

    render(<FollowUpsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("No follow-ups to do")).toBeInTheDocument();
  });
});
