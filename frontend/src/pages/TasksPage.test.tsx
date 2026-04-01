import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider } from "@/auth";
import TasksPage from "@/pages/TasksPage";
import { ApiError } from "@/api";

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    getTasks: vi.fn(),
    createTask: vi.fn(),
    acceptTask: vi.fn(),
    approveTask: vi.fn(),
    rejectTask: vi.fn(),
    completeTask: vi.fn(),
    editTask: vi.fn(),
    deleteTask: vi.fn(),
    getFamily: vi.fn(),
    getSubscription: vi.fn(),
    getPublicSettings: vi.fn(),
    getMe: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  getTasks as getTasksMock,
  createTask as createTaskMock,
  acceptTask as acceptTaskMock,
  approveTask as approveTaskMock,
  rejectTask as rejectTaskMock,
  completeTask as completeTaskMock,
  editTask as editTaskMock,
  deleteTask as deleteTaskMock,
  getFamily as getFamilyMock,
  getSubscription as getSubscriptionMock,
  getPublicSettings as getPublicSettingsMock,
} from "@/api";

function renderTasksPage(role: "parent" | "child" | "admin" = "parent") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <TasksPage
            user={{ id: 1, email: "test@test.com", role, language: "en" }}
          />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("TasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows task list with status indicators for parent", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Clean room", description: "Tidy up", exbucks: 10, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 2, name: "Do homework", description: "Math", exbucks: 20, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderTasksPage("parent");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("Do homework")).toBeInTheDocument();
    expect(screen.getByText("assigned")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("shows create task form with fields for parent", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderTasksPage("parent");

    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/exbucks/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assign to/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create task/i })).toBeInTheDocument();
  });

  it("creates a task when parent submits the form", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(createTaskMock).mockResolvedValue({
      id: 1, name: "Clean room", description: "Tidy up", exbucks: 10,
      status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    renderTasksPage("parent");

    await user.type(await screen.findByLabelText(/name/i), "Clean room");
    await user.type(screen.getByLabelText(/description/i), "Tidy up");
    await user.type(screen.getByLabelText(/exbucks/i), "10");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "2");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        { name: "Clean room", description: "Tidy up", exbucks: 10, assigned_to: 2, day_of_week: null },
        expect.anything(),
      );
    });
  });

  it("shows approve/reject buttons only on completed tasks for parent", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Assigned task", description: "", exbucks: 5, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 2, name: "Completed task", description: "", exbucks: 10, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 3, name: "Approved task", description: "", exbucks: 15, status: "approved", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderTasksPage("parent");

    await screen.findByText("Completed task");

    const approveButtons = screen.getAllByRole("button", { name: /approve/i });
    const rejectButtons = screen.getAllByRole("button", { name: /reject/i });
    expect(approveButtons).toHaveLength(1);
    expect(rejectButtons).toHaveLength(1);
  });

  it("calls approveTask when parent clicks approve", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 2, name: "Completed task", description: "", exbucks: 10, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(approveTaskMock).mockResolvedValue({
      id: 2, name: "Completed task", description: "", exbucks: 10, status: "approved", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    renderTasksPage("parent");

    await user.click(await screen.findByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(approveTaskMock).toHaveBeenCalledWith(2, expect.anything());
    });
  });

  it("calls rejectTask when parent clicks reject on completed task", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 2, name: "Completed task", description: "", exbucks: 10, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(rejectTaskMock).mockResolvedValue({
      id: 2, name: "Completed task", description: "", exbucks: 10, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    renderTasksPage("parent");

    await user.click(await screen.findByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(rejectTaskMock).toHaveBeenCalledWith(2, expect.anything());
    });
  });

  it("shows assigned tasks for child with status indicators", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Clean room", description: "Tidy up", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
      { id: 2, name: "Do homework", description: "Math", exbucks: 20, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);

    renderTasksPage("child");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("Do homework")).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("assigned")).toBeInTheDocument();
  });

  it("does not show create task form for child", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([]);

    renderTasksPage("child");

    await screen.findByText("Tasks");
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create task/i })).not.toBeInTheDocument();
  });

  it("shows complete button only on accepted tasks for child", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Accepted task", description: "", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
      { id: 2, name: "Assigned task", description: "", exbucks: 5, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
      { id: 3, name: "Approved task", description: "", exbucks: 15, status: "approved", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);

    renderTasksPage("child");

    await screen.findByText("Accepted task");

    const completeButtons = screen.getAllByRole("button", { name: /complete/i });
    expect(completeButtons).toHaveLength(1);
  });

  it("calls completeTask when child clicks complete", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Accepted task", description: "", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(completeTaskMock).mockResolvedValue({
      id: 1, name: "Accepted task", description: "", exbucks: 10, status: "completed", assigned_to: 1, day_of_week: null, photo_url: null,
    });

    renderTasksPage("child");

    await user.click(await screen.findByRole("button", { name: /complete/i }));

    await waitFor(() => {
      expect(completeTaskMock).toHaveBeenCalledWith(1, undefined);
    });
  });

  it("renders visually distinct status badges for each status", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "T1", description: "", exbucks: 5, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 2, name: "T2", description: "", exbucks: 5, status: "accepted", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 3, name: "T3", description: "", exbucks: 5, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 4, name: "T4", description: "", exbucks: 5, status: "approved", assigned_to: 2, day_of_week: null, photo_url: null },
      { id: 5, name: "T5", description: "", exbucks: 5, status: "rejected", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderTasksPage("parent");

    await screen.findByText("T1");

    const badges = screen.getAllByTestId("status-badge");
    expect(badges).toHaveLength(5);

    const classNames = badges.map((b) => b.className);
    const uniqueClasses = new Set(classNames);
    expect(uniqueClasses.size).toBe(5);
  });

  it("full flow: parent creates task → child sees → child completes → parent approves → done", async () => {
    const user = userEvent.setup();

    // Step 1: Parent creates a task
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(createTaskMock).mockResolvedValue({
      id: 1, name: "Clean room", description: "Tidy up", exbucks: 10,
      status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    const { unmount: unmountParent1 } = renderTasksPage("parent");

    await user.type(await screen.findByLabelText(/name/i), "Clean room");
    await user.type(screen.getByLabelText(/description/i), "Tidy up");
    await user.type(screen.getByLabelText(/exbucks/i), "10");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "2");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalled();
    });
    unmountParent1();

    // Step 2: Child sees the task (accepted state — after accepting)
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Clean room", description: "Tidy up", exbucks: 10, status: "accepted", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(completeTaskMock).mockResolvedValue({
      id: 1, name: "Clean room", description: "Tidy up", exbucks: 10,
      status: "completed", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    const { unmount: unmountChild } = renderTasksPage("child");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() => {
      expect(completeTaskMock).toHaveBeenCalledWith(1, undefined);
    });
    unmountChild();

    // Step 3: Parent approves the completed task
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Clean room", description: "Tidy up", exbucks: 10, status: "completed", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(approveTaskMock).mockResolvedValue({
      id: 1, name: "Clean room", description: "Tidy up", exbucks: 10,
      status: "approved", assigned_to: 2, day_of_week: null, photo_url: null,
    });

    // After approve, tasks refetch showing approved
    const { unmount: unmountParent2 } = renderTasksPage("parent");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(approveTaskMock).toHaveBeenCalledWith(1, expect.anything());
    });
    unmountParent2();

    // Step 4: Verify task shows as done
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Clean room", description: "Tidy up", exbucks: 10, status: "approved", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);

    renderTasksPage("parent");

    expect(await screen.findByText("Clean room")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    // No approve/reject buttons on approved tasks
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("shows accept button on assigned tasks for child", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "New task", description: "", exbucks: 5, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
      { id: 2, name: "Accepted task", description: "", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);

    renderTasksPage("child");

    await screen.findByText("New task");

    const acceptButtons = screen.getAllByRole("button", { name: /accept/i });
    expect(acceptButtons).toHaveLength(1);
  });

  it("calls acceptTask when child clicks accept", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "New task", description: "", exbucks: 5, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(acceptTaskMock).mockResolvedValue({
      id: 1, name: "New task", description: "", exbucks: 5, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null,
    });

    renderTasksPage("child");

    await user.click(await screen.findByRole("button", { name: /accept/i }));

    await waitFor(() => {
      expect(acceptTaskMock).toHaveBeenCalledWith(1, expect.anything());
    });
  });

  it("shows day-of-week selector in create form and sends value on create", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(createTaskMock).mockResolvedValue({
      id: 1, name: "Monday chore", description: "Do it", exbucks: 5,
      status: "assigned", assigned_to: 2, day_of_week: "Monday", photo_url: null,
    });

    renderTasksPage("parent");

    const daySelect = await screen.findByLabelText(/day of week/i);
    expect(daySelect).toBeInTheDocument();

    await user.type(screen.getByLabelText(/name/i), "Monday chore");
    await user.type(screen.getByLabelText(/description/i), "Do it");
    await user.type(screen.getByLabelText(/exbucks/i), "5");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "2");
    await user.selectOptions(daySelect, "Monday");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        { name: "Monday chore", description: "Do it", exbucks: 5, assigned_to: 2, day_of_week: "Monday" },
        expect.anything(),
      );
    });
  });

  it("parent can edit a task via edit form", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Old name", description: "Old desc", exbucks: 5, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(editTaskMock).mockResolvedValue({
      id: 1, name: "New name", description: "New desc", exbucks: 10, status: "assigned", assigned_to: 2, day_of_week: "Tuesday", photo_url: null,
    });

    renderTasksPage("parent");

    await screen.findByText("Old name");
    await user.click(screen.getByRole("button", { name: /edit/i }));

    // Edit form should be pre-filled
    const nameInput = screen.getByLabelText(/edit name/i);
    expect(nameInput).toHaveValue("Old name");

    await user.clear(nameInput);
    await user.type(nameInput, "New name");
    await user.clear(screen.getByLabelText(/edit description/i));
    await user.type(screen.getByLabelText(/edit description/i), "New desc");
    await user.clear(screen.getByLabelText(/edit exbucks/i));
    await user.type(screen.getByLabelText(/edit exbucks/i), "10");
    await user.selectOptions(screen.getByLabelText(/edit day/i), "Tuesday");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(editTaskMock).toHaveBeenCalledWith(
        1,
        { name: "New name", description: "New desc", exbucks: 10, assigned_to: 2, day_of_week: "Tuesday" },
      );
    });
  });

  it("parent can delete a task with confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Task to delete", description: "", exbucks: 5, status: "assigned", assigned_to: 2, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(deleteTaskMock).mockResolvedValue(undefined);

    renderTasksPage("parent");

    await screen.findByText("Task to delete");
    await user.click(screen.getByRole("button", { name: /delete/i }));

    // Confirmation dialog should appear
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(deleteTaskMock).toHaveBeenCalledWith(1, expect.anything());
    });
  });

  it("child sees tasks organized by day in a weekly view", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Monday task", description: "", exbucks: 5, status: "assigned", assigned_to: 1, day_of_week: "Monday", photo_url: null },
      { id: 2, name: "Wednesday task", description: "", exbucks: 10, status: "assigned", assigned_to: 1, day_of_week: "Wednesday", photo_url: null },
      { id: 3, name: "Anytime task", description: "", exbucks: 3, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);

    renderTasksPage("child");

    // Weekly view should have day headings
    expect(await screen.findByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Wednesday")).toBeInTheDocument();
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();

    // Tasks appear under their day sections
    expect(screen.getByText("Monday task")).toBeInTheDocument();
    expect(screen.getByText("Wednesday task")).toBeInTheDocument();
    expect(screen.getByText("Anytime task")).toBeInTheDocument();
  });

  it("child can reject an assigned task", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Unwanted task", description: "", exbucks: 5, status: "assigned", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(rejectTaskMock).mockResolvedValue({
      id: 1, name: "Unwanted task", description: "", exbucks: 5, status: "rejected", assigned_to: 1, day_of_week: null, photo_url: null,
    });

    renderTasksPage("child");

    await screen.findByText("Unwanted task");
    const rejectBtn = screen.getByRole("button", { name: /reject/i });
    expect(rejectBtn).toBeInTheDocument();
    await user.click(rejectBtn);

    await waitFor(() => {
      expect(rejectTaskMock).toHaveBeenCalledWith(1, expect.anything());
    });
  });

  it("free child sees lock icon instead of photo URL input", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Photo task", description: "", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "free",
      status: "free",
    });

    renderTasksPage("child");

    await screen.findByText("Photo task");
    // Photo input should NOT be visible for free users
    expect(screen.queryByPlaceholderText(/photo url/i)).not.toBeInTheDocument();
    // Lock indicator should be visible
    expect(screen.getByLabelText(/sizepass required/i)).toBeInTheDocument();
  });

  it("child on SizePass can provide photo URL when completing a task", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Photo task", description: "", exbucks: 10, status: "accepted", assigned_to: 1, day_of_week: null, photo_url: null },
    ]);
    vi.mocked(getSubscriptionMock).mockResolvedValue({
      plan: "sizepass",
      status: "active",
    });
    vi.mocked(completeTaskMock).mockResolvedValue({
      id: 1, name: "Photo task", description: "", exbucks: 10, status: "completed", assigned_to: 1, day_of_week: null, photo_url: "https://example.com/photo.jpg",
    });

    renderTasksPage("child");

    await screen.findByText("Photo task");
    const photoInput = screen.getByPlaceholderText(/photo url/i);
    expect(photoInput).toBeInTheDocument();

    await user.type(photoInput, "https://example.com/photo.jpg");
    await user.click(screen.getByRole("button", { name: /complete/i }));

    await waitFor(() => {
      expect(completeTaskMock).toHaveBeenCalledWith(1, "https://example.com/photo.jpg");
    });
  });

  it("E2E: parent creates weekly task → child sees on day → accepts → completes → parent edits → child sees update", async () => {
    const user = userEvent.setup();

    // Step 1: Parent creates a task for Wednesday
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(createTaskMock).mockResolvedValue({
      id: 1, name: "Wed chore", description: "Clean up", exbucks: 15,
      status: "assigned", assigned_to: 2, day_of_week: "Wednesday", photo_url: null,
    });

    const { unmount: u1 } = renderTasksPage("parent");

    await user.type(await screen.findByLabelText(/name/i), "Wed chore");
    await user.type(screen.getByLabelText(/description/i), "Clean up");
    await user.type(screen.getByLabelText(/exbucks/i), "15");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "2");
    await user.selectOptions(screen.getByLabelText(/day of week/i), "Wednesday");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        { name: "Wed chore", description: "Clean up", exbucks: 15, assigned_to: 2, day_of_week: "Wednesday" },
        expect.anything(),
      );
    });
    u1();

    // Step 2: Child sees task on Wednesday in weekly view, accepts it
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "assigned", assigned_to: 2, day_of_week: "Wednesday", photo_url: null },
    ]);
    vi.mocked(acceptTaskMock).mockResolvedValue({
      id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "accepted", assigned_to: 2, day_of_week: "Wednesday", photo_url: null,
    });

    const { unmount: u2 } = renderTasksPage("child");

    expect(await screen.findByText("Wednesday")).toBeInTheDocument();
    expect(screen.getByText("Wed chore")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept/i }));
    await waitFor(() => expect(acceptTaskMock).toHaveBeenCalledWith(1, expect.anything()));
    u2();

    // Step 3: Child completes the task
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "accepted", assigned_to: 2, day_of_week: "Wednesday", photo_url: null },
    ]);
    vi.mocked(completeTaskMock).mockResolvedValue({
      id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "completed", assigned_to: 2, day_of_week: "Wednesday", photo_url: null,
    });

    const { unmount: u3 } = renderTasksPage("child");
    await screen.findByText("Wed chore");
    await user.click(screen.getByRole("button", { name: /complete/i }));
    await waitFor(() => expect(completeTaskMock).toHaveBeenCalled());
    u3();

    // Step 4: Parent edits another task → child sees update
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "completed", assigned_to: 2, day_of_week: "Wednesday", photo_url: null },
      { id: 2, name: "Old task", description: "Old desc", exbucks: 5, status: "assigned", assigned_to: 2, day_of_week: "Monday", photo_url: null },
    ]);
    vi.mocked(editTaskMock).mockResolvedValue({
      id: 2, name: "Updated task", description: "New desc", exbucks: 10, status: "assigned", assigned_to: 2, day_of_week: "Friday", photo_url: null,
    });

    const { unmount: u4 } = renderTasksPage("parent");
    await screen.findByText("Old task");
    // Find the edit button for the editable task (the assigned one)
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[0]);
    await user.clear(screen.getByLabelText(/edit name/i));
    await user.type(screen.getByLabelText(/edit name/i), "Updated task");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(editTaskMock).toHaveBeenCalled());
    u4();

    // Step 5: Child sees the updated task
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Wed chore", description: "Clean up", exbucks: 15, status: "completed", assigned_to: 2, day_of_week: "Wednesday", photo_url: null },
      { id: 2, name: "Updated task", description: "New desc", exbucks: 10, status: "assigned", assigned_to: 2, day_of_week: "Friday", photo_url: null },
    ]);

    renderTasksPage("child");
    expect(await screen.findByText("Updated task")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
  });

  it("displays photo URL on completed tasks when present", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([
      { id: 1, name: "Done task", description: "", exbucks: 10, status: "completed", assigned_to: 2, day_of_week: null, photo_url: "https://example.com/proof.jpg" },
    ]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });

    renderTasksPage("parent");

    await screen.findByText("Done task");
    expect(screen.getByText(/proof\.jpg/)).toBeInTheDocument();
  });

  it("shows max ExBucks limit hint on create form for parent", async () => {
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getPublicSettingsMock).mockResolvedValue({ max_exbucks_per_task: 50 });

    renderTasksPage("parent");

    expect(await screen.findByText(/max: 50/i)).toBeInTheDocument();
  });

  it("shows inline error when ExBucks exceeds limit and blocks submit", async () => {
    const user = userEvent.setup();
    vi.mocked(getTasksMock).mockResolvedValue([]);
    vi.mocked(getFamilyMock).mockResolvedValue({
      id: 1, pin: "ABC123",
      members: [
        { id: 1, email: "parent@test.com", role: "parent" },
        { id: 2, email: "child@test.com", role: "child" },
      ],
    });
    vi.mocked(getPublicSettingsMock).mockResolvedValue({ max_exbucks_per_task: 50 });

    renderTasksPage("parent");

    await screen.findByText(/max: 50/i);
    await user.type(screen.getByLabelText(/exbucks/i), "60");

    // Error shows immediately as user types over limit
    expect(screen.getByText(/exceeds.*limit/i)).toBeInTheDocument();

    // Fill rest of form and try to submit
    await user.type(screen.getByLabelText(/name/i), "Task");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.selectOptions(screen.getByLabelText(/assign to/i), "2");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    // Should NOT call createTask
    expect(createTaskMock).not.toHaveBeenCalled();
  });
});
