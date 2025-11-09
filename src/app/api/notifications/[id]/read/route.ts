// src/app/api/notifications/[id]/read/route.ts
// Mark notification as read

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notificationId = params.id;

    // Call the database function to mark as read
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: notificationId,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Failed to mark notification as read:", error);
      return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/notifications/[id]/read:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
