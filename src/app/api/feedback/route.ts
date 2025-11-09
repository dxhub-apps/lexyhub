/**
 * User Feedback API Endpoint
 *
 * Allows authenticated users to submit feedback about the application.
 * POST /api/feedback - Submit new feedback
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = logger.child({ api: "feedback" });

// =====================================================
// Request Validation Schema
// =====================================================

const FeedbackSubmitSchema = z.object({
  type: z.enum(["bug", "idea", "question", "other", "rating"]),
  title: z.string().min(1).max(200).optional(),
  message: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
  pageUrl: z.string().max(500).optional(),
  appSection: z.string().max(100).optional(),
  metadata: z.record(z.any()).optional(),
  screenshotUrl: z.string().max(500).optional(),
  includeContext: z.boolean().default(true),
});

type FeedbackSubmit = z.infer<typeof FeedbackSubmitSchema>;

// =====================================================
// Rate Limiting (simple in-memory implementation)
// =====================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 submissions per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimit.count++;
  return true;
}

// =====================================================
// Helper: Sanitize HTML
// =====================================================

function sanitizeHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// =====================================================
// POST Endpoint - Submit Feedback
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      log.warn(
        { type: "feedback_unauthorized" },
        "Feedback submission without authentication"
      );
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Rate Limiting
    if (!checkRateLimit(user.id)) {
      log.warn(
        { type: "feedback_rate_limited", user_id: user.id },
        "Feedback submission rate limit exceeded"
      );
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: "Too many feedback submissions. Please try again later.",
        },
        { status: 429 }
      );
    }

    // 3. Parse and Validate Request
    const body = await request.json().catch(() => null);
    const parsed = FeedbackSubmitSchema.safeParse(body);

    if (!parsed.success) {
      log.warn(
        {
          type: "feedback_invalid_request",
          errors: parsed.error.errors,
          user_id: user.id,
        },
        "Invalid feedback request"
      );
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.errors },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // 4. Validate required fields based on type
    if (data.type === "rating" && !data.rating) {
      return NextResponse.json(
        { error: "invalid_request", message: "Rating is required for rating type" },
        { status: 422 }
      );
    }

    if (data.type !== "rating" && !data.message && !data.title) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "Either title or message is required",
        },
        { status: 422 }
      );
    }

    // 5. Sanitize input
    const sanitizedTitle = data.title ? sanitizeHtml(data.title) : null;
    const sanitizedMessage = data.message ? sanitizeHtml(data.message) : null;

    // 6. Get user metadata
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // 7. Prepare metadata
    const metadata: Record<string, any> = {
      ...(data.metadata || {}),
    };

    if (data.includeContext) {
      metadata.userAgent = request.headers.get("user-agent") || undefined;
      metadata.timestamp = new Date().toISOString();
    }

    // 8. Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_plan: profile?.plan_name || "free",
        type: data.type,
        title: sanitizedTitle,
        message: sanitizedMessage,
        rating: data.rating,
        impact: data.impact,
        page_url: data.pageUrl,
        app_section: data.appSection,
        metadata,
        screenshot_url: data.screenshotUrl,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      log.error(
        {
          type: "feedback_insert_failed",
          user_id: user.id,
          error: insertError.message,
        },
        "Failed to insert feedback"
      );

      Sentry.captureException(insertError, {
        tags: {
          feature: "feedback",
          component: "submit-endpoint",
        },
      });

      return NextResponse.json(
        { error: "submission_failed", message: "Failed to submit feedback" },
        { status: 500 }
      );
    }

    // 9. Log success
    log.info(
      {
        type: "feedback_submitted",
        user_id: user.id,
        feedback_id: feedback.id,
        feedback_type: data.type,
        impact: data.impact,
      },
      "Feedback submitted successfully"
    );

    // Return success
    return NextResponse.json(
      {
        ok: true,
        id: feedback.id,
        message: "Feedback submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    log.error(
      {
        type: "feedback_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Feedback submission failed"
    );

    Sentry.captureException(error, {
      tags: {
        feature: "feedback",
        component: "submit-endpoint",
      },
    });

    return NextResponse.json(
      {
        error: "submission_failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
