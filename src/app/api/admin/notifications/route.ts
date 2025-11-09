// src/app/api/admin/notifications/route.ts
// Admin API for managing notifications

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

// GET /api/admin/notifications - Get all notifications
export async function GET(req: Request): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });
  const user = await requireAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error in GET /api/admin/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/notifications - Create notification
export async function POST(req: Request): Promise<NextResponse> {
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

    if (!body.title || !body.body) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
    }

    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        title: body.title,
        body: body.body,
        category: body.category,
        severity: body.severity,
        kind: body.kind,
        cta_text: body.cta_text || null,
        cta_url: body.cta_url || null,
        source: "admin",
        status: "draft",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create notification:", error);
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
    }

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/admin/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
