"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { TaskRecord, TaskStatus } from "@/lib/backoffice/tasks";

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

export default function BackofficeTasksPage(): JSX.Element {
  const [data, setData] = useState<ViewState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState<StatusFormState>(initialStatusForm);
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => createEmptyTaskForm());

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

  const dependencyOptions = useMemo(() => data.tasks.map((task) => ({ value: task.id, label: task.title })), [data.tasks]);

  const tasksByStatus = useMemo(() => {
    const groups = new Map<string, TaskRecord[]>();
    for (const task of data.tasks) {
      const key = task.status_id;
      const list = groups.get(key);
      if (list) {
        list.push(task);
      } else {
        groups.set(key, [task]);
      }
    }
    return groups;
  }, [data.tasks]);

  return (
    <div className="task-workspace">
      <header className="task-workspace__header">
        <div>
          <h1>Backoffice task tracker</h1>
          <p className="subtitle">
            Coordinate delivery workstreams, model dependencies, and keep owners accountable – Jira style, without leaving the
            backoffice.
          </p>
        </div>
      </header>
      {loading ? <p>Loading tasks…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="surface-card task-statuses">
        <h2>Workflow statuses</h2>
        <p className="muted">
          Define the stages tasks flow through. Ordering controls how columns render and determines the default selection for new
          work items.
        </p>
        <form className="form-grid" onSubmit={onSubmitStatus}>
          <label>
            Name
            <input
              required
              placeholder="e.g. In Progress"
              value={statusForm.name ?? ""}
              onChange={(event) => setStatusForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label>
            Category
            <select
              value={statusForm.category ?? "todo"}
              onChange={(event) => setStatusForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">In review</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Order
            <input
              type="number"
              value={statusForm.order_index ?? 0}
              onChange={(event) =>
                setStatusForm((prev) => ({ ...prev, order_index: Number.parseInt(event.target.value, 10) || 0 }))
              }
            />
          </label>
          <label className="form-grid--full">
            Description
            <textarea
              rows={3}
              placeholder="Where in the workflow should this status be used?"
              value={statusForm.description ?? ""}
              onChange={(event) => setStatusForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="submit">{statusForm.id ? "Update" : "Create"} status</button>
            {statusForm.id ? (
              <button type="button" onClick={() => setStatusForm(initialStatusForm)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <ul className="task-statuses__list">
          {data.statuses.map((status) => (
            <li key={status.id}>
              <div>
                <strong>{status.name}</strong>
                <span className={`task-status-badge task-status-badge--${status.category}`}>{status.category}</span>
              </div>
              {status.description ? <p className="muted">{status.description}</p> : null}
              <div className="task-statuses__actions">
                <button type="button" onClick={() => setStatusForm(status)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await remove(`/api/admin/task-statuses?id=${status.id}`);
                      resetForms();
                      await loadData();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {data.statuses.length === 0 ? <li className="muted">No statuses defined yet.</li> : null}
        </ul>
      </section>

      <section className="surface-card task-editor">
        <h2>Tasks</h2>
        <p className="muted">
          Capture backlog items, link blockers, and set schedule expectations. Dependencies keep everyone aware of sequencing
          risk.
        </p>
        <form className="form-grid" onSubmit={onSubmitTask}>
          <label>
            Title
            <input
              required
              placeholder="Implement Etsy sync"
              value={taskForm.title}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <label>
            Owner
            <input
              placeholder="Owner or squad"
              value={taskForm.owner}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, owner: event.target.value }))}
            />
          </label>
          <label>
            Status
            <select
              required
              value={taskForm.status_id ?? ""}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, status_id: event.target.value }))}
            >
              <option value="" disabled>
                Select status
              </option>
              {data.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input
              type="date"
              value={taskForm.start_date}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, start_date: event.target.value }))}
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={taskForm.due_date}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))}
            />
          </label>
          <label className="form-grid--full">
            Description
            <textarea
              rows={4}
              placeholder="Outline the scope, deliverables, and acceptance criteria"
              value={taskForm.description}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <label className="form-grid--full">
            Dependencies
            <select
              multiple
              value={taskForm.dependencies}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setTaskForm((prev) => ({ ...prev, dependencies: selected.filter((id) => id !== prev.id) }));
              }}
            >
              {dependencyOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.value === taskForm.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit">{taskForm.id ? "Update" : "Create"} task</button>
            {taskForm.id ? (
              <button
                type="button"
                onClick={() =>
                  setTaskForm((prev) => ({
                    ...createEmptyTaskForm(),
                    status_id: data.statuses[0]?.id ?? prev.status_id,
                  }))
                }
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <div className="task-columns">
          {data.statuses.map((status) => {
            const items = tasksByStatus.get(status.id) ?? [];
            return (
              <article key={status.id} className="task-column">
                <header>
                  <h3>{status.name}</h3>
                  <span className="task-count">{items.length} task{items.length === 1 ? "" : "s"}</span>
                </header>
                <ul>
                  {items.map((task) => (
                    <li key={task.id}>
                      <div className="task-card">
                        <div className="task-card__title">
                          <strong>{task.title}</strong>
                          {task.owner ? <span className="muted">{task.owner}</span> : null}
                        </div>
                        {task.description ? <p className="muted">{task.description}</p> : null}
                        <dl className="task-card__meta">
                          <div>
                            <dt>Start</dt>
                            <dd>{task.start_date ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Due</dt>
                            <dd>{task.due_date ?? "—"}</dd>
                          </div>
                        </dl>
                        {task.dependencies.length > 0 ? (
                          <div className="task-card__dependencies">
                            <span>Blocked by:</span>
                            <ul>
                              {task.dependencies.map((dependency) => (
                                <li key={dependency.id}>{dependency.title}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="task-card__actions">
                          <button type="button" onClick={() => setTaskForm(mapTaskToFormState(task))}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await remove(`/api/admin/tasks?id=${task.id}`);
                                resetForms();
                                await loadData();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : String(err));
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                  {items.length === 0 ? <li className="muted">Nothing here yet.</li> : null}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
