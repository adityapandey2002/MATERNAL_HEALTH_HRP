import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import Login from "../pages/Login";

vi.mock("../lib/api", () => ({
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

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders login form", () => {
    render(<Login />, { wrapper: createWrapper() });
    expect(screen.getByLabelText("Employee ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error on failed login", async () => {
    vi.mocked(api.auth.login).mockRejectedValueOnce(new Error("Invalid credentials"));
    render(<Login />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "ANM001" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("stores the access token on success and never persists the refresh token", async () => {
    vi.mocked(api.auth.login).mockResolvedValueOnce({
      accessToken: "access-123",
      user: {
        id: "1",
        employeeId: "ANM001",
        name: "Test ANM",
        phone: "9999999999",
        role: "ANM",
        facilityId: "f1",
        language: "hi",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    render(<Login />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText("Employee ID"), { target: { value: "ANM001" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith("accessToken", "access-123");
    });

    // The refresh token is delivered as an httpOnly cookie and must never be
    // written to localStorage, where script could read it.
    expect(localStorage.setItem).not.toHaveBeenCalledWith("refreshToken", expect.anything());
  });
});
