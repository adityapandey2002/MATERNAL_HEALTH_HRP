import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './lib/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import NewVisit from './pages/NewVisit';
import Referrals from './pages/Referrals';
import Supervision from './pages/Supervision';
import Settings from './pages/Settings';
import Offline from './pages/Offline';
import { isOnline, onOnlineChange } from './utils/sw';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setAuthed(false);
      return;
    }
    api.auth.me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="flex h-screen items-center justify-center">Loading…</div>;
  if (!authed) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setAuthed(false); return; }
    api.auth.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="flex h-screen items-center justify-center">Loading…</div>;
  if (authed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OnlineGuard({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    return onOnlineChange(setOnline);
  }, []);
  if (!online) return <Offline />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();

  return (
    <OnlineGuard>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<PatientDetail />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/patients/:id/visit" element={<NewVisit />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/supervision" element={<Supervision />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OnlineGuard>
  );
}