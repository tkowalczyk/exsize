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
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getFamily as getFamilyMock,
  createFamily as createFamilyMock,
  joinFamily as joinFamilyMock,
  removeFamilyMember as removeFamilyMemberMock,
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

  it("shows upgrade prompt when free tier limit is reached", async () => {
    const user = userEvent.setup();
    vi.mocked(getFamilyMock).mockRejectedValue(new ApiError(404, "Not in a family"));
    vi.mocked(joinFamilyMock).mockRejectedValue(
      new ApiError(403, "Free tier limit reached: max 1 child(s). Upgrade to SizePass to add more."),
    );

    renderFamilyPage("child");

    const pinInput = await screen.findByLabelText(/pin/i);
    await user.type(pinInput, "ABC123");
    await user.click(screen.getByRole("button", { name: /join family/i }));

    expect(await screen.findByText(/upgrade to sizepass/i)).toBeInTheDocument();
  });
});
