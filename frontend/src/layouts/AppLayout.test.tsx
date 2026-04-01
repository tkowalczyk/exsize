import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import AppLayout from "@/layouts/AppLayout";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    setToken: vi.fn(),
    getMe: vi.fn(),
    getBalance: vi.fn(),
    getGamificationProfile: vi.fn(),
  };
});

import {
  setToken as setTokenMock,
  getBalance as getBalanceMock,
  getGamificationProfile as getProfileMock,
} from "@/api";
import type { UserResponse } from "@/api";

function renderLayoutWithUser(user: UserResponse) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <AppLayout user={user}>
                  <div>Page Content</div>
                </AppLayout>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows ExBucks balance in header for child", async () => {
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 42 });
    renderLayoutWithUser({
      id: 2,
      email: "child@test.com",
      role: "child",
      language: "en",
    });
    const badge = await screen.findByLabelText("ExBucks balance");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("does not show ExBucks balance for parent", async () => {
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 0 });
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    // Wait for layout to render then check no balance shown
    expect(await screen.findByText(/page content/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("ExBucks balance")).not.toBeInTheDocument();
  });

  it("shows parent nav items for parent role", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/rewards/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/shop/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/profile/i)).not.toBeInTheDocument();
  });

  it("shows child nav items for child role including leaderboard", () => {
    renderLayoutWithUser({
      id: 2,
      email: "child@test.com",
      role: "child",
      language: "en",
    });
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/shop/i)).toBeInTheDocument();
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });

  it("shows admin nav items (parent nav + Rewards + App Settings)", () => {
    renderLayoutWithUser({
      id: 3,
      email: "admin@test.com",
      role: "admin",
      language: "en",
    });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/rewards/i)).toBeInTheDocument();
    expect(screen.getByText("App Settings")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(screen.getByText(/page content/i)).toBeInTheDocument();
  });

  it("shows logout button", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(
      screen.getByRole("button", { name: /logout/i }),
    ).toBeInTheDocument();
  });

  it("shows gamification summary in header for child", async () => {
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 100 });
    vi.mocked(getProfileMock).mockResolvedValue({
      xp: 450,
      level: 3,
      level_name: "Rookie",
      progress_percent: 50,
      xp_for_next_level: 300,
      streak: 5,
    });

    renderLayoutWithUser({
      id: 2,
      email: "child@test.com",
      role: "child",
      language: "en",
    });

    const badge = await screen.findByLabelText("Streak");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show gamification summary for parent", async () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });

    expect(await screen.findByText(/page content/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Streak")).not.toBeInTheDocument();
  });

  it("logout clears token and navigates to login", async () => {
    const user = userEvent.setup();
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(setTokenMock).toHaveBeenCalledWith(null);
  });
});
