import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import FamilyPage from "@/pages/FamilyPage";
import { ApiError } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getFamily: vi.fn(),
    createFamily: vi.fn(),
    joinFamily: vi.fn(),
    removeFamilyMember: vi.fn(),
    deleteChildAccount: vi.fn(),
    getDeletionRequests: vi.fn(),
    approveDeletionRequest: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getFamily as getFamilyMock,
  createFamily as createFamilyMock,
  joinFamily as joinFamilyMock,
  removeFamilyMember as removeFamilyMemberMock,
  deleteChildAccount as deleteChildAccountMock,
  getDeletionRequests as getDeletionRequestsMock,
  approveDeletionRequest as approveDeletionRequestMock,
} from "@/api";

function renderFamilyPage(role: "parent" | "child" | "admin" = "parent") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <FamilyPage
            user={{ id: 1, email: "test@test.com", role, language: "en" }}
          />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("FamilyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows create family prompt when parent has no family", async () => {
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));

    renderFamilyPage("parent");

    expect(await screen.findByRole("button", { name: /create family/i })).toBeInTheDocument();
  });

  it("displays PIN after parent creates a family", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(createFamilyMock).mockResolvedValue({ id: 1, pin: "ABC123" });

    renderFamilyPage("parent");

    const createBtn = await screen.findByRole("button", { name: /create family/i });
    await user.click(createBtn);

    expect(await screen.findByText("ABC123")).toBeInTheDocument();
  });

  it("lists family members with their roles", async () => {
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderFamilyPage("parent");

    expect(await screen.findByText("parent@test.com")).toBeInTheDocument();
    expect(screen.getByText("child@test.com")).toBeInTheDocument();
    expect(screen.getByText("parent")).toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("copies PIN to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [{ id: 1, email: "parent@test.com", role: "parent" }],
    });

    renderFamilyPage("parent");

    const copyBtn = await screen.findByRole("button", { name: /copy/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("XYZ789");
  });

  it("shows 'Copied!' feedback after copying PIN", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [{ id: 1, email: "parent@test.com", role: "parent" }],
    });

    renderFamilyPage("parent");

    const copyBtn = await screen.findByRole("button", { name: /copy/i });
    await user.click(copyBtn);

    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("shows join family form when child has no family", async () => {
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));

    renderFamilyPage("child");

    expect(await screen.findByLabelText(/pin/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join family/i })).toBeInTheDocument();
  });

  it("joins family successfully when child enters valid PIN", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockResolvedValue({ family_id: 1 });

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "ABC123");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    expect(joinFamilyMock).toHaveBeenCalledWith("ABC123", expect.anything());
  });

  it("shows error when child enters invalid PIN", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockRejectedValue(new ApiError(404, "Invalid PIN"));

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "WRONG1");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    expect(await screen.findByText(/invalid pin/i)).toBeInTheDocument();
  });

  it("removes child from family when parent clicks remove", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(removeFamilyMemberMock).mockResolvedValue({ detail: "Member removed" });

    renderFamilyPage("parent");

    const removeBtn = await screen.findByRole("button", { name: /remove/i });
    await user.click(removeBtn);

    expect(removeFamilyMemberMock).toHaveBeenCalledWith(2, expect.anything());
  });

  it("full flow: parent creates family, child joins with PIN, parent sees child in members", async () => {
    const user = userEvent.setup();

    // Step 1: Parent has no family → creates one → sees PIN
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(createFamilyMock).mockResolvedValue({ id: 1, pin: "FAM999" });

    const { unmount } = renderFamilyPage("parent");

    await user.click(await screen.findByRole("button", { name: /create family/i }));
    expect(await screen.findByText("FAM999")).toBeInTheDocument();
    unmount();

    // Step 2: Child joins with the PIN
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockResolvedValue({ family_id: 1 });

    const { unmount: unmountChild } = renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "FAM999");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    expect(joinFamilyMock).toHaveBeenCalledWith("FAM999", expect.anything());
    unmountChild();

    // Step 3: Parent views family → sees child in members
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "FAM999",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderFamilyPage("parent");

    expect(await screen.findByText("parent@test.com")).toBeInTheDocument();
    expect(screen.getByText("child@test.com")).toBeInTheDocument();
    expect(screen.getByText("FAM999")).toBeInTheDocument();
  });

  it("parent sees delete account button next to child members", async () => {
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([]);

    renderFamilyPage("parent");

    expect(await screen.findByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });

  it("parent clicks delete account → sees confirmation → confirms → child deleted", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([]);
    vi.mocked(deleteChildAccountMock).mockResolvedValue({ detail: "Deleted" });

    renderFamilyPage("parent");

    await user.click(await screen.findByRole("button", { name: /delete account/i }));

    expect(await screen.findByText(/permanently delete this child/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(deleteChildAccountMock).toHaveBeenCalledWith(2, expect.anything());
  });

  it("parent sees pending deletion requests section", async () => {
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([
      { id: 10, child_id: 2, status: "pending" },
    ]);

    renderFamilyPage("parent");

    expect(await screen.findByText(/deletion requests/i)).toBeInTheDocument();
    expect(screen.getByText(/requested account deletion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });

  it("parent approves deletion request → calls API", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([
      { id: 10, child_id: 2, status: "pending" },
    ]);
    vi.mocked(approveDeletionRequestMock).mockResolvedValue({ detail: "Approved" });

    renderFamilyPage("parent");

    await user.click(await screen.findByRole("button", { name: /approve/i }));

    expect(await screen.findByText(/permanently delete/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(approveDeletionRequestMock).toHaveBeenCalledWith(10, expect.anything());
  });

  it("no deletion requests section when list is empty", async () => {
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([]);

    renderFamilyPage("parent");

    await screen.findByText("parent@test.com");
    expect(screen.queryByText(/deletion requests/i)).not.toBeInTheDocument();
  });

  it("E2E: child requests deletion → parent sees and approves → child account removed", async () => {
    const user = userEvent.setup();

    // Step 1: Child requests deletion from settings (tested in SettingsPage tests)
    // We start from the parent's perspective on the family page

    // Step 2: Parent sees the deletion request on family page
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([
      { id: 10, child_id: 2, status: "pending" },
    ]);
    vi.mocked(approveDeletionRequestMock).mockResolvedValue({ detail: "Approved" });

    const { unmount } = renderFamilyPage("parent");

    expect(await screen.findByText(/deletion requests/i)).toBeInTheDocument();
    expect(screen.getByText(/requested account deletion/i)).toBeInTheDocument();

    // Step 3: Parent approves the deletion request
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(await screen.findByText(/permanently delete/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(approveDeletionRequestMock).toHaveBeenCalledWith(10, expect.anything());
    unmount();

    // Step 4: After approval, parent sees updated member list (child removed)
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1,
      pin: "XYZ789",
      members: [{ id: 1, email: "parent@test.com", role: "parent" }],
    });
    vi.mocked(getDeletionRequestsMock).mockResolvedValue([]);

    renderFamilyPage("parent");

    await screen.findByText("parent@test.com");
    expect(screen.queryByText("child@test.com")).not.toBeInTheDocument();
    expect(screen.queryByText(/deletion requests/i)).not.toBeInTheDocument();
  });

  it("shows spinner and disables Join Family button while processing", async () => {
    const user = userEvent.setup();
    let resolveJoin!: () => void;
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockImplementation(() => new Promise<void>((resolve) => { resolveJoin = resolve; }));

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "ABC123");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    // Button should show spinner text and be disabled
    expect(screen.getByText(/joining/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /joining/i });
    expect(btn).toBeDisabled();

    // Resolve the API call
    resolveJoin();

    // Loading should clear
    await waitFor(() => {
      expect(screen.queryByText(/joining/i)).not.toBeInTheDocument();
    });
  });

  it("clears loading and shows error when Join Family fails with non-403 error", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockRejectedValue(new ApiError(404, "Invalid PIN"));

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "WRONG1");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    // Error should be visible and loading cleared
    expect(await screen.findByText(/invalid pin/i)).toBeInTheDocument();
    expect(screen.queryByText(/joining/i)).not.toBeInTheDocument();
    // Button should be clickable again
    expect(screen.getByRole("button", { name: /join family/i })).not.toBeDisabled();
  });

  it("shows styled upgrade prompt when free tier limit is reached", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockRejectedValue(
      new ApiError(403, "Free tier limit reached: max 1 child(s). Upgrade to SizePass to add more."),
    );

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "ABC123");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    expect(await screen.findByText(/family is full/i)).toBeInTheDocument();
    expect(screen.getByText(/upgrade to sizepass/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upgrade/i })).toBeInTheDocument();
  });
});
