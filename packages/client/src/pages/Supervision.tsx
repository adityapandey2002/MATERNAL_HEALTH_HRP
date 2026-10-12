import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SupervisionAlert, RiskLevel, Pagination } from '@hrp/shared';
import { format } from 'date-fns';

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    RED: { class: 'badge-red', label: 'Critical' },
    AMBER: { class: 'badge-amber', label: 'Warning' },
    GREEN: { class: 'badge-green', label: 'Info' },
  };
  const c = config[level];
  return <span className={`badge ${c.class}`}>{c.label}</span>;
}

function TypeBadge({ type }: { type: SupervisionAlert['type'] }) {
  const labels: Record<SupervisionAlert['type'], string> = {
    ANM_OFFLINE: 'ANM Offline',
    VISIT_OVERDUE: 'Visit Overdue',
    SYNC_FAILED: 'Sync Failed',
    HIGH_RISK_UNATTENDED: 'High-Risk Unattended',
  };
  return <span className="badge badge-gray">{labels[type]}</span>;
}

export default function SupervisionPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<SupervisionAlert['type'] | ''>('');
  const [severityFilter, setSeverityFilter] = useState<RiskLevel | ''>('');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['supervision', 'alerts', { page, typeFilter, severityFilter, acknowledged: showAcknowledged }],
    queryFn: () => api.supervision.alerts({
      page, limit,
      type: typeFilter || undefined,
      severity: severityFilter || undefined,
      acknowledged: showAcknowledged,
    }),
    placeholderData: (prev) => prev,
  });

  const alerts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const ackMutation = useMutation({
    mutationFn: api.supervision.acknowledge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supervision'] }),
  });

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supervision Alerts</h1>
          <p className="text-gray-500">Monitor ANM activity and high-risk case follow-up</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showAcknowledged} onChange={e => { setShowAcknowledged(e.target.checked); setPage(1); }} className="w-4 h-4 text-green-600 rounded border-gray-300" />
            Show acknowledged
          </label>
          {unacknowledgedCount > 0 && (
            <span className="badge badge-red">{unacknowledgedCount} unacknowledged</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <select className="input w-auto" value={typeFilter} onChange={e => { setTypeFilter(e.target.value as SupervisionAlert['type']); setPage(1); }}>
              <option value="">All Types</option>
              <option value="ANM_OFFLINE">ANM Offline</option>
              <option value="VISIT_OVERDUE">Visit Overdue</option>
              <option value="SYNC_FAILED">Sync Failed</option>
              <option value="HIGH_RISK_UNATTENDED">High-Risk Unattended</option>
            </select>
            <select className="input w-auto" value={severityFilter} onChange={e => { setSeverityFilter(e.target.value as RiskLevel); setPage(1); }}>
              <option value="">All Severities</option>
              <option value="RED">Critical</option>
              <option value="AMBER">Warning</option>
              <option value="GREEN">Info</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="text-center">Type</th>
                    <th>Message</th>
                    <th>Facility</th>
                    <th className="text-center">Severity</th>
                    <th>Time</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.length > 0 ? alerts.map(a => (
                    <tr key={a.id} className={a.acknowledged ? 'opacity-60' : ''}>
                      <td className="text-center"><TypeBadge type={a.type} /></td>
                      <td className="max-w-md truncate">{a.message}</td>
                      <td>{a.facilityId}</td>
                      <td className="text-center"><RiskBadge level={a.severity} /></td>
                      <td>{format(new Date(a.createdAt), 'MMM d, HH:mm')}</td>
                      <td className="text-center">
                        {a.acknowledged ? (
                          <span className="badge badge-green">Acknowledged</span>
                        ) : (
                          <span className="badge badge-amber">Pending</span>
                        )}
                      </td>
                      <td className="text-right">
                        {!a.acknowledged && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => ackMutation.mutate(a.id)}
                            disabled={ackMutation.isPending}
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-500">No alerts</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500">Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</p>
                <div className="flex gap-2">
                  <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}