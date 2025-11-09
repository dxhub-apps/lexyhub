import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * GET /api/lexybrain/rag/threads/[threadId]
 * Fetch all messages for a specific thread
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { threadId } = params;

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

    // Verify thread belongs to user
    const { data: thread, error: threadError } = await supabase
      .from("rag_threads")
      .select("id, title, created_at")
      .eq("id", threadId)
      .eq("user_id", user.id)
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    // Fetch messages for this thread
    const { data: messages, error: messagesError } = await supabase
      .from("rag_messages")
      .select("id, role, content, created_at, retrieved_source_ids")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error(`[rag/threads/${threadId}] Failed to fetch messages:`, messagesError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Transform messages to match UI format
    const transformedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      sources: msg.retrieved_source_ids || [],
    }));

    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        created_at: thread.created_at,
      },
      messages: transformedMessages,
    });
  } catch (error: any) {
    console.error("[rag/threads/[threadId]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
