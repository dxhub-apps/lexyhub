import { NextResponse } from "next/server";

import {
  createRiskAppetite,
  deleteRiskAppetite,
  listRiskAppetites,
  updateRiskAppetite,
} from "@/lib/risk/service";
import { requireAdminUser } from "@/lib/backoffice/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const appetites = await listRiskAppetites();
    return NextResponse.json({ appetites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load risk appetites.";
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
    const appetite = await createRiskAppetite({
      label: String(payload.label ?? ""),
      category: payload.category ? String(payload.category) : null,
      appetite_level: payload.appetite_level ? String(payload.appetite_level) : "balanced",
      owner: payload.owner ? String(payload.owner) : null,
      tolerance: (payload.tolerance as Record<string, unknown>) ?? {},
      notes: payload.notes ? String(payload.notes) : null,
    });
    return NextResponse.json({ appetite }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create risk appetite.";
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
      return NextResponse.json({ error: "Missing appetite id" }, { status: 400 });
    }
    const appetite = await updateRiskAppetite(payload.id, payload);
    return NextResponse.json({ appetite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update risk appetite.";
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
      return NextResponse.json({ error: "Missing appetite id" }, { status: 400 });
    }
    await deleteRiskAppetite(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete risk appetite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
