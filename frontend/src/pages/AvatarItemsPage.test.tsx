import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import AvatarItemsPage from "@/pages/AvatarItemsPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getAvatarItems: vi.fn(),
    createAvatarItem: vi.fn(),
    updateAvatarItem: vi.fn(),
    deleteAvatarItem: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import { getAvatarItems as getAvatarItemsMock } from "@/api";
import type { UserResponse } from "@/api";

function renderAvatarItemsPage() {
  const user: UserResponse = {
    id: 1,
    email: "admin@test.com",
    role: "admin",
    language: "en",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <AvatarItemsPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AvatarItemsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("responsive layout", () => {
    it("page header stacks vertically on mobile", async () => {
      vi.mocked(getAvatarItemsMock).mockResolvedValue([]);

      renderAvatarItemsPage();

      const header = await screen.findByTestId("avatar-items-header");
      expect(header.className).toMatch(/flex-col/);
      expect(header.className).toMatch(/sm:flex-row/);
    });

    it("item rows stack vertically on mobile", async () => {
      vi.mocked(getAvatarItemsMock).mockResolvedValue([
        { id: 1, type: "icon", label: "Cat", price: 10, value: "🐱", is_default: false, active_in_shop: true },
      ]);

      renderAvatarItemsPage();

      const row = await screen.findByTestId("avatar-item-row");
      expect(row.className).toMatch(/flex-col/);
      expect(row.className).toMatch(/sm:flex-row/);
    });

    it("action buttons have minimum 44px touch target on mobile", async () => {
      vi.mocked(getAvatarItemsMock).mockResolvedValue([
        { id: 1, type: "icon", label: "Cat", price: 10, value: "🐱", is_default: false, active_in_shop: true },
      ]);

      renderAvatarItemsPage();

      const editBtn = await screen.findByRole("button", { name: /edit/i });
      const removeBtn = screen.getByRole("button", { name: /remove/i });
      expect(editBtn.className).toMatch(/min-h-\[44px\]/);
      expect(removeBtn.className).toMatch(/min-h-\[44px\]/);
    });
  });
});
