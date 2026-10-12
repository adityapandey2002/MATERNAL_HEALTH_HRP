import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Patient, RiskLevel, PatientFilter, Pagination } from '@hrp/shared';
import { format } from 'date-fns';

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    RED: { class: 'badge-red', label: 'High Risk' },
    AMBER: { class: 'badge-amber', label: 'Medium Risk' },
    GREEN: { class: 'badge-green', label: 'Low Risk' },
  };
  const c = config[level];
  return <span className={`badge ${c.class}`}>{c.label}</span>;
}

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('');
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', 'list', { page, search, riskFilter }],
    queryFn: () => api.patients.list({ page, limit, search: search || undefined, riskLevel: riskFilter || undefined }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: api.patients.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  });

  const patients = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500">Manage high-risk pregnancy registrations</p>
        </div>
        <Link to="/patients/new" className="btn btn-primary">
          <PlusIcon className="w-5 h-5" /> Register Patient
        </Link>
      </div>

      <div className="card">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search by name, phone, ID…"
                className="input pl-10"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="input w-auto"
              value={riskFilter}
              onChange={e => { setRiskFilter(e.target.value as RiskLevel); setPage(1); }}
            >
              <option value="">All Risk Levels</option>
              <option value="RED">High Risk (Red)</option>
              <option value="AMBER">Medium Risk (Amber)</option>
              <option value="GREEN">Low Risk (Green)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-500">Loading patients…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">Failed to load patients</div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Phone</th>
                    <th>GA (wks)</th>
                    <th className="text-center">Risk</th>
                    <th>Facility</th>
                    <th>Last Visit</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.length > 0 ? patients.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>{p.age}</td>
                      <td>{p.phone ?? '—'}</td>
                      <td>{p.edd ? Math.max(0, Math.round((new Date(p.edd).getTime() - Date.now()) / (1000*60*60*24*7))) : '—'}</td>
                      <td className="text-center"><RiskBadge level={p.riskLevel} /></td>
                      <td>{p.facilityId}</td>
                      <td>{p.updatedAt ? format(new Date(p.updatedAt), 'MMM d, yyyy') : '—'}</td>
                      <td className="text-right">
                        <Link to={`/patients/${p.id}`} className="btn btn-outline btn-sm">View</Link>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">No patients found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} patients
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}