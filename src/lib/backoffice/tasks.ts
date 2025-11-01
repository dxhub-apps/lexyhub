import { getSupabaseServerClient } from "@/lib/supabase-server";

export type TaskStatusCategory = "todo" | "in_progress" | "review" | "done" | string;

export type TaskStatus = {
  id: string;
  name: string;
  description: string | null;
  category: TaskStatusCategory;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type TaskDependency = {
  task_id: string;
  depends_on_task_id: string;
};

export type TaskSummary = {
  id: string;
  title: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status_id: string;
  start_date: string | null;
  due_date: string | null;
  priority: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  status?: TaskStatus | null;
  dependencies: TaskSummary[];
};

type TaskRow = Omit<TaskRecord, "status" | "dependencies">;
type TaskWriteInput = Omit<Partial<TaskRecord>, "dependencies"> & { dependencies?: string[] };

function resolveClient() {
  return getSupabaseServerClient();
}

export async function listTaskStatuses(): Promise<TaskStatus[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { data, error } = await client
    .from("backoffice_task_statuses")
    .select("id,name,description,category,order_index,created_at,updated_at")
    .order("order_index", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load task statuses: ${error.message}`);
  }

  return (data ?? []) as TaskStatus[];
}

export async function createTaskStatus(payload: Partial<TaskStatus>): Promise<TaskStatus> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const record = {
    name: payload.name,
    description: payload.description ?? null,
    category: payload.category ?? "todo",
    order_index: payload.order_index ?? 0,
  };

  const { data, error } = await client
    .from("backoffice_task_statuses")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to create task status: ${error.message}`);
  }

  return data as TaskStatus;
}

export async function updateTaskStatus(id: string, payload: Partial<TaskStatus>): Promise<TaskStatus> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const updates = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.order_index !== undefined ? { order_index: payload.order_index } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("backoffice_task_statuses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Unable to update task status: ${error.message}`);
  }

  return data as TaskStatus;
}

export async function deleteTaskStatus(id: string): Promise<void> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { count, error: countError } = await client
    .from("backoffice_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status_id", id);

  if (countError) {
    throw new Error(`Unable to check task usage: ${countError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a status while tasks are assigned to it");
  }

  const { error } = await client.from("backoffice_task_statuses").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete task status: ${error.message}`);
  }
}

function hydrateTasks(
  rows: TaskRow[],
  dependencies: TaskDependency[],
  statuses: TaskStatus[],
): TaskRecord[] {
  const statusMap = new Map(statuses.map((status) => [status.id, status]));
  const taskMap = new Map(rows.map((row) => [row.id, row]));
  const dependencyMap = new Map<string, TaskSummary[]>();

  for (const dependency of dependencies) {
    const task = taskMap.get(dependency.depends_on_task_id);
    if (!task) {
      continue;
    }
    const summary: TaskSummary = { id: dependency.depends_on_task_id, title: task.title };
    const existing = dependencyMap.get(dependency.task_id);
    if (existing) {
      existing.push(summary);
    } else {
      dependencyMap.set(dependency.task_id, [summary]);
    }
  }

  return rows.map((row) => ({
    ...row,
    status: statusMap.get(row.status_id) ?? null,
    dependencies: dependencyMap.get(row.id) ?? [],
  }));
}

export async function listTasks(): Promise<TaskRecord[]> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const [tasksResponse, dependencyResponse, statuses] = await Promise.all([
    client
      .from("backoffice_tasks")
      .select(
        "id,title,description,owner,status_id,start_date,due_date,priority,metadata,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),
    client
      .from("backoffice_task_dependencies")
      .select("task_id,depends_on_task_id")
      .order("created_at", { ascending: true }),
    listTaskStatuses(),
  ]);

  if (tasksResponse.error) {
    throw new Error(`Unable to load tasks: ${tasksResponse.error.message}`);
  }

  if (dependencyResponse.error) {
    throw new Error(`Unable to load task dependencies: ${dependencyResponse.error.message}`);
  }

  const taskRows = (tasksResponse.data ?? []) as TaskRow[];
  const dependencyRows = (dependencyResponse.data ?? []) as TaskDependency[];

  return hydrateTasks(taskRows, dependencyRows, statuses);
}

async function fetchTaskById(id: string): Promise<TaskRecord | null> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const [taskResponse, dependencyResponse, statuses] = await Promise.all([
    client
      .from("backoffice_tasks")
      .select(
        "id,title,description,owner,status_id,start_date,due_date,priority,metadata,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    client
      .from("backoffice_task_dependencies")
      .select("task_id,depends_on_task_id")
      .eq("task_id", id),
    listTaskStatuses(),
  ]);

  if (taskResponse.error) {
    throw new Error(`Unable to load task: ${taskResponse.error.message}`);
  }

  if (!taskResponse.data) {
    return null;
  }

  if (dependencyResponse.error) {
    throw new Error(`Unable to load task dependencies: ${dependencyResponse.error.message}`);
  }

  const taskRows = [taskResponse.data as TaskRow];
  const dependencyRows = (dependencyResponse.data ?? []) as TaskDependency[];
  const [record] = hydrateTasks(taskRows, dependencyRows, statuses);
  return record ?? null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeDependencies(ids: unknown[], selfId?: string): string[] {
  return ids
    .map((value) => (typeof value === "string" ? value : null))
    .filter((value): value is string => Boolean(value) && value !== selfId);
}

export async function createTask(payload: TaskWriteInput): Promise<TaskRecord> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  if (!payload.title || !payload.status_id) {
    throw new Error("Task title and status are required");
  }

  const record = {
    title: payload.title,
    description: payload.description ?? null,
    owner: payload.owner ?? null,
    status_id: payload.status_id,
    start_date: normalizeDate(payload.start_date),
    due_date: normalizeDate(payload.due_date),
    priority: payload.priority ?? null,
    metadata: payload.metadata ?? {},
  } satisfies Partial<TaskRow>;

  const { data, error } = await client.from("backoffice_tasks").insert(record).select().single();

  if (error) {
    throw new Error(`Unable to create task: ${error.message}`);
  }

  const taskRow = data as TaskRow;
  const dependencies = Array.isArray(payload.dependencies)
    ? sanitizeDependencies(payload.dependencies, taskRow.id)
    : [];

  if (dependencies.length > 0) {
    const inserts = dependencies.map((dependsOn) => ({
      task_id: taskRow.id,
      depends_on_task_id: dependsOn,
    }));

    const { error: dependencyError } = await client
      .from("backoffice_task_dependencies")
      .insert(inserts);

    if (dependencyError) {
      await client.from("backoffice_tasks").delete().eq("id", taskRow.id);
      throw new Error(`Unable to link task dependencies: ${dependencyError.message}`);
    }
  }

  const task = await fetchTaskById(taskRow.id);
  if (!task) {
    throw new Error("Task was created but could not be reloaded");
  }

  return task;
}

export async function updateTask(id: string, payload: TaskWriteInput): Promise<TaskRecord> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const updates: Partial<TaskRow> = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
    ...(payload.status_id !== undefined ? { status_id: payload.status_id } : {}),
    ...(payload.start_date !== undefined ? { start_date: normalizeDate(payload.start_date) } : {}),
    ...(payload.due_date !== undefined ? { due_date: normalizeDate(payload.due_date) } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.metadata !== undefined ? { metadata: payload.metadata ?? {} } : {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("backoffice_tasks")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to update task: ${error.message}`);
  }

  if (payload.dependencies !== undefined) {
    const { error: deleteError } = await client
      .from("backoffice_task_dependencies")
      .delete()
      .eq("task_id", id);

    if (deleteError) {
      throw new Error(`Unable to update task dependencies: ${deleteError.message}`);
    }

    const sanitized = Array.isArray(payload.dependencies)
      ? sanitizeDependencies(payload.dependencies, id)
      : [];

    if (sanitized.length > 0) {
      const inserts = sanitized.map((dependsOn) => ({
        task_id: id,
        depends_on_task_id: dependsOn,
      }));

      const { error: insertError } = await client
        .from("backoffice_task_dependencies")
        .insert(inserts);

      if (insertError) {
        throw new Error(`Unable to link task dependencies: ${insertError.message}`);
      }
    }
  }

  const task = await fetchTaskById(id);
  if (!task) {
    throw new Error("Task was updated but could not be reloaded");
  }

  return task;
}

export async function deleteTask(id: string): Promise<void> {
  const client = resolveClient();
  if (!client) {
    throw new Error("Supabase client is not configured");
  }

  const { error: dependencyError } = await client
    .from("backoffice_task_dependencies")
    .delete()
    .eq("task_id", id);

  if (dependencyError) {
    throw new Error(`Unable to clean up task dependencies: ${dependencyError.message}`);
  }

  const { error } = await client.from("backoffice_tasks").delete().eq("id", id);
  if (error) {
    throw new Error(`Unable to delete task: ${error.message}`);
  }
}
