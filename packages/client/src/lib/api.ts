import type {
  CreatePatient,
  CreateReferral,
  CreateStaff,
  CreateVisit,
  DispatchFollowUp,
  Facility,
  FollowUpFilter,
  FollowUpListItem,
  Login,
  Pagination,
  Patient,
  PatientFilter,
  Referral,
  StaffMember,
  SupervisionAlert,
  SupervisionFilter,
  SyncPayload,
  SyncQueue,
  SyncResponse,
  UpdateFollowUp,
  User,
  Visit,
  VisitFilter,
} from "@hrp/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toSearch(params?: Record<string, unknown>): string {
  const search = new URLSearchParams();
  if (params)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) search.set(k, String(v));
    }
  return search.toString();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only send a JSON content type when there is a body. Fastify rejects an
  // empty body with a JSON content type, which would break DELETE and any
  // other bodyless request.
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = localStorage.getItem("accessToken");
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, options);
    }
    localStorage.clear();
    window.location.href = "/login";
    throw new ApiError(401, null, "Unauthorized");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data, data?.message ?? "Request failed");
  }

  return data as T;
}

async function refreshToken(): Promise<boolean> {
  // The refresh token lives in an httpOnly cookie the browser sends
  // automatically. It is never read or written from JavaScript.
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        return true;
      }
    }
  } catch {
    // Network failure during refresh is treated as "not refreshed".
  }
  return false;
}

export const api = {
  auth: {
    login: (data: Login) =>
      request<{ accessToken: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    refresh: () => request<{ accessToken: string }>("/auth/refresh", { method: "POST" }),
    me: () => request<User>("/auth/me"),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },

  patients: {
    list: (params?: PatientFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params)
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) search.set(k, String(v));
        }
      return request<{ data: Patient[]; total: number; page: number; limit: number }>(
        `/patients?${search}`
      );
    },
    get: (id: string) => request<Patient>(`/patients/${id}`),
    create: (data: CreatePatient) =>
      request<Patient>("/patients", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreatePatient>) =>
      request<Patient>(`/patients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/patients/${id}`, { method: "DELETE" }),
  },

  /**
   * HRP-specific endpoints. These carry the complication, follow-up track and
   * the joined attribution the block line list shows.
   */
  hrp: {
    patients: {
      list: (params?: PatientFilter & Pagination & Record<string, unknown>) =>
        request<{ data: Patient[]; total: number; page: number; limit: number }>(
          `/hrp/patients?${toSearch(params)}`
        ),
      get: (id: string) => request<Patient>(`/hrp/patients/${id}`),
      create: (data: CreatePatient) =>
        request<Patient>("/hrp/patients", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Partial<CreatePatient>) =>
        request<Patient>(`/hrp/patients/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
    },
    followUps: {
      list: (params?: FollowUpFilter & Pagination & { search?: string }) =>
        request<{ data: FollowUpListItem[]; total: number; page: number; limit: number }>(
          `/hrp/follow-ups?${toSearch(params)}`
        ),
      field: () =>
        request<{
          data: FollowUpListItem[];
          total: number;
          page: number;
          limit: number;
          active: boolean;
        }>("/hrp/follow-ups/field"),
      panel: () => request<{ data: FollowUpListItem[] }>("/hrp/follow-ups/panel"),
      update: (id: string, data: UpdateFollowUp) =>
        request<FollowUpListItem>(`/hrp/follow-ups/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      dispatch: (data: DispatchFollowUp) =>
        request<{ data: FollowUpListItem[]; count: number }>("/hrp/follow-ups/dispatch", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
  },

  staff: {
    list: () => request<{ data: StaffMember[]; total: number }>("/staff"),
    create: (data: CreateStaff) =>
      request<StaffMember>("/staff", { method: "POST", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request<{ id: string; isActive: boolean }>(`/staff/${id}/deactivate`, { method: "PATCH" }),
  },

  visits: {
    list: (params?: VisitFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params)
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) search.set(k, String(v));
        }
      return request<{ data: Visit[]; total: number; page: number; limit: number }>(
        `/visits?${search}`
      );
    },
    get: (id: string) => request<Visit>(`/visits/${id}`),
    create: (data: CreateVisit) =>
      request<Visit>("/visits", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateVisit>) =>
      request<Visit>(`/visits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    byPatient: (patientId: string) => request<Visit[]>(`/visits/by-patient/${patientId}`),
  },

  referrals: {
    list: (params?: Pagination) => {
      const search = new URLSearchParams();
      if (params)
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) search.set(k, String(v));
        }
      return request<{ data: Referral[]; total: number }>(`/referrals?${search}`);
    },
    create: (data: CreateReferral) =>
      request<Referral>("/referrals", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Referral>) =>
      request<Referral>(`/referrals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  facilities: {
    list: () => request<Facility[]>("/facilities"),
    get: (id: string) => request<Facility>(`/facilities/${id}`),
    children: (id: string) => request<Facility[]>(`/facilities/${id}/children`),
  },

  sync: {
    push: (payload: SyncPayload) =>
      request<SyncResponse>("/sync/push", { method: "POST", body: JSON.stringify(payload) }),
    pull: (since?: Date) => {
      const search = since ? `?since=${since.toISOString()}` : "";
      return request<SyncResponse>(`/sync/pull${search}`);
    },
  },

  supervision: {
    alerts: (params?: SupervisionFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params)
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined) search.set(k, String(v));
        }
      return request<{ data: SupervisionAlert[]; total: number }>(`/supervision/alerts?${search}`);
    },
    acknowledge: (id: string) =>
      request<SupervisionAlert>(`/supervision/alerts/${id}/acknowledge`, { method: "POST" }),
  },

  queue: {
    list: () => request<SyncQueue[]>("/queue"),
    retry: (id: string) => request<SyncQueue>(`/queue/${id}/retry`, { method: "POST" }),
  },
};

export { ApiError };
