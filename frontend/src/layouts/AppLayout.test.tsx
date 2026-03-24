import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider } from "@/auth";
import AppLayout from "@/layouts/AppLayout";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return { ...actual, setToken: vi.fn(), getMe: vi.fn() };
});

import { setToken as setTokenMock } from "@/api";
import type { UserResponse } from "@/api";

function renderLayoutWithUser(user: UserResponse) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AppLayout user={user}>
                <div>Page Content</div>
              </AppLayout>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("AppLayout", () => {
  it("shows parent nav items for parent role", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/rewards/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/shop/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/profile/i)).not.toBeInTheDocument();
  });

  it("shows child nav items for child role", () => {
    renderLayoutWithUser({
      id: 2,
      email: "child@test.com",
      role: "child",
      language: "en",
    });
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/shop/i)).toBeInTheDocument();
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });

  it("shows admin nav items (parent nav + Rewards)", () => {
    renderLayoutWithUser({
      id: 3,
      email: "admin@test.com",
      role: "admin",
      language: "en",
    });
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/family/i)).toBeInTheDocument();
    expect(screen.getByText(/rewards/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(screen.getByText(/page content/i)).toBeInTheDocument();
  });

  it("shows logout button", () => {
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    expect(
      screen.getByRole("button", { name: /logout/i }),
    ).toBeInTheDocument();
  });

  it("logout clears token and navigates to login", async () => {
    const user = userEvent.setup();
    renderLayoutWithUser({
      id: 1,
      email: "parent@test.com",
      role: "parent",
      language: "en",
    });
    await user.click(screen.getByRole("button", { name: /logout/i }));
    expect(setTokenMock).toHaveBeenCalledWith(null);
  });
});
