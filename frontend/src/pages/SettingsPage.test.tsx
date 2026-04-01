import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import SettingsPage from "@/pages/SettingsPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
    requestAccountDeletion: vi.fn(),
    deleteOwnAccount: vi.fn(),
  };
});

import {
  getSubscription as getSubscriptionMock,
  cancelSubscription as cancelSubscriptionMock,
  requestAccountDeletion as requestAccountDeletionMock,
  deleteOwnAccount as deleteOwnAccountMock,
} from "@/api";
import type { UserResponse } from "@/api";

function renderSettings(role: "parent" | "child" = "parent") {
  const user: UserResponse = {
    id: 1,
    email: `${role}@test.com`,
    role,
    language: "en",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <SettingsPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Free plan status for free users", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });

    renderSettings();

    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(await screen.findByText("Subscription")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("shows SizePass plan status for subscribed users", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "sizepass",
      status: "active",
    });

    renderSettings();

    expect(await screen.findByText("SizePass")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows upgrade prompt for free users", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });

    renderSettings();

    expect(
      await screen.findByRole("button", { name: /upgrade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/leaderboards, advanced stats/i),
    ).toBeInTheDocument();
  });

  it("upgrade button links to /sizepass", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });

    renderSettings();

    const link = await screen.findByRole("link", { name: /upgrade/i });
    expect(link).toHaveAttribute("href", "/sizepass");
  });

  it("shows cancel button for active subscription", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "monthly",
      status: "active",
    });

    renderSettings("parent");

    expect(
      await screen.findByRole("button", { name: /cancel subscription/i }),
    ).toBeInTheDocument();
  });

  it("does not show upgrade prompt for SizePass users", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "sizepass",
      status: "active",
    });

    renderSettings();

    await screen.findByText("SizePass");
    expect(
      screen.queryByRole("button", { name: /upgrade/i }),
    ).not.toBeInTheDocument();
  });

  it("child sees request account deletion button", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });

    renderSettings("child");

    expect(await screen.findByRole("button", { name: /request account deletion/i })).toBeInTheDocument();
  });

  it("child clicks request deletion → sees confirmation → confirms → sees success message", async () => {
    const user = userEvent.setup();
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });
    vi.mocked(requestAccountDeletionMock).mockResolvedValue({ id: 1, child_id: 1, status: "pending" });

    renderSettings("child");

    await user.click(await screen.findByRole("button", { name: /request account deletion/i }));

    expect(await screen.findByText(/this action cannot be undone/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(requestAccountDeletionMock).toHaveBeenCalled();
    expect(await screen.findByText(/deletion request has been sent/i)).toBeInTheDocument();
  });

  it("parent sees delete my account button", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });

    renderSettings("parent");

    expect(await screen.findByRole("button", { name: /delete my account/i })).toBeInTheDocument();
  });

  it("parent clicks delete account → sees confirmation → confirms → logs out", async () => {
    const user = userEvent.setup();
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });
    vi.mocked(deleteOwnAccountMock).mockResolvedValue({ detail: "Deleted" });

    renderSettings("parent");

    await user.click(await screen.findByRole("button", { name: /delete my account/i }));

    expect(await screen.findByText(/this action cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(deleteOwnAccountMock).toHaveBeenCalled();
  });

  it("parent does not see request deletion button (only children do)", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });

    renderSettings("parent");

    await screen.findByRole("button", { name: /delete my account/i });
    expect(screen.queryByRole("button", { name: /request account deletion/i })).not.toBeInTheDocument();
  });

  it("child does not see delete my account button (only parents do)", async () => {
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });

    renderSettings("child");

    await screen.findByRole("button", { name: /request account deletion/i });
    expect(screen.queryByRole("button", { name: /delete my account/i })).not.toBeInTheDocument();
  });

  it("child can cancel deletion request confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });

    renderSettings("child");

    await user.click(await screen.findByRole("button", { name: /request account deletion/i }));
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/this action cannot be undone/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request account deletion/i })).toBeInTheDocument();
  });

  it("E2E: child requests deletion → sees confirmation → confirms → sees success", async () => {
    const user = userEvent.setup();

    // Step 1: Child sees settings with deletion option
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });
    vi.mocked(requestAccountDeletionMock).mockResolvedValue({ id: 1, child_id: 1, status: "pending" });

    renderSettings("child");

    // Step 2: Click request deletion
    await user.click(await screen.findByRole("button", { name: /request account deletion/i }));

    // Step 3: See warning and confirm
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    // Step 4: See success message, button is gone
    expect(await screen.findByText(/deletion request has been sent/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request account deletion/i })).not.toBeInTheDocument();
  });

  it("E2E: parent deletes own account → sees confirmation → confirms → logged out", async () => {
    const user = userEvent.setup();
    vi.mocked(getSubscriptionMock).mockResolvedValue({ plan: "free", status: "free" });
    vi.mocked(deleteOwnAccountMock).mockResolvedValue({ detail: "Deleted" });

    renderSettings("parent");

    await user.click(await screen.findByRole("button", { name: /delete my account/i }));
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(deleteOwnAccountMock).toHaveBeenCalled();
  });

  it("E2E: free user sees upgrade prompts → SizePass user sees premium features", async () => {
    // Step 1: Free user sees upgrade prompt on settings
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });

    const { unmount: u1 } = renderSettings("parent");

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upgrade/i }),
    ).toBeInTheDocument();
    u1();

    // Step 2: SizePass user sees active status, no upgrade prompt
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "sizepass",
      status: "active",
    });

    const { unmount: u2 } = renderSettings("parent");

    expect(await screen.findByText("SizePass")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upgrade/i }),
    ).not.toBeInTheDocument();
    u2();
  });
});
