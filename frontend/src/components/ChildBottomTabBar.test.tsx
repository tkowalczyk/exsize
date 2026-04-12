import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ChildBottomTabBar from "@/components/ChildBottomTabBar";

function LocationDisplay() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderBottomBar(initialPath = "/tasks") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ChildBottomTabBar />
    </MemoryRouter>,
  );
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
    render(
      <MemoryRouter initialEntries={["/shop"]}>
        <Routes>
          <Route path="*" element={<ChildBottomTabBar />} />
        </Routes>
      </MemoryRouter>,
    );

    const shopTab = screen.getByLabelText("Shop");
    const tasksTab = screen.getByLabelText("Tasks");

    expect(shopTab.getAttribute("aria-current")).toBe("page");
    expect(tasksTab.getAttribute("aria-current")).toBeNull();
  });

  it("navigates to correct page when tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <Routes>
          <Route path="*" element={<><ChildBottomTabBar /><LocationDisplay /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Shop"));
    expect(screen.getByTestId("location")).toHaveTextContent("/shop");

    await user.click(screen.getByLabelText("Leaderboard"));
    expect(screen.getByTestId("location")).toHaveTextContent("/leaderboard");

    await user.click(screen.getByLabelText("Tasks"));
    expect(screen.getByTestId("location")).toHaveTextContent("/tasks");
  });

  it("has fixed positioning at bottom of viewport", () => {
    renderBottomBar();

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");
  });

  it("is hidden on desktop via md:hidden", () => {
    renderBottomBar();

    const nav = screen.getByRole("navigation");
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

  it("opens drawer when hamburger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <Routes>
          <Route path="*" element={<ChildBottomTabBar />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Profile")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Menu"));

    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText("ExBucks")).toBeInTheDocument();
    expect(screen.getByText("SizePass")).toBeInTheDocument();
  });

  it("closes drawer on backdrop click", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <Routes>
          <Route path="*" element={<ChildBottomTabBar />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Menu"));
    expect(screen.getByText("Settings")).toBeInTheDocument();

    await user.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("closes drawer on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <Routes>
          <Route path="*" element={<ChildBottomTabBar />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Menu"));
    expect(screen.getByText("Settings")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  it("closes drawer when a drawer item is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tasks"]}>
        <Routes>
          <Route path="*" element={<><ChildBottomTabBar /><LocationDisplay /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("Menu"));
    expect(screen.getByText("Settings")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Profile"));
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  });
});
