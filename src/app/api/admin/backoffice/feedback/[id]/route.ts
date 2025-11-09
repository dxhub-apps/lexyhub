/**
 * Admin Backoffice Feedback Item API
 * GET - Get single feedback item
 * PATCH - Update feedback item (status, priority, notes, etc.)
 * DELETE - Delete feedback item
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/backoffice/auth";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ api: "admin/backoffice/feedback/[id]" });

// =====================================================
// Update Schema
// =====================================================

const UpdateFeedbackSchema = z.object({
  status: z.enum(["new", "in_review", "planned", "done", "rejected"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  internal_note: z.string().max(2000).optional(),
  resolved_at: z.string().datetime().optional().nullable(),
});

type UpdateFeedback = z.infer<typeof UpdateFeedbackSchema>;

// =====================================================
// GET - Get single feedback item
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Check admin authentication
    const adminUser = await requireAdminUser();

    // 2. Get feedback item
    const supabase = createRouteHandlerClient({ cookies });
    const { data: feedback, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      log.error(
        { type: "feedback_get_failed", id: params.id, error: error.message },
        "Failed to get feedback"
      );
      return NextResponse.json(
        { error: "get_failed", message: error.message },
        { status: 500 }
      );
    }

    if (!feedback) {
      return NextResponse.json(
        { error: "not_found", message: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to get feedback";
    log.error({ error }, "Failed to get feedback");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// =====================================================
// PATCH - Update feedback item
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Check admin authentication
    const adminUser = await requireAdminUser();

    // 2. Parse and validate request
    const body = await request.json().catch(() => null);
    const parsed = UpdateFeedbackSchema.safeParse(body);

    if (!parsed.success) {
      log.warn(
        {
          type: "feedback_update_invalid_request",
          errors: parsed.error.errors,
          id: params.id,
        },
        "Invalid feedback update request"
      );
      return NextResponse.json(
        {
          error: "invalid_request",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // 3. Build update object
    const updates: Record<string, any> = {};

    if (data.status !== undefined) {
      updates.status = data.status;
    }

    if (data.priority !== undefined) {
      updates.priority = data.priority;
    }

    if (data.internal_note !== undefined) {
      updates.internal_note = data.internal_note;
    }

    if (data.resolved_at !== undefined) {
      updates.resolved_at = data.resolved_at;
      if (data.resolved_at) {
        updates.resolved_by = adminUser.user.id;
      } else {
        updates.resolved_by = null;
      }
    }

    // Auto-set resolved_at if status changes to done or rejected
    if (data.status === "done" || data.status === "rejected") {
      if (!updates.resolved_at) {
        updates.resolved_at = new Date().toISOString();
        updates.resolved_by = adminUser.user.id;
      }
    }

    // 4. Update feedback
    const supabase = createRouteHandlerClient({ cookies });
    const { data: feedback, error } = await supabase
      .from("feedback")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      log.error(
        {
          type: "feedback_update_failed",
          id: params.id,
          error: error.message,
        },
        "Failed to update feedback"
      );
      return NextResponse.json(
        { error: "update_failed", message: error.message },
        { status: 500 }
      );
    }

    log.info(
      {
        type: "feedback_updated",
        id: params.id,
        admin_id: adminUser.user.id,
        updates: Object.keys(updates),
      },
      "Feedback updated successfully"
    );

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to update feedback";
    log.error({ error }, "Failed to update feedback");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// =====================================================
// DELETE - Delete feedback item (for spam cleanup)
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1. Check admin authentication
    const adminUser = await requireAdminUser();

    // 2. Delete feedback
    const supabase = createRouteHandlerClient({ cookies });
    const { error } = await supabase
      .from("feedback")
      .delete()
      .eq("id", params.id);

    if (error) {
      log.error(
        {
          type: "feedback_delete_failed",
          id: params.id,
          error: error.message,
        },
        "Failed to delete feedback"
      );
      return NextResponse.json(
        { error: "delete_failed", message: error.message },
        { status: 500 }
      );
    }

    log.info(
      {
        type: "feedback_deleted",
        id: params.id,
        admin_id: adminUser.user.id,
      },
      "Feedback deleted successfully"
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to delete feedback";
    log.error({ error }, "Failed to delete feedback");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
