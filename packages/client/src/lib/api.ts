import { Patient, Visit, Referral, Facility, User, SyncQueue, SupervisionAlert, Pagination, PatientFilter, VisitFilter, SupervisionFilter, SyncPayload, SyncResponse, CreatePatient, CreateVisit, CreateReferral, Login } from '@hrp/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

class ApiError extends Error {
  constructor(public status: number, public data: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = localStorage.getItem('accessToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, options);
    }
    localStorage.clear();
    window.location.href = '/login';
    throw new ApiError(401, null, 'Unauthorized');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data, data?.message ?? 'Request failed');
  }

  return data as T;
}

async function refreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export const api = {
  auth: {
    login: (data: Login) => request<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    refresh: () => request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
    }),
    me: () => request<User>('/auth/me'),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  patients: {
    list: (params?: PatientFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && search.set(k, String(v)));
      return request<{ data: Patient[]; total: number; page: number; limit: number }>(`/patients?${search}`);
    },
    get: (id: string) => request<Patient>(`/patients/${id}`),
    create: (data: CreatePatient) => request<Patient>('/patients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreatePatient>) => request<Patient>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/patients/${id}`, { method: 'DELETE' }),
  },

  visits: {
    list: (params?: VisitFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && search.set(k, String(v)));
      return request<{ data: Visit[]; total: number; page: number; limit: number }>(`/visits?${search}`);
    },
    get: (id: string) => request<Visit>(`/visits/${id}`),
    create: (data: CreateVisit) => request<Visit>('/visits', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateVisit>) => request<Visit>(`/visits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    byPatient: (patientId: string) => request<Visit[]>(`/patients/${patientId}/visits`),
  },

  referrals: {
    list: (params?: Pagination) => {
      const search = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && search.set(k, String(v)));
      return request<{ data: Referral[]; total: number }>(`/referrals?${search}`);
    },
    create: (data: CreateReferral) => request<Referral>('/referrals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Referral>) => request<Referral>(`/referrals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  facilities: {
    list: () => request<Facility[]>('/facilities'),
    get: (id: string) => request<Facility>(`/facilities/${id}`),
    children: (id: string) => request<Facility[]>(`/facilities/${id}/children`),
  },

  sync: {
    push: (payload: SyncPayload) => request<SyncResponse>('/sync/push', { method: 'POST', body: JSON.stringify(payload) }),
    pull: (since?: Date) => {
      const search = since ? `?since=${since.toISOString()}` : '';
      return request<SyncResponse>(`/sync/pull${search}`);
    },
  },

  supervision: {
    alerts: (params?: SupervisionFilter & Pagination) => {
      const search = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && search.set(k, String(v)));
      return request<{ data: SupervisionAlert[]; total: number }>(`/supervision/alerts?${search}`);
    },
    acknowledge: (id: string) => request<SupervisionAlert>(`/supervision/alerts/${id}/acknowledge`, { method: 'POST' }),
  },

  queue: {
    list: () => request<SyncQueue[]>('/queue'),
    retry: (id: string) => request<SyncQueue>(`/queue/${id}/retry`, { method: 'POST' }),
  },
};

export { ApiError };