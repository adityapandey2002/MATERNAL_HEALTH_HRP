import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
    },
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form', () => {
    render(<Login />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Employee ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error on failed login', async () => {
    api.auth.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<Login />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText('EmployeeId'), { target: { value: 'ANM001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('stores tokens and redirects on success', async () => {
    api.auth.login.mockResolvedValueOnce({
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      user: { id: '1', employeeId: 'ANM001', name: 'Test ANM', phone: '9999999999', role: 'ANM', facilityId: 'f1', language: 'hi', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    });

    render(<Login />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText('EmployeeId'), { target: { value: 'ANM001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-123');
    });
  });
});