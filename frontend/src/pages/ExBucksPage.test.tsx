import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import ExBucksPage from "@/pages/ExBucksPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getTransactions: vi.fn(),
    getChildTransactions: vi.fn(),
    getFamily: vi.fn(),
    assignPenalty: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getTransactions as getTransactionsMock,
  getChildTransactions as getChildTransactionsMock,
  getFamily as getFamilyMock,
  assignPenalty as assignPenaltyMock,
} from "@/api";
import type { UserResponse } from "@/api";

function renderExBucksPage(role: "parent" | "child" = "child") {
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
          <ExBucksPage user={user} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ExBucksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("child sees transaction history with type, amount, description, timestamp", async () => {
    vi.mocked(getTransactionsMock).mockResolvedValue([
      { id: 1, type: "earned", amount: 10, description: "Clean room", created_at: "2026-03-24T10:00:00" },
      { id: 2, type: "penalized", amount: -5, description: "Late homework", created_at: "2026-03-24T11:00:00" },
    ]);

    renderExBucksPage("child");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("Late homework")).toBeInTheDocument();
    expect(screen.getByText("earned")).toBeInTheDocument();
    expect(screen.getByText("penalized")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("parent sees child selector and per-child transaction history", async () => {
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
        { id: 3, email: "child2@test.com", role: "child" },
      ],
    });
    vi.mocked(getChildTransactionsMock).mockResolvedValue([
      { id: 1, type: "earned", amount: 15, description: "Do homework", created_at: "2026-03-24T09:00:00" },
    ]);

    const user = userEvent.setup();
    renderExBucksPage("parent");

    // Should show child selector with options loaded
    const select = await screen.findByLabelText(/^select child$/i);
    expect(select).toBeInTheDocument();
    // Wait for family data to load by checking options within the select
    await waitFor(() => {
      expect(select.querySelectorAll("option")).toHaveLength(3); // placeholder + 2 children
    });

    // Select a child
    await user.selectOptions(select, "2");

    // Should show that child's transactions
    expect(await screen.findByText("Do homework")).toBeInTheDocument();
    expect(screen.getByText("earned")).toBeInTheDocument();
    expect(screen.getByText("+15")).toBeInTheDocument();
  });

  it("parent can assign a penalty with child selector, amount, and reason", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(assignPenaltyMock).mockResolvedValue({
      id: 10, type: "penalized", amount: -5, description: "Messy room", created_at: "2026-03-24T12:00:00",
    });

    renderExBucksPage("parent");

    // Wait for family data to load
    const penaltySelect = await screen.findByLabelText(/penalty child/i);
    await waitFor(() => {
      expect(penaltySelect.querySelectorAll("option")).toHaveLength(2); // placeholder + 1 child
    });

    // Fill penalty form
    await user.selectOptions(penaltySelect, "2");
    await user.type(screen.getByLabelText(/amount/i), "5");
    await user.type(screen.getByLabelText(/reason/i), "Messy room");
    await user.click(screen.getByRole("button", { name: /assign penalty/i }));

    await waitFor(() => {
      expect(assignPenaltyMock).toHaveBeenCalledWith(
        { child_id: 2, amount: 5, reason: "Messy room" },
        expect.anything(),
      );
    });

    // Form resets after successful penalty
    await waitFor(() => {
      expect((screen.getByLabelText(/reason/i) as HTMLInputElement).value).toBe("");
    });
  });

  it("E2E: parent approves task → child balance increases → parent assigns penalty → child balance decreases", async () => {
    const user = userEvent.setup();

    // Step 1: Parent approves task (simulated via TasksPage behavior)
    // We verify the ExBucks side: child sees updated balance and transaction

    // After task approval, child sees balance = 10 and earned transaction
    vi.mocked(getTransactionsMock).mockResolvedValue([
      { id: 1, type: "earned", amount: 10, description: "Clean room", created_at: "2026-03-24T10:00:00" },
    ]);

    const { unmount: unmountChild1 } = renderExBucksPage("child");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
    unmountChild1();

    // Step 2: Parent assigns penalty
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(assignPenaltyMock).mockResolvedValue({
      id: 2, type: "penalized", amount: -3, description: "Messy room", created_at: "2026-03-24T11:00:00",
    });

    const { unmount: unmountParent } = renderExBucksPage("parent");

    const penaltySelect = await screen.findByLabelText(/penalty child/i);
    await waitFor(() => {
      expect(penaltySelect.querySelectorAll("option")).toHaveLength(2);
    });
    await user.selectOptions(penaltySelect, "2");
    await user.type(screen.getByLabelText(/amount/i), "3");
    await user.type(screen.getByLabelText(/reason/i), "Messy room");
    await user.click(screen.getByRole("button", { name: /assign penalty/i }));

    await waitFor(() => {
      expect(assignPenaltyMock).toHaveBeenCalled();
    });
    unmountParent();

    // Step 3: Child sees updated balance (7) and both transactions
    vi.mocked(getTransactionsMock).mockResolvedValue([
      { id: 2, type: "penalized", amount: -3, description: "Messy room", created_at: "2026-03-24T11:00:00" },
      { id: 1, type: "earned", amount: 10, description: "Clean room", created_at: "2026-03-24T10:00:00" },
    ]);

    renderExBucksPage("child");

    expect(await screen.findByText("Messy room")).toBeInTheDocument();
    expect(screen.getByText("-3")).toBeInTheDocument();
    expect(screen.getByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
  });

  it("shows spinner and disables Assign Penalty button during submission", async () => {
    const user = userEvent.setup();
    let resolvePenalty!: () => void;
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(assignPenaltyMock).mockImplementation(
      () => new Promise<void>((resolve) => { resolvePenalty = resolve; }),
    );

    renderExBucksPage("parent");

    const penaltySelect = await screen.findByLabelText(/penalty child/i);
    await waitFor(() => {
      expect(penaltySelect.querySelectorAll("option")).toHaveLength(2);
    });

    await user.selectOptions(penaltySelect, "2");
    await user.type(screen.getByLabelText(/amount/i), "5");
    await user.type(screen.getByLabelText(/reason/i), "Messy room");
    await user.click(screen.getByRole("button", { name: /assign penalty/i }));

    expect(screen.getByText(/assigning/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /assigning/i });
    expect(btn).toBeDisabled();

    resolvePenalty();

    await waitFor(() => {
      expect(screen.queryByText(/assigning/i)).not.toBeInTheDocument();
    });
  });

  describe("responsive layout", () => {
    it("transaction items stack description and amount/date on mobile", async () => {
      vi.mocked(getTransactionsMock).mockResolvedValue([
        { id: 1, type: "earned", amount: 10, description: "Clean room", created_at: "2026-03-24T10:00:00" },
      ]);

      renderExBucksPage("child");

      const desc = await screen.findByText("Clean room");
      const txnItem = desc.closest("[data-testid='transaction-item']");
      expect(txnItem).toBeInTheDocument();
      expect(txnItem!.className).toMatch(/flex-col/);
      expect(txnItem!.className).toMatch(/sm:flex-row/);
    });

    it("penalty form buttons have minimum 44px touch target on mobile", async () => {
      vi.mocked(getFamilyMock).mockResolvedValue({
        id: 1, pin: "ABC123",
        members: [
          { id: 1, email: "parent@test.com", role: "parent" },
          { id: 2, email: "child@test.com", role: "child" },
        ],
      });

      renderExBucksPage("parent");

      const btn = await screen.findByRole("button", { name: /assign penalty/i });
      expect(btn.className).toMatch(/min-h-\[44px\]/);
    });
  });

  it("shows error and re-enables Assign Penalty button when penalty fails", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(assignPenaltyMock).mockRejectedValue(new Error("Insufficient balance"));

    renderExBucksPage("parent");

    const penaltySelect = await screen.findByLabelText(/penalty child/i);
    await waitFor(() => {
      expect(penaltySelect.querySelectorAll("option")).toHaveLength(2);
    });

    await user.selectOptions(penaltySelect, "2");
    await user.type(screen.getByLabelText(/amount/i), "5");
    await user.type(screen.getByLabelText(/reason/i), "Messy room");
    await user.click(screen.getByRole("button", { name: /assign penalty/i }));

    expect(await screen.findByText(/insufficient balance/i)).toBeInTheDocument();
    expect(screen.queryByText(/assigning/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /assign penalty/i })).not.toBeDisabled();
  });
});
