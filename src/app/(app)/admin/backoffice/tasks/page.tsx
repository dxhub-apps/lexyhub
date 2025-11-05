"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Search, Edit2, Trash2, Calendar, User, AlertCircle, X } from "lucide-react";

import type { TaskRecord, TaskStatus } from "@/lib/backoffice/tasks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const defaultHeaders = { "Content-Type": "application/json", "x-user-role": "admin" };

type StatusFormState = Partial<TaskStatus> & { id?: string };
type TaskFormState = {
  id?: string;
  title: string;
  description: string;
  owner: string;
  status_id?: string;
  start_date: string;
  due_date: string;
  dependencies: string[];
};

const initialStatusForm: StatusFormState = { category: "todo", order_index: 0 };

function createEmptyTaskForm(): TaskFormState {
  return {
    id: undefined,
    title: "",
    description: "",
    owner: "",
    status_id: undefined,
    start_date: "",
    due_date: "",
    dependencies: [],
  };
}

function mapTaskToFormState(task: TaskRecord): TaskFormState {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    owner: task.owner ?? "",
    status_id: task.status_id,
    start_date: task.start_date ?? "",
    due_date: task.due_date ?? "",
    dependencies: task.dependencies.map((dependency) => dependency.id),
  };
}

type ViewState = {
  statuses: TaskStatus[];
  tasks: TaskRecord[];
};

const initialState: ViewState = { statuses: [], tasks: [] };

const categoryColors = {
  todo: "bg-gray-100 text-gray-700 border-gray-300",
  in_progress: "bg-blue-100 text-blue-700 border-blue-300",
  review: "bg-yellow-100 text-yellow-700 border-yellow-300",
  done: "bg-green-100 text-green-700 border-green-300",
};

export default function BackofficeTasksPage(): JSX.Element {
  const [data, setData] = useState<ViewState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState<StatusFormState>(initialStatusForm);
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => createEmptyTaskForm());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "status" | "task"; id: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResp, taskResp] = await Promise.all([
        fetch("/api/admin/task-statuses", { headers: { "x-user-role": "admin" } }),
        fetch("/api/admin/tasks", { headers: { "x-user-role": "admin" } }),
      ]);

      if (!statusResp.ok) {
        const payload = await statusResp.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load statuses (${statusResp.status})`);
      }

      if (!taskResp.ok) {
        const payload = await taskResp.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to load tasks (${taskResp.status})`);
      }

      const statuses = ((await statusResp.json()) as { statuses: TaskStatus[] }).statuses ?? [];
      const tasks = ((await taskResp.json()) as { tasks: TaskRecord[] }).tasks ?? [];

      setData({ statuses, tasks });
      setTaskForm((previous) => {
        if (previous.id || previous.status_id || statuses.length === 0) {
          return previous;
        }
        return { ...previous, status_id: statuses[0]?.id };
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForms = () => {
    setStatusForm(initialStatusForm);
    setTaskForm((previous) => ({
      ...createEmptyTaskForm(),
      status_id: data.statuses[0]?.id ?? previous.status_id,
    }));
    setShowStatusDialog(false);
    setShowTaskDialog(false);
  };

  const upsert = async (url: string, payload: Record<string, unknown>, method: "POST" | "PUT") => {
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error ?? `Request failed (${response.status})`);
    }
    return response.json();
  };

  const remove = async (url: string) => {
    const response = await fetch(url, { method: "DELETE", headers: { "x-user-role": "admin" } });
    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error ?? `Delete failed (${response.status})`);
    }
    return response.json();
  };

  const onSubmitStatus = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!statusForm.name || statusForm.name.trim().length === 0) {
        throw new Error("Status name is required");
      }
      const method = statusForm.id ? "PUT" : "POST";
      const payload = {
        ...(statusForm.id ? { id: statusForm.id } : {}),
        name: statusForm.name,
        description: statusForm.description ?? null,
        category: statusForm.category ?? "todo",
        order_index: statusForm.order_index ?? 0,
      };
      await upsert("/api/admin/task-statuses", payload, method);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onSubmitTask = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!taskForm.title || taskForm.title.trim().length === 0) {
        throw new Error("Task title is required");
      }
      if (!taskForm.status_id) {
        throw new Error("Please choose a status for the task");
      }
      const method = taskForm.id ? "PUT" : "POST";
      const payload = {
        ...(taskForm.id ? { id: taskForm.id } : {}),
        title: taskForm.title,
        description: taskForm.description.trim().length > 0 ? taskForm.description : null,
        owner: taskForm.owner.trim().length > 0 ? taskForm.owner : null,
        status_id: taskForm.status_id,
        start_date: taskForm.start_date ? taskForm.start_date : null,
        due_date: taskForm.due_date ? taskForm.due_date : null,
        dependencies: taskForm.dependencies,
      };
      await upsert("/api/admin/tasks", payload, method);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "status") {
        await remove(`/api/admin/task-statuses?id=${deleteTarget.id}`);
      } else {
        await remove(`/api/admin/tasks?id=${deleteTarget.id}`);
      }
      setDeleteTarget(null);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const dependencyOptions = useMemo(() => data.tasks.map((task) => ({ value: task.id, label: task.title })), [data.tasks]);

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      const matchesSearch = searchQuery
        ? task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.owner?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" || task.status_id === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.tasks, searchQuery, statusFilter]);

  const tasksByStatus = useMemo(() => {
    const groups = new Map<string, TaskRecord[]>();
    for (const task of filteredTasks) {
      const key = task.status_id;
      const list = groups.get(key);
      if (list) {
        list.push(task);
      } else {
        groups.set(key, [task]);
      }
    }
    return groups;
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckSquare className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">Task Tracker</CardTitle>
                <CardDescription className="text-base">
                  Coordinate delivery workstreams, model dependencies, and keep owners accountable
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => setStatusForm(initialStatusForm)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Status
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={onSubmitStatus}>
                    <DialogHeader>
                      <DialogTitle>{statusForm.id ? "Edit" : "Create"} Status</DialogTitle>
                      <DialogDescription>
                        Define workflow stages that tasks flow through
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="status-name">Name *</Label>
                        <Input
                          id="status-name"
                          required
                          placeholder="e.g. In Progress"
                          value={statusForm.name ?? ""}
                          onChange={(e) => setStatusForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="status-category">Category</Label>
                        <Select
                          value={statusForm.category ?? "todo"}
                          onValueChange={(value) => setStatusForm((prev) => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger id="status-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To do</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="review">In review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="status-order">Order</Label>
                        <Input
                          id="status-order"
                          type="number"
                          value={statusForm.order_index ?? 0}
                          onChange={(e) =>
                            setStatusForm((prev) => ({ ...prev, order_index: Number.parseInt(e.target.value, 10) || 0 }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="status-description">Description</Label>
                        <Textarea
                          id="status-description"
                          rows={3}
                          placeholder="Where in the workflow should this status be used?"
                          value={statusForm.description ?? ""}
                          onChange={(e) => setStatusForm((prev) => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowStatusDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">{statusForm.id ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => setTaskForm(createEmptyTaskForm())}>
                    <Plus className="mr-2 h-4 w-4" />
                    Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
                  <form onSubmit={onSubmitTask}>
                    <DialogHeader>
                      <DialogTitle>{taskForm.id ? "Edit" : "Create"} Task</DialogTitle>
                      <DialogDescription>
                        Capture backlog items, link blockers, and set schedule expectations
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="task-title">Title *</Label>
                          <Input
                            id="task-title"
                            required
                            placeholder="Implement Etsy sync"
                            value={taskForm.title}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="task-owner">Owner</Label>
                            <Input
                              id="task-owner"
                              placeholder="Owner or squad"
                              value={taskForm.owner}
                              onChange={(e) => setTaskForm((prev) => ({ ...prev, owner: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="task-status">Status *</Label>
                            <Select
                              required
                              value={taskForm.status_id ?? ""}
                              onValueChange={(value) => setTaskForm((prev) => ({ ...prev, status_id: value }))}
                            >
                              <SelectTrigger id="task-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {data.statuses.map((status) => (
                                  <SelectItem key={status.id} value={status.id}>
                                    {status.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="task-start">Start date</Label>
                            <Input
                              id="task-start"
                              type="date"
                              value={taskForm.start_date}
                              onChange={(e) => setTaskForm((prev) => ({ ...prev, start_date: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="task-due">Due date</Label>
                            <Input
                              id="task-due"
                              type="date"
                              value={taskForm.due_date}
                              onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="task-description">Description</Label>
                          <Textarea
                            id="task-description"
                            rows={4}
                            placeholder="Outline the scope, deliverables, and acceptance criteria"
                            value={taskForm.description}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Dependencies (blocks this task)</Label>
                          <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                            {dependencyOptions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No other tasks available</p>
                            ) : (
                              dependencyOptions.map((option) => (
                                <div key={option.value} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`dep-${option.value}`}
                                    checked={taskForm.dependencies.includes(option.value)}
                                    disabled={option.value === taskForm.id}
                                    onCheckedChange={(checked) => {
                                      setTaskForm((prev) => ({
                                        ...prev,
                                        dependencies: checked
                                          ? [...prev.dependencies, option.value]
                                          : prev.dependencies.filter((id) => id !== option.value),
                                      }));
                                    }}
                                  />
                                  <label
                                    htmlFor={`dep-${option.value}`}
                                    className={`text-sm flex-1 cursor-pointer ${
                                      option.value === taskForm.id ? "text-muted-foreground line-through" : ""
                                    }`}
                                  >
                                    {option.label}
                                  </label>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowTaskDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">{taskForm.id ? "Update" : "Create"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statuses Section */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Statuses</CardTitle>
          <CardDescription>
            Define the stages tasks flow through. Ordering controls column rendering and default selection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.statuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No statuses defined yet.</p>
              <p className="text-sm">Create your first status to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.statuses.map((status) => (
                <Card key={status.id} className={`border-2 ${categoryColors[status.category as keyof typeof categoryColors] || categoryColors.todo}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-lg">{status.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {status.category}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStatusForm(status);
                            setShowStatusDialog(true);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget({ type: "status", id: status.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {status.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{status.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {data.statuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading tasks...
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.statuses.map((status) => {
            const items = tasksByStatus.get(status.id) ?? [];
            const categoryColor = categoryColors[status.category as keyof typeof categoryColors] || categoryColors.todo;
            return (
              <Card key={status.id} className={`border-t-4 ${categoryColor.split(" ")[0]}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{status.name}</CardTitle>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No tasks
                    </p>
                  ) : (
                    items.map((task) => (
                      <Card key={task.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-3">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm leading-tight">{task.title}</h4>
                            {task.owner && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {task.owner}
                              </div>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          {(task.start_date || task.due_date) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {task.start_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {task.start_date}
                                </div>
                              )}
                              {task.due_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {task.due_date}
                                </div>
                              )}
                            </div>
                          )}
                          {task.dependencies.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Blocked by:</p>
                              <div className="space-y-1">
                                {task.dependencies.map((dep) => (
                                  <Badge key={dep.id} variant="outline" className="text-xs">
                                    {dep.title}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 h-8"
                              onClick={() => {
                                setTaskForm(mapTaskToFormState(task));
                                setShowTaskDialog(true);
                              }}
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => setDeleteTarget({ type: "task", id: task.id })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
          {data.statuses.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No statuses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first workflow status to start tracking tasks
                </p>
                <Button onClick={() => setShowStatusDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Status
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteTarget?.type}.
              {deleteTarget?.type === "status" && (
                <span className="block mt-2 text-destructive">
                  Warning: This will also delete all tasks with this status!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
