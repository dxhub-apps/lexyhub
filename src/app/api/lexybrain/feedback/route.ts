/**
 * LexyBrain Feedback API Endpoint
 *
 * Allows users to submit feedback on LexyBrain responses.
 * This feedback is stored for future model fine-tuning.
 *
 * POST /api/lexybrain/feedback
 * Body: { responseId: string, feedback: 'positive' | 'negative' | 'neutral', notes?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { logLexyBrainFeedback } from "@/lib/lexybrain/trainingLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// Request/Response Types
// =====================================================

const FeedbackRequestSchema = z.object({
  responseId: z.string().uuid(),
  feedback: z.enum(["positive", "negative", "neutral"]),
  notes: z.string().optional(),
});

type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

// =====================================================
// POST Endpoint
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn(
        { type: "lexybrain_feedback_unauthorized" },
        "Feedback submission without authentication"
      );
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Parse and Validate Request
    const body = await request.json().catch(() => null);
    const parsed = FeedbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn(
        {
          type: "lexybrain_feedback_invalid_request",
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

    const { responseId, feedback, notes } = parsed.data;

    logger.debug(
      {
        type: "lexybrain_feedback_request",
        user_id: user.id,
        response_id: responseId,
        feedback,
      },
      "Processing feedback submission"
    );

    // 3. Verify response exists
    const { data: responseData, error: responseError } = await supabase
      .from("lexybrain_responses")
      .select("id, request_id")
      .eq("id", responseId)
      .maybeSingle();

    if (responseError || !responseData) {
      logger.warn(
        {
          type: "lexybrain_feedback_response_not_found",
          user_id: user.id,
          response_id: responseId,
        },
        "Response not found for feedback"
      );
      return NextResponse.json(
        { error: "not_found", message: "Response not found" },
        { status: 404 }
      );
    }

    // 4. Verify ownership by checking the associated request
    const { data: requestData, error: requestError } = await supabase
      .from("lexybrain_requests")
      .select("user_id")
      .eq("id", responseData.request_id)
      .maybeSingle();

    if (requestError) {
      logger.error(
        {
          type: "lexybrain_feedback_request_lookup_failed",
          user_id: user.id,
          request_id: responseData.request_id,
          error: requestError.message,
        },
        "Failed to lookup request for ownership verification"
      );
      return NextResponse.json(
        { error: "verification_failed", message: "Failed to verify response ownership" },
        { status: 500 }
      );
    }

    // Verify ownership (if request has a user_id, it must match)
    if (requestData?.user_id && requestData.user_id !== user.id) {
      logger.warn(
        {
          type: "lexybrain_feedback_forbidden",
          user_id: user.id,
          response_id: responseId,
          owner_id: requestData.user_id,
        },
        "User attempted to submit feedback for another user's response"
      );
      return NextResponse.json(
        { error: "forbidden", message: "Cannot submit feedback for another user's response" },
        { status: 403 }
      );
    }

    // 5. Check for existing feedback from this user
    const { data: existingFeedback } = await supabase
      .from("lexybrain_feedback")
      .select("id")
      .eq("response_id", responseId)
      .eq("user_id", user.id)
      .maybeSingle();

    // 6. Submit or update feedback
    const feedbackId = await logLexyBrainFeedback({
      responseId,
      userId: user.id,
      feedback,
      notes,
    });

    if (!feedbackId) {
      logger.error(
        {
          type: "lexybrain_feedback_failed",
          user_id: user.id,
          response_id: responseId,
        },
        "Failed to log feedback"
      );
      return NextResponse.json(
        { error: "feedback_failed", message: "Failed to submit feedback" },
        { status: 500 }
      );
    }

    logger.info(
      {
        type: "lexybrain_feedback_success",
        user_id: user.id,
        response_id: responseId,
        feedback,
        feedback_id: feedbackId,
        is_update: !!existingFeedback,
      },
      "Feedback submitted successfully"
    );

    return NextResponse.json({
      success: true,
      feedbackId,
      message: existingFeedback
        ? "Feedback updated successfully"
        : "Feedback submitted successfully",
    });
  } catch (error) {
    logger.error(
      {
        type: "lexybrain_feedback_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Feedback submission failed"
    );

    // Capture in Sentry
    Sentry.captureException(error, {
      tags: {
        feature: "lexybrain",
        component: "feedback-endpoint",
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

// =====================================================
// GET Endpoint (Optional - for retrieving feedback)
// =====================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Get responseId from query params
    const { searchParams } = new URL(request.url);
    const responseId = searchParams.get("responseId");

    if (!responseId) {
      return NextResponse.json(
        { error: "invalid_request", message: "responseId is required" },
        { status: 422 }
      );
    }

    // 3. Get feedback for this response (only user's own feedback)
    const { data: feedback, error: feedbackError } = await supabase
      .from("lexybrain_feedback")
      .select("*")
      .eq("response_id", responseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (feedbackError && feedbackError.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine
      logger.error(
        {
          type: "lexybrain_feedback_get_failed",
          user_id: user.id,
          response_id: responseId,
          error: feedbackError.message,
        },
        "Failed to retrieve feedback"
      );
      return NextResponse.json(
        { error: "retrieval_failed", message: feedbackError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feedback: feedback || null,
    });
  } catch (error) {
    logger.error(
      {
        type: "lexybrain_feedback_get_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Feedback retrieval failed"
    );

    Sentry.captureException(error, {
      tags: {
        feature: "lexybrain",
        component: "feedback-endpoint",
      },
    });

    return NextResponse.json(
      {
        error: "retrieval_failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
