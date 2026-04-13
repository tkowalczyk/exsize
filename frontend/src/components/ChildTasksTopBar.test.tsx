import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ChildTasksTopBar from "@/components/ChildTasksTopBar";

function renderTopBar(overrides: Partial<Parameters<typeof ChildTasksTopBar>[0]> = {}) {
  const props = {
    badges: [],
    streak: 0,
    level: 1,
    exbucksBalance: 0,
    ...overrides,
  };
  return render(
    <MemoryRouter initialEntries={["/tasks"]}>
      <ChildTasksTopBar {...props} />
    </MemoryRouter>,
  );
}

describe("ChildTasksTopBar", () => {
  it("wyświetla liczbę badge'y", () => {
    renderTopBar({ badges: ["first_task", "streak_3"] });

    expect(screen.getByLabelText("Badges")).toHaveTextContent("2");
  });

  it("wyświetla streak", () => {
    renderTopBar({ streak: 7 });

    expect(screen.getByLabelText("Streak")).toHaveTextContent("7");
  });

  it("wyświetla level", () => {
    renderTopBar({ level: 5 });

    expect(screen.getByLabelText("Level")).toHaveTextContent("5");
  });

  it("wyświetla ExBucks balance", () => {
    renderTopBar({ exbucksBalance: 42 });

    expect(screen.getByLabelText("ExBucks balance")).toHaveTextContent("42");
  });
});
