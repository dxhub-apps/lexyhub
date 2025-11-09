// src/app/api/admin/notifications/[id]/publish/route.ts
// Publish a notification to make it live

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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });
  const user = await requireAdmin(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: notification, error } = await supabase
      .from("notifications")
      .update({
        status: "live",
        published_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to publish notification:", error);
      return NextResponse.json({ error: "Failed to publish notification" }, { status: 500 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Error in POST /api/admin/notifications/[id]/publish:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
