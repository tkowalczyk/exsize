import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import ShopPage from "@/pages/ShopPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getBalance: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import type { UserResponse } from "@/api";

function renderShopPage(role: "child" | "parent" = "child") {
  const user: UserResponse = {
    id: role === "child" ? 2 : 1,
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
          <ShopPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ShopPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("child sees Shop heading and avatar section", async () => {
    renderShopPage("child");
    expect(await screen.findByRole("heading", { name: "Shop" })).toBeInTheDocument();
    expect(screen.getByText("Avatars")).toBeInTheDocument();
  });
});
