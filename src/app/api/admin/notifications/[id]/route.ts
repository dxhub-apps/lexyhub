// src/app/api/admin/notifications/[id]/route.ts
// Admin API for managing individual notifications

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

async function requireAdmin(supabase: any) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  if (profile?.plan !== "admin") {
    return null;
  }

  return user;
}

// PUT /api/admin/notifications/[id] - Update notification
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });
  const user = await requireAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      title: string;
      body: string;
      category: string;
      severity: string;
      kind: string;
      cta_text?: string;
      cta_url?: string;
    };

    const { data: notification, error } = await supabase
      .from("notifications")
      .update({
        title: body.title,
        body: body.body,
        category: body.category,
        severity: body.severity,
        kind: body.kind,
        cta_text: body.cta_text || null,
        cta_url: body.cta_url || null,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update notification:", error);
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Error in PUT /api/admin/notifications/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/notifications/[id] - Delete notification
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });
  const user = await requireAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Failed to delete notification:", error);
      return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/notifications/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
