import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import ProfilePage from "@/pages/ProfilePage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getProfile: vi.fn(),
    getChildProfile: vi.fn(),
    setNickname: vi.fn(),
  };
});

import { getProfile as getProfileMock, getChildProfile as getChildProfileMock, setNickname as setNicknameMock } from "@/api";
import userEvent from "@testing-library/user-event";
import type { UserResponse, ProfileResponse } from "@/api";

const MOCK_PROFILE: ProfileResponse = {
  nickname: null,
  nickname_changes: 0,
  xp: 450,
  level: 3,
  level_name: "Rookie",
  progress_percent: 50,
  xp_for_next_level: 300,
  streak: 5,
  exbucks_balance: 120,
  badges: ["Freemium"],
  transactions: [
    { id: 1, type: "earned", amount: 50, description: "Completed: Push-ups", created_at: "2026-03-27T10:00:00Z" },
    { id: 2, type: "spent", amount: -30, description: "Purchased: Extra screen time", created_at: "2026-03-26T15:00:00Z" },
  ],
};

function renderProfilePage(role: "child" | "parent" = "child", childId?: number) {
  const user: UserResponse = {
    id: role === "child" ? 2 : 1,
    email: `${role}@test.com`,
    role,
    language: "en",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const path = childId ? `/profile/${childId}` : "/profile";
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile/:childId" element={<ProfilePage user={user} />} />
            <Route path="/profile" element={<ProfilePage user={user} />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("child sees current level number and title", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("child");

    expect(await screen.findByText(/level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/rookie/i)).toBeInTheDocument();
  });

  it("child sees total XP and XP needed for next level", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("child");

    expect(await screen.findByText(/450 xp/i)).toBeInTheDocument();
    expect(screen.getByText(/300 xp to next level/i)).toBeInTheDocument();
  });

  it("progress bar shows accurate percentage to next level", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("child");

    const progressBar = await screen.findByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("child sees streak count", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("child");

    expect(await screen.findByText(/5 day streak/i)).toBeInTheDocument();
  });

  it("shows singular 'day' for streak of 1", async () => {
    vi.mocked(getProfileMock).mockResolvedValue({ ...MOCK_PROFILE, streak: 1 });

    renderProfilePage("child");

    expect(await screen.findByText(/1 day streak/i)).toBeInTheDocument();
  });

  it("displays earned badges from API", async () => {
    vi.mocked(getProfileMock).mockResolvedValue({
      ...MOCK_PROFILE,
      badges: ["Freemium", "Rising Star"],
    });

    renderProfilePage("child");

    expect(await screen.findByText("Freemium")).toBeInTheDocument();
    expect(screen.getByText("Rising Star")).toBeInTheDocument();
  });

  it("shows only badges returned by the API", async () => {
    vi.mocked(getProfileMock).mockResolvedValue({
      ...MOCK_PROFILE,
      badges: ["SizePass"],
    });

    renderProfilePage("child");

    expect(await screen.findByText("SizePass")).toBeInTheDocument();
    expect(screen.queryByText("Freemium")).not.toBeInTheDocument();
  });

  it("parent can view child's profile via /profile/:childId", async () => {
    vi.mocked(getChildProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("parent", 2);

    expect(await screen.findByText(/level 3/i)).toBeInTheDocument();
    expect(screen.getByText(/rookie/i)).toBeInTheDocument();
    expect(screen.getByText(/5 day streak/i)).toBeInTheDocument();
    expect(screen.getByText("Freemium")).toBeInTheDocument();
    expect(getChildProfileMock).toHaveBeenCalledWith(2);
  });

  it("parent without childId sees message to select a child", async () => {
    renderProfilePage("parent");

    expect(await screen.findByText(/select a child/i)).toBeInTheDocument();
  });

  it("E2E: child views own profile → parent views child's profile → data matches", async () => {
    const sharedProfile: ProfileResponse = {
      nickname_changes: 0,
      xp: 200,
      level: 2,
      level_name: "Starter",
      progress_percent: 40,
      xp_for_next_level: 200,
      streak: 3,
      exbucks_balance: 75,
      badges: ["Freemium", "First Task"],
      transactions: [
        { id: 10, type: "earned", amount: 25, description: "Completed: Squats", created_at: "2026-03-28T08:00:00Z" },
      ],
    };

    // Step 1: Child views their own profile
    vi.mocked(getProfileMock).mockResolvedValue(sharedProfile);

    const { unmount } = renderProfilePage("child");

    expect(await screen.findByText(/level 2/i)).toBeInTheDocument();
    expect(screen.getByText(/starter/i)).toBeInTheDocument();
    expect(screen.getByText(/200 xp/i)).toBeInTheDocument();
    const childBar = screen.getByRole("progressbar");
    expect(childBar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText(/3 day streak/i)).toBeInTheDocument();
    expect(screen.getByText("Freemium")).toBeInTheDocument();
    expect(screen.getByText("First Task")).toBeInTheDocument();

    unmount();

    // Step 2: Parent views same child's profile — sees identical data
    vi.mocked(getChildProfileMock).mockResolvedValue(sharedProfile);

    renderProfilePage("parent", 2);

    expect(await screen.findByText(/level 2/i)).toBeInTheDocument();
    expect(screen.getByText(/starter/i)).toBeInTheDocument();
    expect(screen.getByText(/200 xp/i)).toBeInTheDocument();
    const parentBar = screen.getByRole("progressbar");
    expect(parentBar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText(/3 day streak/i)).toBeInTheDocument();
    expect(screen.getByText("Freemium")).toBeInTheDocument();
    expect(screen.getByText("First Task")).toBeInTheDocument();
    expect(getChildProfileMock).toHaveBeenCalledWith(2);
  });

  it("displays nickname when set", async () => {
    vi.mocked(getProfileMock).mockResolvedValue({
      ...MOCK_PROFILE,
      nickname: "CoolKid",
    });

    renderProfilePage("child");

    expect(await screen.findByText("CoolKid")).toBeInTheDocument();
  });

  it("shows nickname edit form for child", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);

    renderProfilePage("child");

    expect(await screen.findByLabelText(/nickname/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save nickname/i })).toBeInTheDocument();
  });

  it("calls setNickname API when form submitted", async () => {
    vi.mocked(getProfileMock).mockResolvedValue(MOCK_PROFILE);
    vi.mocked(setNicknameMock).mockResolvedValue({ nickname: "NewNick", nickname_changes: 1 });

    renderProfilePage("child");

    const input = await screen.findByLabelText(/nickname/i);
    await userEvent.clear(input);
    await userEvent.type(input, "NewNick");
    await userEvent.click(screen.getByRole("button", { name: /save nickname/i }));

    expect(setNicknameMock).toHaveBeenCalledWith("NewNick");
  });

  it("parent sees child nickname but cannot edit", async () => {
    vi.mocked(getChildProfileMock).mockResolvedValue({
      ...MOCK_PROFILE,
      nickname: "ChildNick",
    });

    renderProfilePage("parent", 2);

    expect(await screen.findByText("ChildNick")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save nickname/i })).not.toBeInTheDocument();
  });
});
