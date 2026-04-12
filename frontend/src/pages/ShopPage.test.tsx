import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    getAvatarShop: vi.fn(),
    getAvatarInventory: vi.fn(),
    getEquippedAvatar: vi.fn(),
    purchaseAvatarItem: vi.fn(),
    equipAvatarItem: vi.fn(),
    unequipAvatarItem: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getBalance as getBalanceMock,
  getAvatarShop as getAvatarShopMock,
  getAvatarInventory as getAvatarInventoryMock,
  getEquippedAvatar as getEquippedAvatarMock,
  purchaseAvatarItem as purchaseAvatarItemMock,
  equipAvatarItem as equipAvatarItemMock,
  unequipAvatarItem as unequipAvatarItemMock,
} from "@/api";
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

  it("shows spinner and disables Buy button during purchase", async () => {
    const user = userEvent.setup();
    let resolvePurchase!: () => void;
    vi.mocked(getAvatarShopMock).mockResolvedValue([
      { id: 1, type: "icon", label: "Hat", price: 10, value: "🎩" },
    ]);
    vi.mocked(getAvatarInventoryMock).mockResolvedValue([]);
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 50 });
    vi.mocked(getEquippedAvatarMock).mockResolvedValue(null);
    vi.mocked(purchaseAvatarItemMock).mockImplementation(
      () => new Promise<void>((resolve) => { resolvePurchase = resolve; }),
    );

    renderShopPage("child");

    await user.click(await screen.findByRole("button", { name: /buy/i }));

    expect(screen.getByText(/buying/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /buying/i });
    expect(btn).toBeDisabled();

    resolvePurchase();

    await waitFor(() => {
      expect(screen.queryByText(/buying/i)).not.toBeInTheDocument();
    });
  });

  it("shows error when purchase fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getAvatarShopMock).mockResolvedValue([
      { id: 1, type: "icon", label: "Hat", price: 10, value: "🎩" },
    ]);
    vi.mocked(getAvatarInventoryMock).mockResolvedValue([]);
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 50 });
    vi.mocked(getEquippedAvatarMock).mockResolvedValue(null);
    vi.mocked(purchaseAvatarItemMock).mockRejectedValue(new Error("Insufficient funds"));

    renderShopPage("child");

    await user.click(await screen.findByRole("button", { name: /buy/i }));

    expect(await screen.findByText(/insufficient funds/i)).toBeInTheDocument();
    expect(screen.queryByText(/buying/i)).not.toBeInTheDocument();
    // Button should be re-enabled
    expect(screen.getByRole("button", { name: /buy/i })).not.toBeDisabled();
  });

  it("shows spinner and disables Equip button during equip", async () => {
    const user = userEvent.setup();
    let resolveEquip!: () => void;
    vi.mocked(getAvatarShopMock).mockResolvedValue([]);
    vi.mocked(getAvatarInventoryMock).mockResolvedValue([
      { id: 1, type: "icon", label: "Hat", price: 10, value: "🎩" },
    ]);
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 50 });
    vi.mocked(getEquippedAvatarMock).mockResolvedValue(null);
    vi.mocked(equipAvatarItemMock).mockImplementation(
      () => new Promise<void>((resolve) => { resolveEquip = resolve; }),
    );

    renderShopPage("child");

    // Switch to inventory tab
    await user.click(await screen.findByRole("button", { name: /my items/i }));

    await user.click(await screen.findByRole("button", { name: /equip/i }));

    expect(screen.getByText(/equipping/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /equipping/i })).toBeDisabled();

    resolveEquip();

    await waitFor(() => {
      expect(screen.queryByText(/equipping/i)).not.toBeInTheDocument();
    });
  });

  it("shows spinner and disables Unequip button during unequip", async () => {
    const user = userEvent.setup();
    let resolveUnequip!: () => void;
    vi.mocked(getAvatarShopMock).mockResolvedValue([]);
    vi.mocked(getAvatarInventoryMock).mockResolvedValue([
      { id: 1, type: "icon", label: "Hat", price: 10, value: "🎩" },
    ]);
    vi.mocked(getBalanceMock).mockResolvedValue({ balance: 50 });
    vi.mocked(getEquippedAvatarMock).mockResolvedValue({
      icon: { id: 1, type: "icon", label: "Hat", price: 10, value: "🎩" },
      background: null,
    });
    vi.mocked(unequipAvatarItemMock).mockImplementation(
      () => new Promise<void>((resolve) => { resolveUnequip = resolve; }),
    );

    renderShopPage("child");

    // Switch to inventory tab
    await user.click(await screen.findByRole("button", { name: /my items/i }));

    await user.click(await screen.findByRole("button", { name: /unequip/i }));

    expect(screen.getByText(/unequipping/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unequipping/i })).toBeDisabled();

    resolveUnequip();

    await waitFor(() => {
      expect(screen.queryByText(/unequipping/i)).not.toBeInTheDocument();
    });
  });
});
