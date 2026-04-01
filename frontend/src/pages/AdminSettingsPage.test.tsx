import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import AdminSettingsPage from "@/pages/AdminSettingsPage";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getAppSettings: vi.fn(),
    updateAppSettings: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getAppSettings as getAppSettingsMock,
  updateAppSettings as updateAppSettingsMock,
} from "@/api";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <AdminSettingsPage user={{ id: 1, email: "admin@test.com", role: "admin", language: "en" }} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows current max ExBucks per task limit", async () => {
    vi.mocked(getAppSettingsMock).mockResolvedValue({ max_exbucks_per_task: 50 });

    renderPage();

    expect(await screen.findByText("App Settings")).toBeInTheDocument();
    expect(screen.getByDisplayValue("50")).toBeInTheDocument();
  });

  it("admin updates the limit", async () => {
    const user = userEvent.setup();
    vi.mocked(getAppSettingsMock).mockResolvedValue({ max_exbucks_per_task: 50 });
    vi.mocked(updateAppSettingsMock).mockResolvedValue({ max_exbucks_per_task: 100 });

    renderPage();

    const input = await screen.findByDisplayValue("50");
    await user.clear(input);
    await user.type(input, "100");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updateAppSettingsMock).toHaveBeenCalledWith(
        { max_exbucks_per_task: 100 },
        expect.anything(),
      );
    });
  });
});
