// src/app/api/notifications/route.ts
// API endpoints for user notifications

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

// GET /api/notifications - Get user's notifications
export async function GET(req: Request): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's notifications with delivery status
    const { data: notifications, error } = await supabase
      .from("notification_delivery")
      .select(
        `
        id,
        state,
        first_seen_at,
        clicked_at,
        dismissed_at,
        notifications (
          id,
          title,
          body,
          category,
          severity,
          cta_text,
          cta_url,
          created_at
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to fetch notifications:", error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    // Transform the data to a cleaner structure
    const transformedNotifications = (notifications ?? [])
      .filter((item: any) => item.notifications)
      .map((item: any) => ({
        id: item.notifications.id,
        title: item.notifications.title,
        message: item.notifications.body ?? "",
        type: item.notifications.category,
        read: item.state !== "pending",
        created_at: item.notifications.created_at,
        cta_text: item.notifications.cta_text,
        cta_url: item.notifications.cta_url,
      }));

    return NextResponse.json({ notifications: transformedNotifications });
  } catch (error) {
    console.error("Error in GET /api/notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
