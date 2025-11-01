import { NextResponse } from "next/server";

import {
  createRiskEntry,
  deleteRiskEntry,
  listRiskRegister,
  updateRiskEntry,
} from "@/lib/risk/service";
import { requireAdminUser } from "@/lib/backoffice/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const register = await listRiskRegister();
    return NextResponse.json({ register });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load risk register.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const entry = await createRiskEntry({
      title: String(payload.title ?? ""),
      summary: payload.summary ? String(payload.summary) : null,
      status: payload.status ? String(payload.status) : "open",
      severity: payload.severity ? String(payload.severity) : "medium",
      likelihood: payload.likelihood ? String(payload.likelihood) : "possible",
      impact: payload.impact ? String(payload.impact) : "moderate",
      owner: payload.owner ? String(payload.owner) : null,
      appetite_id: payload.appetite_id ? String(payload.appetite_id) : null,
      control_id: payload.control_id ? String(payload.control_id) : null,
      mitigation: payload.mitigation ? String(payload.mitigation) : null,
      follow_up: payload.follow_up ? String(payload.follow_up) : null,
      due_at: payload.due_at ? String(payload.due_at) : null,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create risk entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown> & { id?: string };
    if (!payload.id) {
      return NextResponse.json({ error: "Missing risk id" }, { status: 400 });
    }
    const entry = await updateRiskEntry(payload.id, payload);
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update risk entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing risk id" }, { status: 400 });
    }
    await deleteRiskEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete risk entry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
