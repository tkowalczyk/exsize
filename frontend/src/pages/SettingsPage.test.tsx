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
    checkout: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import { getSubscription as getSubscriptionMock, checkout as checkoutMock } from "@/api";
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

  it("shows coming soon message when upgrade button is clicked (503)", async () => {
    const user = userEvent.setup();
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });
    vi.mocked(checkoutMock).mockRejectedValue(
      new (await import("@/api")).ApiError(503, "SizePass is not yet available"),
    );

    renderSettings();

    await user.click(
      await screen.findByRole("button", { name: /upgrade/i }),
    );

    expect(await screen.findByText(/coming soon/i)).toBeInTheDocument();
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
