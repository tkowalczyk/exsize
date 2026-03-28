import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import LoginPage from "@/pages/LoginPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    login: vi.fn(),
    adminLogin: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  login as loginMock,
  adminLogin as adminLoginMock,
  getMe as getMeMock,
} from "@/api";

function renderLoginWithRoutes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Parent Dashboard</div>} />
            <Route path="/tasks" element={<div>Child Tasks</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields and a submit button", () => {
    renderLoginWithRoutes();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("calls login API with email and password on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(loginMock).mockResolvedValue({
      access_token: "test-token",
      token_type: "bearer",
    });
    vi.mocked(getMeMock).mockResolvedValue({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });

    renderLoginWithRoutes();
    await user.type(screen.getByLabelText(/email/i), "parent@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(loginMock).toHaveBeenCalledWith("parent@test.com", "password123");
  });

  it("redirects parent to /dashboard after login", async () => {
    const user = userEvent.setup();
    vi.mocked(loginMock).mockResolvedValue({
      access_token: "test-token",
      token_type: "bearer",
    });
    vi.mocked(getMeMock).mockResolvedValue({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });

    renderLoginWithRoutes();
    await user.type(screen.getByLabelText(/email/i), "parent@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(
      await screen.findByText(/parent dashboard/i),
    ).toBeInTheDocument();
  });

  it("redirects child to /tasks after login", async () => {
    const user = userEvent.setup();
    vi.mocked(loginMock).mockResolvedValue({
      access_token: "child-token",
      token_type: "bearer",
    });
    vi.mocked(getMeMock).mockResolvedValue({
      id: 2,
      email: "child@test.com",
      role: "child",
      language: "en",
    });

    renderLoginWithRoutes();
    await user.type(screen.getByLabelText(/email/i), "child@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/child tasks/i)).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup();
    vi.mocked(loginMock).mockRejectedValue(new Error("Invalid credentials"));

    renderLoginWithRoutes();
    await user.type(screen.getByLabelText(/email/i), "bad@test.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("hides email/password and shows admin secret when Login as Admin is checked", async () => {
    const user = userEvent.setup();
    renderLoginWithRoutes();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/admin secret/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /login as admin/i }));

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/admin secret/i)).toBeInTheDocument();
  });

  it("calls adminLogin API with secret when logging in as admin", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLoginMock).mockResolvedValue({
      access_token: "admin-token",
      token_type: "bearer",
    });
    vi.mocked(getMeMock).mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      role: "admin",
      language: "en",
    });

    renderLoginWithRoutes();

    await user.click(screen.getByRole("checkbox", { name: /login as admin/i }));
    await user.type(screen.getByLabelText(/admin secret/i), "my-secret");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(adminLoginMock).toHaveBeenCalledWith("my-secret");
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("redirects admin to /dashboard after login", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLoginMock).mockResolvedValue({
      access_token: "admin-token",
      token_type: "bearer",
    });
    vi.mocked(getMeMock).mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      role: "admin",
      language: "en",
    });

    renderLoginWithRoutes();

    await user.click(screen.getByRole("checkbox", { name: /login as admin/i }));
    await user.type(screen.getByLabelText(/admin secret/i), "my-secret");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/parent dashboard/i)).toBeInTheDocument();
  });

  it("restores email/password fields when unchecking Login as Admin", async () => {
    const user = userEvent.setup();
    renderLoginWithRoutes();

    await user.click(screen.getByRole("checkbox", { name: /login as admin/i }));
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /login as admin/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/admin secret/i)).not.toBeInTheDocument();
  });

  it("has a link to register page", () => {
    renderLoginWithRoutes();
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
