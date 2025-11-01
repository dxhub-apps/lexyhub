import { NextResponse } from "next/server";

import { createTask, deleteTask, listTasks, updateTask } from "@/lib/backoffice/tasks";
import { assertAdmin } from "@/lib/backoffice/auth";

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDependencies(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item : null))
    .filter((item): item is string => Boolean(item));
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const tasks = await listTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const statusId = typeof payload.status_id === "string" ? payload.status_id : "";
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (!statusId) {
      return NextResponse.json({ error: "Task status is required" }, { status: 400 });
    }
    const task = await createTask({
      title,
      description: payload.description ? String(payload.description) : null,
      owner: payload.owner ? String(payload.owner) : null,
      status_id: statusId,
      start_date: normalizeDate(payload.start_date),
      due_date: normalizeDate(payload.due_date),
      dependencies: normalizeDependencies(payload.dependencies) ?? [],
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown> & { id?: string };
    if (!payload.id) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }
    const dependencies = normalizeDependencies(payload.dependencies);
    const updates = {
      ...(payload.title !== undefined ? { title: payload.title ? String(payload.title) : "" } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description ? String(payload.description) : null }
        : {}),
      ...(payload.owner !== undefined ? { owner: payload.owner ? String(payload.owner) : null } : {}),
      ...(payload.status_id !== undefined ? { status_id: String(payload.status_id) } : {}),
      ...(payload.start_date !== undefined ? { start_date: normalizeDate(payload.start_date) } : {}),
      ...(payload.due_date !== undefined ? { due_date: normalizeDate(payload.due_date) } : {}),
      ...(dependencies !== undefined ? { dependencies } : {}),
    };
    const task = await updateTask(payload.id, updates);
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
