import { NextResponse } from "next/server";

import {
  createTaskStatus,
  deleteTaskStatus,
  listTaskStatuses,
  updateTaskStatus,
} from "@/lib/backoffice/tasks";
import { assertAdmin } from "@/lib/backoffice/auth";

function normalizeOrderIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const statuses = await listTaskStatuses();
    return NextResponse.json({ statuses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load task statuses.";
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
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Status name is required" }, { status: 400 });
    }
    const orderIndex = normalizeOrderIndex(payload.order_index);
    if (payload.order_index !== undefined && orderIndex === undefined) {
      return NextResponse.json({ error: "Order index must be a number" }, { status: 400 });
    }
    const status = await createTaskStatus({
      name,
      description: payload.description ? String(payload.description) : null,
      category: payload.category ? String(payload.category) : undefined,
      order_index: orderIndex,
    });
    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create task status.";
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
      return NextResponse.json({ error: "Missing status id" }, { status: 400 });
    }
    const orderIndex = normalizeOrderIndex(payload.order_index);
    if (payload.order_index !== undefined && orderIndex === undefined) {
      return NextResponse.json({ error: "Order index must be a number" }, { status: 400 });
    }
    const updates = {
      ...(payload.name !== undefined ? { name: String(payload.name) } : {}),
      ...(payload.description !== undefined ? { description: payload.description ? String(payload.description) : null } : {}),
      ...(payload.category !== undefined ? { category: String(payload.category) } : {}),
      ...(orderIndex !== undefined ? { order_index: orderIndex } : {}),
    };
    const status = await updateTaskStatus(payload.id, updates);
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task status.";
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
      return NextResponse.json({ error: "Missing status id" }, { status: 400 });
    }
    await deleteTaskStatus(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete task status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
