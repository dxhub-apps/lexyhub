import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * GET /api/lexybrain/rag/threads
 * Fetch user's recent RAG conversation threads
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user's threads, most recent first
    const { data: threads, error: threadsError } = await supabase
      .from("rag_threads")
      .select("id, title, created_at, updated_at, last_message_at, message_count")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("last_message_at", { ascending: false })
      .limit(10);

    if (threadsError) {
      console.error("[rag/threads] Failed to fetch threads:", threadsError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      threads: threads || [],
    });
  } catch (error: any) {
    console.error("[rag/threads] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
