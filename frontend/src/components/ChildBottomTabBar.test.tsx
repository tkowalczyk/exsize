import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ChildBottomTabBar from "@/components/ChildBottomTabBar";

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderBottomBar(initialPath = "/tasks", overrides: { dark?: boolean; toggleDark?: () => void; logout?: () => void } = {}) {
  const toggleDark = overrides.toggleDark ?? vi.fn();
  const logout = overrides.logout ?? vi.fn();
  return {
    toggleDark,
    logout,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <ChildBottomTabBar dark={overrides.dark ?? false} toggleDark={toggleDark} logout={logout} />
      </MemoryRouter>,
    ),
  };
}

function renderWithRoutes(initialPath = "/tasks", overrides: { dark?: boolean; toggleDark?: () => void; logout?: () => void } = {}) {
  const toggleDark = overrides.toggleDark ?? vi.fn();
  const logout = overrides.logout ?? vi.fn();
  return {
    toggleDark,
    logout,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<ChildBottomTabBar dark={overrides.dark ?? false} toggleDark={toggleDark} logout={logout} />} />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

function renderWithRoutesAndLocation(initialPath = "/tasks", overrides: { dark?: boolean; toggleDark?: () => void; logout?: () => void } = {}) {
  const toggleDark = overrides.toggleDark ?? vi.fn();
  const logout = overrides.logout ?? vi.fn();
  return {
    toggleDark,
    logout,
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<><ChildBottomTabBar dark={overrides.dark ?? false} toggleDark={toggleDark} logout={logout} /><LocationDisplay /></>} />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

describe("ChildBottomTabBar", () => {
  it("renders four tabs: Tasks, Shop, Leaderboard, Hamburger", () => {
    renderBottomBar();

    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Shop")).toBeInTheDocument();
    expect(screen.getByLabelText("Leaderboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
  });

  it("highlights the active tab based on current route", () => {
    renderWithRoutes("/shop");

    const shopTab = screen.getByLabelText("Shop");
    const tasksTab = screen.getByLabelText("Tasks");

    expect(shopTab.getAttribute("aria-current")).toBe("page");
    expect(tasksTab.getAttribute("aria-current")).toBeNull();
  });

  it("active tab has green hover highlight", () => {
    renderWithRoutes("/shop");

    const shopTab = screen.getByLabelText("Shop");
    expect(shopTab.className).toContain("hover:bg-[#6bcb77]/10");
  });

  it("navigates to correct page when tab is clicked", async () => {
    const user = userEvent.setup();
    renderWithRoutesAndLocation("/tasks");

    await user.click(screen.getByLabelText("Shop"));
    expect(screen.getByTestId("location")).toHaveTextContent("/shop");

    await user.click(screen.getByLabelText("Leaderboard"));
    expect(screen.getByTestId("location")).toHaveTextContent("/leaderboard");

    await user.click(screen.getByLabelText("Tasks"));
    expect(screen.getByTestId("location")).toHaveTextContent("/tasks");
  });

  it("has fixed positioning at bottom of viewport", () => {
    renderBottomBar();

    const nav = screen.getByLabelText("Tasks").closest("nav")!;
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
  });

  it("is hidden on desktop via md:hidden", () => {
    renderBottomBar();

    const nav = screen.getByLabelText("Tasks").closest("nav")!;
    expect(nav.className).toContain("md:hidden");
  });

  it("has 44px minimum touch targets on all tabs", () => {
    renderBottomBar();

    const tabs = screen.getAllByRole("link");
    for (const tab of tabs) {
      expect(tab.className).toContain("py-2");
    }
  });

  it("hamburger menu icon is tappable", () => {
    renderBottomBar();

    const menuBtn = screen.getByLabelText("Menu");
    expect(menuBtn.tagName).toBe("BUTTON");
    expect(menuBtn).toBeInTheDocument();
  });

  it("drawer is always in DOM, hidden off-screen when closed", () => {
    renderWithRoutes();

    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    expect(drawer.className).toContain("translate-x-full");
  });

  it("drawer slides in when hamburger is clicked", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    const drawer = screen.getByRole("dialog");
    expect(drawer.className).toContain("translate-x-full");

    await user.click(screen.getByLabelText("Menu"));

    expect(drawer.className).toContain("translate-x-0");
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText("ExBucks")).toBeInTheDocument();
    expect(screen.getByText("SizePass")).toBeInTheDocument();
  });

  it("drawer and backdrop have transition classes for smooth animation", () => {
    renderWithRoutes();

    const drawer = screen.getByRole("dialog");
    const backdrop = screen.getByTestId("drawer-backdrop");

    expect(drawer.className).toContain("transition-transform");
    expect(backdrop.className).toContain("transition-opacity");
  });

  it("closes drawer on backdrop click", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    const drawer = screen.getByRole("dialog");
    expect(drawer.className).toContain("translate-x-0");

    await user.click(screen.getByTestId("drawer-backdrop"));
    expect(drawer.className).toContain("translate-x-full");
  });

  it("closes drawer on Escape key", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    const drawer = screen.getByRole("dialog");
    expect(drawer.className).toContain("translate-x-0");

    await user.keyboard("{Escape}");
    expect(drawer.className).toContain("translate-x-full");
  });

  it("closes drawer when a drawer item is clicked", async () => {
    const user = userEvent.setup();
    renderWithRoutesAndLocation();

    await user.click(screen.getByLabelText("Menu"));

    await user.click(screen.getByLabelText("Profile"));
    const drawer = screen.getByRole("dialog");
    expect(drawer.className).toContain("translate-x-full");
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  });

  it("menu icon transitions to close icon when drawer opens", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    const menuBtn = screen.getByLabelText("Menu");
    expect(menuBtn).toHaveAttribute("data-state", "closed");

    await user.click(menuBtn);
    expect(menuBtn).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");
    expect(menuBtn).toHaveAttribute("data-state", "closed");
  });

  it("drawer has dark mode toggle", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    expect(screen.getByLabelText("Toggle dark mode")).toBeInTheDocument();
  });

  it("drawer dark mode toggle calls toggleDark", async () => {
    const user = userEvent.setup();
    const { toggleDark } = renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    await user.click(screen.getByLabelText("Toggle dark mode"));
    expect(toggleDark).toHaveBeenCalledTimes(1);
  });

  it("drawer has logout button", async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    expect(screen.getByLabelText("Logout")).toBeInTheDocument();
  });

  it("drawer logout button calls logout", async () => {
    const user = userEvent.setup();
    const { logout } = renderWithRoutes();

    await user.click(screen.getByLabelText("Menu"));
    await user.click(screen.getByLabelText("Logout"));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
