import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import LeaderboardPage from "@/pages/LeaderboardPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getLeaderboard: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import { getLeaderboard as getLeaderboardMock, ApiError } from "@/api";
import type { UserResponse } from "@/api";

function renderLeaderboard() {
  const user: UserResponse = {
    id: 2,
    email: "child@test.com",
    role: "child",
    language: "en",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <LeaderboardPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows sibling leaderboard entries for SizePass child", async () => {
    vi.mocked(getLeaderboardMock).mockResolvedValue({
      entries: [
        { id: 2, email: "alice@test.com", xp: 500, level: 5 },
        { id: 3, email: "bob@test.com", xp: 300, level: 3 },
      ],
    });

    renderLeaderboard();

    expect(await screen.findByText("Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("500 XP")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    expect(screen.getByText("300 XP")).toBeInTheDocument();
  });

  it("shows upgrade prompt for free child (403)", async () => {
    vi.mocked(getLeaderboardMock).mockRejectedValue(
      new ApiError(403, "Sibling leaderboard requires SizePass. Upgrade to access."),
    );

    renderLeaderboard();

    expect(
      await screen.findByText(/requires SizePass/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upgrade/i }),
    ).toBeInTheDocument();
  });

  it("shows rank position for each entry", async () => {
    vi.mocked(getLeaderboardMock).mockResolvedValue({
      entries: [
        { id: 2, email: "alice@test.com", xp: 500, level: 5 },
        { id: 3, email: "bob@test.com", xp: 300, level: 3 },
      ],
    });

    renderLeaderboard();

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });
});
