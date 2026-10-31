import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { api } from "./lib/api";
import AddPatient from "./pages/AddPatient";
import Dashboard from "./pages/Dashboard";
import FollowUps from "./pages/FollowUps";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NewVisit from "./pages/NewVisit";
import Offline from "./pages/Offline";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import Settings from "./pages/Settings";
import Supervision from "./pages/Supervision";
import TeamAccess from "./pages/TeamAccess";
import { isOnline, onOnlineChange } from "./utils/sw";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
        MS
      </div>
      <div>
        <h1 className="text-base font-semibold text-ink">Matru Suraksha</h1>
        <p className="text-sm text-ink-subtle">High-risk pregnancy care · Araria</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-subtle">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/team" element={<TeamAccess />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<AddPatient />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/patients/:id/visit" element={<NewVisit />} />
          <Route path="/supervision" element={<Supervision />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OnlineGuard>
  );
}
