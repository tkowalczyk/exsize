import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import DashboardPage from "@/pages/DashboardPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getDashboard: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import { getDashboard as getDashboardMock } from "@/api";
import type { UserResponse, DashboardResponse } from "@/api";

function renderDashboard() {
  const user: UserResponse = {
    id: 1,
    email: "parent@test.com",
    role: "parent",
    language: "en",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows per-child stat cards with completion %, streak, ExBucks earned/spent", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 75, streak: 3, exbucks_earned: 50, exbucks_spent: 20 },
        { id: 3, email: "bob@test.com", tasks_completed_percent: 40, streak: 1, exbucks_earned: 30, exbucks_spent: 10 },
      ],
      weekly_overview: {},
      advanced_stats: null,
    });

    renderDashboard();

    // Child 1 stats
    expect(await screen.findByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    // Child 2 stats
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows weekly overview with task completion by day across children", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 50, streak: 1, exbucks_earned: 10, exbucks_spent: 0 },
      ],
      weekly_overview: {
        Monday: [{ child_id: 2, email: "alice@test.com", total: 3, approved: 2 }],
        Tuesday: [],
        Wednesday: [{ child_id: 2, email: "alice@test.com", total: 2, approved: 1 }],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: [],
      },
      advanced_stats: null,
    });

    renderDashboard();

    // Weekly overview heading
    expect(await screen.findByText("Weekly Overview")).toBeInTheDocument();

    // Day labels
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Wednesday")).toBeInTheDocument();

    // Task counts: "email: approved/total" format
    expect(screen.getByText(/alice@test\.com: 2\/3/)).toBeInTheDocument();
    expect(screen.getByText(/alice@test\.com: 1\/2/)).toBeInTheDocument();
  });

  it("handles empty state when no children exist", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [],
      weekly_overview: {},
      advanced_stats: null,
    });

    renderDashboard();

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/no children/i)).toBeInTheDocument();
    // No stat cards or weekly overview should render
    expect(screen.queryByText("Weekly Overview")).not.toBeInTheDocument();
  });

  it("handles multi-child families with separate stat cards per child", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 100, streak: 5, exbucks_earned: 80, exbucks_spent: 30 },
        { id: 3, email: "bob@test.com", tasks_completed_percent: 60, streak: 2, exbucks_earned: 40, exbucks_spent: 10 },
      ],
      weekly_overview: {
        Monday: [
          { child_id: 2, email: "alice@test.com", total: 2, approved: 2 },
          { child_id: 3, email: "bob@test.com", total: 2, approved: 1 },
        ],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: [],
      },
      advanced_stats: null,
    });

    renderDashboard();

    // Both children appear
    expect(await screen.findByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();

    // Both children appear in weekly overview for Monday
    expect(screen.getByText(/alice@test\.com: 2\/2/)).toBeInTheDocument();
    expect(screen.getByText(/bob@test\.com: 1\/2/)).toBeInTheDocument();
  });

  it("shows advanced stats (XP, level per child) for SizePass parent", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 75, streak: 3, exbucks_earned: 50, exbucks_spent: 20 },
      ],
      weekly_overview: {},
      advanced_stats: {
        total_xp_earned: 800,
        best_streak: 7,
        children: [
          { id: 2, email: "alice@test.com", total_tasks: 10, approved_tasks: 8, xp: 500, level: 5 },
        ],
      },
    });

    renderDashboard();

    expect(await screen.findByText("Advanced Stats")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument(); // total XP
    expect(screen.getByText("7")).toBeInTheDocument(); // best streak
    expect(screen.getByText("500 XP")).toBeInTheDocument(); // child XP
    expect(screen.getByText("Level 5")).toBeInTheDocument(); // child level
  });

  it("shows upgrade indicator when advanced_stats is null (free parent)", async () => {
    vi.mocked(getDashboardMock).mockResolvedValue({
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 75, streak: 3, exbucks_earned: 50, exbucks_spent: 20 },
      ],
      weekly_overview: {},
      advanced_stats: null,
    });

    renderDashboard();

    await screen.findByText("alice@test.com");
    expect(screen.getByText(/advanced stats/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("E2E: parent sees dashboard → approves task → stats update", async () => {
    // Step 1: Parent sees initial dashboard
    const initialData: DashboardResponse = {
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 50, streak: 1, exbucks_earned: 20, exbucks_spent: 5 },
      ],
      weekly_overview: {
        Monday: [{ child_id: 2, email: "alice@test.com", total: 2, approved: 1 }],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: [],
      },
      advanced_stats: null,
    };
    vi.mocked(getDashboardMock).mockResolvedValue(initialData);

    const { unmount } = renderDashboard();

    expect(await screen.findByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/alice@test\.com: 1\/2/)).toBeInTheDocument();
    unmount();

    // Step 2: After parent approves a task (simulated), dashboard shows updated stats
    const updatedData: DashboardResponse = {
      children: [
        { id: 2, email: "alice@test.com", tasks_completed_percent: 100, streak: 2, exbucks_earned: 30, exbucks_spent: 5 },
      ],
      weekly_overview: {
        Monday: [{ child_id: 2, email: "alice@test.com", total: 2, approved: 2 }],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: [],
        Sunday: [],
      },
      advanced_stats: null,
    };
    vi.mocked(getDashboardMock).mockResolvedValue(updatedData);

    renderDashboard();

    // Stats reflect the approval
    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // streak
    expect(screen.getByText("30")).toBeInTheDocument(); // earned
    expect(screen.getByText(/alice@test\.com: 2\/2/)).toBeInTheDocument();
  });
});
