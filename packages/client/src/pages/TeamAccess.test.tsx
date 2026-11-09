import type { Facility, StaffMember } from "@hrp/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import TeamAccessPage from "./TeamAccess";

vi.mock("../lib/api", () => ({
  api: {
    auth: { me: vi.fn() },
    staff: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
    facilities: { list: vi.fn() },
  },
}));

const CREATED_AT = new Date("2026-10-01T00:00:00.000Z");

const district: Facility = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "ARARIA",
  name: "Araria",
  level: "DISTRICT",
  parentId: null,
  path: "BIHAR.ARARIA",
  state: "Bihar",
  district: "Araria",
  block: "Araria",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const block: Facility = {
  ...district,
  id: "33333333-3333-4333-8333-333333333333",
  code: "ARR_RANIGANJ",
  name: "Raniganj",
  level: "BLOCK",
  parentId: district.id,
  path: "BIHAR.ARARIA.ARR_RANIGANJ",
};

const signedInUser = {
  id: "11111111-1111-4111-8111-111111111111",
  employeeId: "DHS_ARARIA_01",
  name: "Dr Rao",
  email: "dhs@araria.gov.in",
  phone: "9800000000",
  role: "DHS" as const,
  facilityId: district.id,
  language: "en" as const,
  isActive: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

function member(overrides: Partial<StaffMember>): StaffMember {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    employeeId: "DHS_ARARIA_01",
    name: "Dr Rao",
    email: "dhs@araria.gov.in",
    phone: "9800000000",
    role: "DHS",
    facilityId: district.id,
    facilityName: "Araria",
    isActive: true,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/team"]}>
        <TeamAccessPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TeamAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.facilities.list).mockResolvedValue([district, block]);
  });

  it("lists a DHS's own account without crashing the page", async () => {
    vi.mocked(api.auth.me).mockResolvedValue(signedInUser);
    vi.mocked(api.staff.list).mockResolvedValue({ data: [member({})], total: 1 });

    renderPage();

    // The district officer's own row has a role nobody can provision, and
    // looking up its facility levels used to throw inside render.
    expect(await screen.findByText("Dr Rao")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team & access" })).toBeInTheDocument();
  });

  it("creates a block helpdesk account when a BHM submits the form", async () => {
    vi.mocked(api.auth.me).mockResolvedValue({ ...signedInUser, role: "BHM", name: "BHM Araria" });
    vi.mocked(api.staff.list).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(api.staff.create).mockResolvedValue(
      member({ role: "HRP_HELPDESK_BLOCK", name: "Amit Kumar", facilityId: block.id })
    );

    renderPage();

    fireEvent.change(await screen.findByLabelText(/^Role/), {
      target: { value: "HRP_HELPDESK_BLOCK" },
    });
    await screen.findByRole("option", { name: /Raniganj/ });

    fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: "Amit Kumar" } });
    fireEvent.change(screen.getByLabelText(/^Login email/), {
      target: { value: "amit.block@araria.gov.in" },
    });
    fireEvent.change(screen.getByLabelText(/^Facility/), { target: { value: block.id } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "Temporary123" } });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(vi.mocked(api.staff.create)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.staff.create)).toHaveBeenCalledWith({
      name: "Amit Kumar",
      email: "amit.block@araria.gov.in",
      phone: "9876543210",
      password: "Temporary123",
      role: "HRP_HELPDESK_BLOCK",
      facilityId: block.id,
    });
  });
});
