import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ParentTopBar from "@/components/ParentTopBar";

function renderTopBar(overrides: { dark?: boolean; toggleDark?: () => void; logout?: () => void } = {}) {
  const toggleDark = overrides.toggleDark ?? vi.fn();
  const logout = overrides.logout ?? vi.fn();
  return {
    toggleDark,
    logout,
    ...render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ParentTopBar dark={overrides.dark ?? false} toggleDark={toggleDark} logout={logout} />
      </MemoryRouter>,
    ),
  };
}

describe("ParentTopBar", () => {
  it("renders Settings icon, Family link, and SizePass button", () => {
    renderTopBar();

    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Family")).toBeInTheDocument();
    expect(screen.getByLabelText("SizePass")).toBeInTheDocument();
  });

  it("Settings links to /settings", () => {
    renderTopBar();

    const settingsLink = screen.getByLabelText("Settings");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("Family links to /family", () => {
    renderTopBar();

    const familyLink = screen.getByLabelText("Family");
    expect(familyLink).toHaveAttribute("href", "/family");
  });

  it("renders dark mode toggle button", () => {
    renderTopBar();
    expect(screen.getByLabelText("Toggle dark mode")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    renderTopBar();
    expect(screen.getByLabelText("Logout")).toBeInTheDocument();
  });

  it("calls toggleDark when dark mode button is clicked", async () => {
    const user = userEvent.setup();
    const { toggleDark } = renderTopBar();

    await user.click(screen.getByLabelText("Toggle dark mode"));
    expect(toggleDark).toHaveBeenCalledTimes(1);
  });

  it("calls logout when logout button is clicked", async () => {
    const user = userEvent.setup();
    const { logout } = renderTopBar();

    await user.click(screen.getByLabelText("Logout"));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
