import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useLoading } from "@/hooks/useLoading";
import {
  getTasks,
  createTask,
  acceptTask,
  approveTask,
  rejectTask,
  completeTask,
  editTask,
  deleteTask,
  getFamily,
  getSubscription,
  getPublicSettings,
  type UserResponse,
  type TaskResponse,
} from "@/api";

interface TasksPageProps {
  user: UserResponse;
}

const statusStyles: Record<TaskResponse["status"], string> = {
  assigned: "bg-gray-100 text-gray-700",
  accepted: "bg-blue-100 text-blue-700",
  completed: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: TaskResponse["status"] }) {
  return (
    <span
      data-testid="status-badge"
      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TasksPage({ user }: TasksPageProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exbucks, setExbucks] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExbucks, setEditExbucks] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDayOfWeek, setEditDayOfWeek] = useState("");

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Create task loading state
  const { isLoading: isCreating, error: createError, execute: executeCreate } = useLoading();


  // Photo URL state (per-task, keyed by task id)
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: getTasks,
    retry: false,
  });

  const { data: family } = useQuery({
    queryKey: ["family"],
    queryFn: getFamily,
    retry: false,
    enabled: user.role === "parent",
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
    enabled: user.role === "child",
  });

  const { data: appSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: getPublicSettings,
    retry: false,
    enabled: user.role === "parent",
  });

  const maxExbucks = appSettings?.max_exbucks_per_task;

  const hasSizePass = subscription?.plan !== "free";

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setName("");
      setDescription("");
      setExbucks("");
      setAssignedTo("");
      setDayOfWeek("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["child-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: acceptTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, photoUrl }: { id: number; photoUrl?: string }) => completeTask(id, photoUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["exbucks-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: () => {},
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; exbucks: number; assigned_to: number; day_of_week: string | null }) =>
      editTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeletingId(null);
    },
  });

  function startEditing(task: TaskResponse) {
    setEditingId(task.id);
    setEditName(task.name);
    setEditDescription(task.description);
    setEditExbucks(String(task.exbucks));
    setEditAssignedTo(String(task.assigned_to));
    setEditDayOfWeek(task.day_of_week ?? "");
  }

  if (isLoading) return <div>Loading...</div>;

  const children = family?.members.filter((m) => m.role === "child") ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>

      {user.role === "parent" && (
        <Card>
          <CardHeader>
            <CardTitle>Create Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (maxExbucks != null && Number(exbucks) > maxExbucks) {
                  return;
                }
                executeCreate(async () => {
                  await createMutation.mutateAsync({
                    name,
                    description,
                    exbucks: Number(exbucks),
                    assigned_to: Number(assignedTo),
                    day_of_week: dayOfWeek || null,
                  });
                }).catch(() => {});
              }}
            >
              <div>
                <Label htmlFor="task-name">Name</Label>
                <Input
                  id="task-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="task-description">Description</Label>
                <Input
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="task-exbucks">ExBucks</Label>
                <Input
                  id="task-exbucks"
                  type="number"
                  value={exbucks}
                  onChange={(e) => setExbucks(e.target.value)}
                />
                {maxExbucks != null && Number(exbucks) > maxExbucks ? (
                  <p className="text-xs text-red-600 mt-1">ExBucks exceeds the limit of {maxExbucks}</p>
                ) : maxExbucks != null ? (
                  <p className="text-xs text-muted-foreground mt-1">Max: {maxExbucks}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="task-assign">Assign to</Label>
                <select
                  id="task-assign"
                  className="w-full rounded border p-2"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task-day">Day of Week</Label>
                <select
                  id="task-day"
                  className="w-full rounded border p-2"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  <option value="">Any day</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </span>
                ) : (
                  "Create Task"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {user.role === "child" ? (
        <ChildWeeklyView tasks={tasks ?? []} renderTask={renderTaskItem} />
      ) : (
        <div className="space-y-2">
          {tasks?.map(renderTaskItem)}
        </div>
      )}
    </div>
  );

  function renderTaskItem(task: TaskResponse) {
    return (
      <div key={task.id} className="rounded border p-3">
        {editingId === task.id ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              editMutation.mutate({
                id: task.id,
                name: editName,
                description: editDescription,
                exbucks: Number(editExbucks),
                assigned_to: Number(editAssignedTo),
                day_of_week: editDayOfWeek || null,
              });
            }}
          >
            <div>
              <Label htmlFor="edit-name">Edit Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-description">Edit Description</Label>
              <Input id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-exbucks">Edit ExBucks</Label>
              <Input id="edit-exbucks" type="number" value={editExbucks} onChange={(e) => setEditExbucks(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-assign">Edit Assign to</Label>
              <select id="edit-assign" className="w-full rounded border p-2" value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)}>
                <option value="">Select child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.email}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-day">Edit Day</Label>
              <select id="edit-day" className="w-full rounded border p-2" value={editDayOfWeek} onChange={(e) => setEditDayOfWeek(e.target.value)}>
                <option value="">Any day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={editMutation.isPending}>
                {editMutation.isPending ? (
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar icon={task.avatar_icon} background={task.avatar_background} size="sm" />
              <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.name}</span>
                <StatusBadge status={task.status} />
                {user.role === "parent" && task.day_of_week && (
                  <span className="text-xs text-muted-foreground">{task.day_of_week}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {task.description}
                {task.description && " · "}
                {task.exbucks} ExBucks
              </p>
              {task.photo_url && (
                <p className="text-xs text-blue-600">
                  <a href={task.photo_url} target="_blank" rel="noopener noreferrer">{task.photo_url}</a>
                </p>
              )}
              </div>
            </div>
            <div className="flex gap-2">
              {user.role === "parent" && !["completed", "approved"].includes(task.status) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => startEditing(task)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeletingId(task.id)}>Delete</Button>
                </>
              )}
              {user.role === "parent" && task.status === "completed" && (
                <>
                  <Button size="sm" disabled={approveMutation.isPending || rejectMutation.isPending} onClick={() => approveMutation.mutate(task.id)}>
                    {approveMutation.isPending ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Approving...
                      </span>
                    ) : (
                      "Approve"
                    )}
                  </Button>
                  <Button variant="destructive" size="sm" disabled={approveMutation.isPending || rejectMutation.isPending} onClick={() => rejectMutation.mutate(task.id)}>
                    {rejectMutation.isPending ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Rejecting...
                      </span>
                    ) : (
                      "Reject"
                    )}
                  </Button>
                </>
              )}
              {user.role === "child" && task.status === "assigned" && (
                <>
                  <Button size="sm" disabled={acceptMutation.isPending || rejectMutation.isPending} onClick={() => acceptMutation.mutate(task.id)}>
                    {acceptMutation.isPending ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Accepting...
                      </span>
                    ) : (
                      "Accept"
                    )}
                  </Button>
                  <Button size="sm" variant="outline" disabled={acceptMutation.isPending || rejectMutation.isPending} onClick={() => rejectMutation.mutate(task.id)}>
                    {rejectMutation.isPending ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Rejecting...
                      </span>
                    ) : (
                      "Reject"
                    )}
                  </Button>
                </>
              )}
              {user.role === "child" && task.status === "accepted" && (
                <>
                  {hasSizePass ? (
                    <Input
                      placeholder="Photo URL (optional)"
                      className="w-48"
                      value={photoUrls[task.id] ?? ""}
                      onChange={(e) => setPhotoUrls((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" aria-label="SizePass required" />
                  )}
                  <Button size="sm" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate({ id: task.id, photoUrl: hasSizePass ? (photoUrls[task.id] || undefined) : undefined })}>
                    {completeMutation.isPending ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Completing...
                      </span>
                    ) : (
                      "Complete"
                    )}
                  </Button>
                  {completeMutation.isError && (
                    <span className="text-xs text-destructive">{(completeMutation.error as Error)?.message}</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {deletingId === task.id && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-3">
            <p className="text-sm">Are you sure you want to delete this task?</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(task.id)}>
                {deleteMutation.isPending ? (
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Deleting...
                  </span>
                ) : (
                  "Confirm"
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

function ChildWeeklyView({ tasks, renderTask }: { tasks: TaskResponse[]; renderTask: (task: TaskResponse) => React.ReactNode }) {
  const grouped = new Map<string, TaskResponse[]>();
  for (const day of DAYS) {
    const dayTasks = tasks.filter((t) => t.day_of_week === day);
    if (dayTasks.length > 0) grouped.set(day, dayTasks);
  }
  const unscheduled = tasks.filter((t) => !t.day_of_week);
  if (unscheduled.length > 0) grouped.set("Unscheduled", unscheduled);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([day, dayTasks]) => (
        <div key={day}>
          <h3 className="mb-2 text-lg font-semibold">{day}</h3>
          <div className="space-y-2">
            {dayTasks.map(renderTask)}
          </div>
        </div>
      ))}
    </div>
  );
}
