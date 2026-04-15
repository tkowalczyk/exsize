import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import SizePassPage from "@/pages/SizePassPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getSubscription: vi.fn(),
    checkout: vi.fn(),
    cancelSubscription: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import { getSubscription as getSubscriptionMock } from "@/api";
import type { UserResponse } from "@/api";

function renderSizePassPage(role: "parent" | "child" = "parent") {
  const user: UserResponse = { id: 1, email: `${role}@test.com`, role, language: "en" };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <SizePassPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("SizePassPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("responsive layout", () => {
    it("active subscription card stacks info and cancel button on mobile", async () => {
      vi.mocked(getSubscriptionMock).mockResolvedValue({
        plan: "monthly",
        status: "active",
      });

      renderSizePassPage("parent");

      const activeText = await screen.findByText(/SizePass Active/);
      const cardContent = activeText.closest("[data-testid='sizepass-active-card']");
      expect(cardContent).toBeInTheDocument();
      expect(cardContent!.className).toMatch(/flex-col/);
      expect(cardContent!.className).toMatch(/sm:flex-row/);
    });

    it("plan cards grid is single column on mobile, 2-col on md+", async () => {
      vi.mocked(getSubscriptionMock).mockResolvedValue({
        plan: "free",
        status: "inactive",
      });

      renderSizePassPage("parent");

      const buyBtns = await screen.findAllByRole("button", { name: "Buy" });
      const grid = buyBtns[0].closest("[data-testid='plans-grid']");
      expect(grid).toBeInTheDocument();
      expect(grid!.className).toMatch(/grid/);
      expect(grid!.className).toMatch(/md:grid-cols-2/);
    });
  });
});
