import { NextResponse } from "next/server";

import { deleteRiskControl, listRiskControls, upsertRiskControl } from "@/lib/risk/service";
import { requireAdminUser } from "@/lib/backoffice/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const controls = await listRiskControls();
    return NextResponse.json({ controls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load risk controls.";
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
    const control = await upsertRiskControl({
      name: String(payload.name ?? ""),
      description: payload.description ? String(payload.description) : null,
      owner: payload.owner ? String(payload.owner) : null,
      status: payload.status ? String(payload.status) : "draft",
      coverage_area: payload.coverage_area ? String(payload.coverage_area) : null,
      metadata: (payload.metadata as Record<string, unknown>) ?? {},
    });
    return NextResponse.json({ control }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create risk control.";
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
      return NextResponse.json({ error: "Missing control id" }, { status: 400 });
    }
    const control = await upsertRiskControl(payload);
    return NextResponse.json({ control });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update risk control.";
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
      return NextResponse.json({ error: "Missing control id" }, { status: 400 });
    }
    await deleteRiskControl(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete risk control.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
