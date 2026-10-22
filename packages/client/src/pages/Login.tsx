import type { Login } from "@hrp/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "../components/ui/BrandMark";
import { type ApiError, api } from "../lib/api";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <BrandMark size={64} variant="full" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">HRP Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">
            High-Risk Pregnancy Tracking for ANMs and CHOs
          </p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-gray-900">Sign in to your account</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            Use the employee ID issued by your facility.
          </p>

          {error && (
            <div className="mb-6 p-3 rounded-md bg-red-50 text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="employeeId" className="label">
                Employee ID
              </label>
              <input
                id="employeeId"
                type="text"
                autoComplete="username"
                className="input"
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
                className="input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loginMutation.isPending}
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Works offline. Data syncs when online.
          </p>
        </div>
      </div>
    </div>
  );
}
