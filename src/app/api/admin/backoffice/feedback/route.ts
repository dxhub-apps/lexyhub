/**
 * Admin Backoffice Feedback API
 * GET - List all feedback with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/backoffice/auth";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ api: "admin/backoffice/feedback" });

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check admin authentication
    const adminUser = await requireAdminUser();

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const plan = searchParams.get("plan");
    const impact = searchParams.get("impact");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // 3. Build query
    const supabase = createRouteHandlerClient({ cookies });
    let query = supabase
      .from("feedback")
      .select(
        `
        id,
        user_id,
        user_email,
        user_plan,
        type,
        title,
        message,
        rating,
        page_url,
        app_section,
        status,
        impact,
        priority,
        metadata,
        screenshot_url,
        created_at,
        updated_at,
        resolved_at,
        resolved_by,
        internal_note
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (type) {
      query = query.eq("type", type);
    }

    if (plan) {
      query = query.eq("user_plan", plan);
    }

    if (impact) {
      query = query.eq("impact", impact);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,message.ilike.%${search}%,user_email.ilike.%${search}%`
      );
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", to);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // 4. Execute query
    const { data: feedback, error, count } = await query;

    if (error) {
      log.error(
        { type: "feedback_list_failed", error: error.message },
        "Failed to list feedback"
      );
      return NextResponse.json(
        { error: "list_failed", message: error.message },
        { status: 500 }
      );
    }

    // 5. Return results
    return NextResponse.json({
      feedback,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to list feedback";
    log.error({ error }, "Failed to list feedback");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
