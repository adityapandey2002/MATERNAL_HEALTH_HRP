import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { api } from "./lib/api";
import AddHome from "./pages/AddHome";
import AddPatient from "./pages/AddPatient";
import Dashboard from "./pages/Dashboard";
import FollowUps from "./pages/FollowUps";
import Login from "./pages/Login";
import NewVisit from "./pages/NewVisit";
import Offline from "./pages/Offline";
import PatientDetail from "./pages/PatientDetail";
import Referrals from "./pages/Referrals";
import Settings from "./pages/Settings";
import Supervision from "./pages/Supervision";
import { isOnline, onOnlineChange } from "./utils/sw";

function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-green-50 to-white text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 text-2xl font-bold text-white shadow-lg">
        HRP
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-gray-900">High-Risk Pregnancy Tracking</h1>
        <p className="text-sm text-gray-500">of Araria</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <span>Waking up the server…</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAuthed(false);
      return;
    }
    api.auth
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <LoadingScreen />;
  if (!authed) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAuthed(false);
      return;
    }
    api.auth
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <LoadingScreen />;
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
  return (
    <OnlineGuard>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<AddHome />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/patients/new" element={<AddPatient />} />
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
