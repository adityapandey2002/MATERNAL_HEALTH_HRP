import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Facility, User } from '@hrp/shared';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'sync' | 'notifications' | 'about'>('profile');

  const { data: user } = useQuery({ queryKey: ['auth', 'me'], queryFn: api.auth.me });
  const { data: facilities } = useQuery({ queryKey: ['facilities'], queryFn: api.facilities.list });

  const syncMutation = useMutation({
    mutationFn: api.sync.push,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 p-1" aria-label="Settings tabs">
            {[
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'sync', label: 'Sync', icon: SyncIcon },
              { id: 'notifications', label: 'Notifications', icon: BellIcon },
              { id: 'about', label: 'About', icon: InfoIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="card-body p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{user?.name ?? 'Health Worker'}</h2>
                  <p className="text-gray-500 capitalize">{user?.role?.toLowerCase() ?? 'anm'}</p>
                  <p className="text-sm text-gray-400">Employee ID: {user?.employeeId ?? '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Phone</label><p className="text-gray-900">{user?.phone ?? 'Not set'}</p></div>
                <div><label className="label">Facility</label><p className="text-gray-900">{facilities?.find(f => f.id === user?.facilityId)?.name ?? 'Not assigned'}</p></div>
                <div><label className="label">Language</label><p className="text-gray-900">{user?.language ?? 'Hindi'}</p></div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-gray-50">
                <h3 className="font-medium text-gray-900">Data Synchronization</h3>
                <p className="text-sm text-gray-500 mt-1">Your data syncs automatically when online. Tap to force sync now.</p>
              </div>
              <button
                className="btn btn-primary w-full"
                onClick={() => syncMutation.mutate({ patients: [], visits: [], referrals: [] })}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <> <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Syncing… </>)
                : (
                  'Sync Now'
                )}
              </button>
              <p className="text-sm text-gray-500 text-center">Last sync: Just now</p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Notification Preferences</h3>
              <div className="space-y-3">
                {[
                  { id: 'due_visits', label: 'Due Visit Reminders', desc: 'Get notified when ANC visits are due' },
                  { id: 'high_risk', label: 'High-Risk Alerts', desc: 'Immediate alerts for red-flagged patients' },
                  { id: 'sync_status', label: 'Sync Status', desc: 'Know when sync completes or fails' },
                ].map(n => (
                  <label key={n.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{n.label}</p>
                      <p className="text-sm text-gray-500">{n.desc}</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-green-600 rounded border-gray-300" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-900">HRP Tracker</h3>
                  <p className="text-sm text-gray-500">Version 0.1.0 (MVP)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Build</p><p className="font-medium">Development</p></div>
                <div><p className="text-gray-500">Platform</p><p className="font-medium">PWA (Offline-first)</p></div>
                <div><p className="text-gray-500">Database</p><p className="font-medium">IndexedDB + PostgreSQL</p></div>
                <div><p className="text-gray-500">Sync</p><p className="font-medium">Background / Manual</p></div>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Built for India's National Health Mission · High-Risk Pregnancy Tracking
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function SyncIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}
function BellIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
}
function InfoIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}