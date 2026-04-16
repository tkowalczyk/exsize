import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    getGlobalLeaderboard: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getLeaderboard as getLeaderboardMock,
  getGlobalLeaderboard as getGlobalLeaderboardMock,
  ApiError,
} from "@/api";
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

  it("shows global leaderboard by default", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "alice@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 500, level: 5, streak: 3, position: 1,
        },
        {
          id: 11, email: "bob@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 300, level: 3, streak: 1, position: 2,
        },
      ],
      user_entry: null,
    });

    renderLeaderboard();

    expect(await screen.findByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("500 XP")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    expect(screen.getByText("300 XP")).toBeInTheDocument();
  });

  it("shows position numbers from server", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "alice@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 500, level: 5, streak: 3, position: 1,
        },
        {
          id: 11, email: "bob@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 300, level: 3, streak: 1, position: 2,
        },
      ],
      user_entry: null,
    });

    renderLeaderboard();
    await screen.findByText("alice@test.com");

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows user entry with divider when outside top 50", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "top@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 9999, level: 50, streak: 100, position: 1,
        },
      ],
      user_entry: {
        id: 2, email: "child@test.com", nickname: null,
        avatar_icon: null, avatar_background: null,
        xp: 5, level: 1, streak: 0, position: 51,
      },
    });

    renderLeaderboard();

    expect(await screen.findByText("child@test.com")).toBeInTheDocument();
    expect(screen.getByText("51")).toBeInTheDocument();
  });

  it("shows placeholder avatar when avatar_icon is null", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "alice@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 500, level: 5, streak: 3, position: 1,
        },
      ],
      user_entry: null,
    });

    renderLeaderboard();
    await screen.findByText("alice@test.com");

    // Default avatar placeholder
    expect(screen.getByText("👤")).toBeInTheDocument();
  });

  it("shows nickname when available instead of email", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "alice@test.com", nickname: "AliceX",
          avatar_icon: null, avatar_background: null,
          xp: 500, level: 5, streak: 3, position: 1,
        },
      ],
      user_entry: null,
    });

    renderLeaderboard();

    expect(await screen.findByText("AliceX")).toBeInTheDocument();
    // Email should not be displayed as the name
    expect(screen.queryByText("alice@test.com")).not.toBeInTheDocument();
  });

  it("switches to family tab and shows SizePass prompt on 403", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [],
      user_entry: null,
    });
    vi.mocked(getLeaderboardMock).mockRejectedValue(
      new ApiError(403, "Sibling leaderboard requires SizePass. Upgrade to access."),
    );

    renderLeaderboard();
    await screen.findByText("Leaderboard");

    const familyBtn = screen.getByRole("button", { name: "Family" });
    await userEvent.click(familyBtn);

    expect(
      await screen.findByText(/requires SizePass/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upgrade/i }),
    ).toBeInTheDocument();
  });

  it("shows family leaderboard entries when SizePass active", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [],
      user_entry: null,
    });
    vi.mocked(getLeaderboardMock).mockResolvedValue({
      entries: [
        { id: 2, email: "alice@test.com", nickname: null, avatar_icon: null, avatar_background: null, xp: 500, level: 5, streak: 0 },
        { id: 3, email: "bob@test.com", nickname: null, avatar_icon: null, avatar_background: null, xp: 300, level: 3, streak: 0 },
      ],
    });

    renderLeaderboard();
    await screen.findByText("Leaderboard");

    const familyBtn = screen.getByRole("button", { name: "Family" });
    await userEvent.click(familyBtn);

    expect(await screen.findByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
  });

  it("family tab shows nickname instead of email when available", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [],
      user_entry: null,
    });
    vi.mocked(getLeaderboardMock).mockResolvedValue({
      entries: [
        { id: 2, email: "alice@test.com", nickname: "AliceX", avatar_icon: null, avatar_background: null, xp: 500, level: 5, streak: 0 },
        { id: 3, email: "bob@test.com", nickname: null, avatar_icon: null, avatar_background: null, xp: 300, level: 3, streak: 0 },
      ],
    });

    renderLeaderboard();
    await screen.findByText("Leaderboard");

    const familyBtn = screen.getByRole("button", { name: "Family" });
    await userEvent.click(familyBtn);

    expect(await screen.findByText("AliceX")).toBeInTheDocument();
    expect(screen.queryByText("alice@test.com")).not.toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
  });

  it("family tab shows avatar and streak", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [],
      user_entry: null,
    });
    vi.mocked(getLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 2, email: "alice@test.com", nickname: null,
          avatar_icon: "🦊", avatar_background: "#ff0000",
          xp: 500, level: 5, streak: 7,
        },
        {
          id: 3, email: "bob@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 300, level: 3, streak: 0,
        },
      ],
    });

    renderLeaderboard();
    await screen.findByText("Leaderboard");

    const familyBtn = screen.getByRole("button", { name: "Family" });
    await userEvent.click(familyBtn);

    // Avatar icon rendered
    expect(await screen.findByText("🦊")).toBeInTheDocument();
    // Default avatar for bob (no equipped icon)
    expect(screen.getByText("👤")).toBeInTheDocument();
    // Streak displayed
    expect(screen.getByText(/7 streak/)).toBeInTheDocument();
  });

  describe("responsive layout", () => {
    it("leaderboard rows stack vertically on mobile", async () => {
      vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
        entries: [
          {
            id: 10, email: "alice@test.com", nickname: null,
            avatar_icon: null, avatar_background: null,
            xp: 500, level: 5, streak: 3, position: 1,
          },
        ],
        user_entry: null,
      });

      renderLeaderboard();
      await screen.findByText("alice@test.com");

      const row = screen.getByText("alice@test.com").closest("[data-testid='leaderboard-row']");
      expect(row).toBeInTheDocument();
      expect(row!.className).toMatch(/flex-col/);
      expect(row!.className).toMatch(/sm:flex-row/);
    });

    it("tab buttons have minimum 44px touch target on mobile", async () => {
      vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
        entries: [],
        user_entry: null,
      });

      renderLeaderboard();
      await screen.findByText("Leaderboard");

      const globalBtn = screen.getByRole("button", { name: "Global" });
      const familyBtn = screen.getByRole("button", { name: "Family" });
      expect(globalBtn.className).toMatch(/min-h-\[44px\]/);
      expect(familyBtn.className).toMatch(/min-h-\[44px\]/);
    });
  });

  it("shows streak info in global leaderboard entries", async () => {
    vi.mocked(getGlobalLeaderboardMock).mockResolvedValue({
      entries: [
        {
          id: 10, email: "alice@test.com", nickname: null,
          avatar_icon: null, avatar_background: null,
          xp: 500, level: 5, streak: 7, position: 1,
        },
      ],
      user_entry: null,
    });

    renderLeaderboard();
    await screen.findByText("alice@test.com");

    expect(screen.getByText(/7 streak/)).toBeInTheDocument();
  });
});
