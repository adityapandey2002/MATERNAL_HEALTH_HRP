import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Login } from '@hrp/shared';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Login>({ employeeId: '', password: '' });
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: api.auth.login,
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      navigate('/');
    },
    onError: (err: ApiError) => {
      setError(err.message || 'Invalid credentials');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <svg className="w-16 h-16 mx-auto text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">HRP Tracker</h1>
            <p className="mt-1 text-gray-500">High-Risk Pregnancy Tracking</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="employeeId" className="label">Employee ID</label>
              <input
                id="employeeId"
                type="text"
                autoComplete="username"
                className="input"
                value={formData.employeeId}
                onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                required
                disabled={loginMutation.isPending}
                placeholder="Enter your employee ID"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Signing in…
                </>
              ) : (
                'Sign In'
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