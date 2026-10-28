import type { Login } from "@hrp/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "../components/ui/BrandMark";
import { CheckIcon, ShieldCheckIcon } from "../components/ui/Icons";
import { type ApiError, api } from "../lib/api";

const CAPABILITIES = [
  "Register high-risk pregnancies at the village level",
  "Record ANC vitals and danger signs offline",
  "Refer to the right facility with the right urgency",
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Login>({ employeeId: "", password: "" });
  const [error, setError] = useState("");

  const loginMutation = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (data) => {
      localStorage.setItem("accessToken", data.accessToken);
      navigate("/");
    },
    onError: (err: ApiError) => {
      setError(err.message || "Invalid credentials");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary-dark px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #7dd6cd 0, transparent 45%), radial-gradient(circle at 80% 70%, #0073ae 0, transparent 40%)",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandMark size={44} variant="full" title={null} />
            <div>
              <p className="text-sm font-semibold leading-tight">HRP Tracking</p>
              <p className="text-2xs uppercase tracking-wider text-primary-ring">Araria district</p>
            </div>
          </div>

          <h1 className="mt-12 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Every high-risk pregnancy, followed to the last mile.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-ring">
            A field-first register for ANMs, CHOs and district officers. Built to work when the
            network does not.
          </p>

          <ul className="mt-8 space-y-3">
            {CAPABILITIES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15"
                >
                  <CheckIcon className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-12 flex items-start gap-2.5 rounded border border-white/20 bg-white/5 px-4 py-3">
          <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary-ring" />
          <p className="text-xs leading-relaxed text-white/80">
            This public deployment carries synthetic demo data only. Do not enter real patient
            information.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark size={40} variant="full" title={null} />
            <div>
              <p className="text-sm font-semibold leading-tight text-ink">HRP Tracking</p>
              <p className="text-2xs uppercase tracking-wider text-ink-subtle">Araria district</p>
            </div>
          </div>

          <div className="panel p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Sign in to your account
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Use the employee ID issued by your facility.
            </p>

            {error && (
              <div
                className="mt-5 rounded border border-triage-red-line bg-triage-red-bg px-3 py-2.5 text-sm text-triage-red"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="employeeId" className="label">
                  Employee ID
                </label>
                <input
                  id="employeeId"
                  type="text"
                  autoComplete="username"
                  className="input mt-1.5"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  required
                  disabled={loginMutation.isPending}
                  placeholder="e.g. ANM001"
                />
              </div>
              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="input mt-1.5"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={loginMutation.isPending}
                  placeholder="Enter your password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                    />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-subtle">
              <CheckIcon className="h-3.5 w-3.5 text-triage-green-solid" />
              Works offline. Data syncs when online.
            </p>
          </div>

          <div className="mt-4 rounded border border-line bg-surface px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
              Demo access
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              ANM001 or CHO001 · password <span className="tnum font-medium">password123</span>.
              Synthetic data only.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
