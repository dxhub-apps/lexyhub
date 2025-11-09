/**
 * Ask LexyBrain RAG - Thread Manager
 *
 * Manages conversation threads and messages
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import type {
  RagThread,
  RagMessage,
  RagFlags,
  GenerationMetadata,
  RetrievedSource,
} from "./types";

// =====================================================
// Thread Management
// =====================================================

/**
 * Get or create a thread
 */
export async function ensureThread(
  userId: string,
  threadId?: string | null
): Promise<RagThread> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  // If threadId provided, fetch existing thread
  if (threadId) {
    const { data: thread, error } = await supabase
      .from("rag_threads")
      .select("*")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logger.error(
        { type: "rag_thread_fetch_error", thread_id: threadId, error: error.message },
        "Failed to fetch thread"
      );
      throw new Error(`Failed to fetch thread: ${error.message}`);
    }

    if (!thread) {
      logger.warn(
        { type: "rag_thread_not_found", thread_id: threadId, user_id: userId },
        "Thread not found"
      );
      throw new Error(`Thread ${threadId} not found or access denied`);
    }

    return thread as RagThread;
  }

  // Create new thread
  const { data: newThread, error: createError } = await supabase
    .from("rag_threads")
    .insert({
      user_id: userId,
      title: null, // Will be set from first message
      metadata: {},
    })
    .select()
    .single();

  if (createError) {
    logger.error(
      { type: "rag_thread_create_error", user_id: userId, error: createError.message },
      "Failed to create thread"
    );
    throw new Error(`Failed to create thread: ${createError.message}`);
  }

  logger.info(
    { type: "rag_thread_created", thread_id: newThread.id, user_id: userId },
    "New thread created"
  );

  return newThread as RagThread;
}

/**
 * Update thread title from first message
 */
export async function updateThreadTitle(
  threadId: string,
  title: string
): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  // Truncate to reasonable length
  const truncated = title.slice(0, 100);

  await supabase
    .from("rag_threads")
    .update({ title: truncated })
    .eq("id", threadId);

  logger.debug(
    { type: "rag_thread_title_updated", thread_id: threadId, title: truncated },
    "Thread title updated"
  );
}

/**
 * Update thread stats (message count, last message time)
 */
export async function updateThreadStats(threadId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data: messages } = await supabase
    .from("rag_messages")
    .select("id, created_at")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const messageCount = messages?.length || 0;
  const lastMessageAt = messages?.[0]?.created_at || new Date().toISOString();

  await supabase
    .from("rag_threads")
    .update({
      message_count: messageCount,
      last_message_at: lastMessageAt,
    })
    .eq("id", threadId);
}

/**
 * Archive a thread (soft delete)
 */
export async function archiveThread(threadId: string, userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { error } = await supabase
    .from("rag_threads")
    .update({ archived: true })
    .eq("id", threadId)
    .eq("user_id", userId);

  if (error) {
    logger.error(
      { type: "rag_thread_archive_error", thread_id: threadId, error: error.message },
      "Failed to archive thread"
    );
    throw new Error(`Failed to archive thread: ${error.message}`);
  }

  logger.info(
    { type: "rag_thread_archived", thread_id: threadId, user_id: userId },
    "Thread archived"
  );
}

// =====================================================
// Message Management
// =====================================================

/**
 * Insert user message
 */
export async function insertUserMessage(params: {
  threadId: string;
  content: string;
  capability: string | null;
  contextJson: Record<string, unknown> | null;
}): Promise<RagMessage> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data: message, error } = await supabase
    .from("rag_messages")
    .insert({
      thread_id: params.threadId,
      role: "user",
      content: params.content,
      capability: params.capability,
      context_json: params.contextJson,
      training_eligible: false,
    })
    .select()
    .single();

  if (error) {
    logger.error(
      {
        type: "rag_user_message_insert_error",
        thread_id: params.threadId,
        error: error.message,
      },
      "Failed to insert user message"
    );
    throw new Error(`Failed to insert user message: ${error.message}`);
  }

  logger.debug(
    {
      type: "rag_user_message_inserted",
      thread_id: params.threadId,
      message_id: message.id,
    },
    "User message inserted"
  );

  return message as RagMessage;
}

/**
 * Insert assistant message
 */
export async function insertAssistantMessage(params: {
  threadId: string;
  content: string;
  modelId: string;
  retrievedSourceIds: RetrievedSource[];
  generationMetadata: GenerationMetadata;
  flags: RagFlags;
  trainingEligible: boolean;
}): Promise<RagMessage> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data: message, error } = await supabase
    .from("rag_messages")
    .insert({
      thread_id: params.threadId,
      role: "assistant",
      content: params.content,
      model_id: params.modelId,
      retrieved_source_ids: params.retrievedSourceIds,
      generation_metadata: params.generationMetadata,
      flags: params.flags,
      training_eligible: params.trainingEligible,
    })
    .select()
    .single();

  if (error) {
    logger.error(
      {
        type: "rag_assistant_message_insert_error",
        thread_id: params.threadId,
        error: error.message,
      },
      "Failed to insert assistant message"
    );
    throw new Error(`Failed to insert assistant message: ${error.message}`);
  }

  logger.debug(
    {
      type: "rag_assistant_message_inserted",
      thread_id: params.threadId,
      message_id: message.id,
    },
    "Assistant message inserted"
  );

  return message as RagMessage;
}

/**
 * Load conversation history (last N messages)
 */
export async function loadThreadHistory(
  threadId: string,
  maxMessages: number = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { data: messages, error } = await supabase
    .from("rag_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(maxMessages);

  if (error) {
    logger.error(
      {
        type: "rag_history_load_error",
        thread_id: threadId,
        error: error.message,
      },
      "Failed to load thread history"
    );
    return [];
  }

  // Reverse to get chronological order
  return (messages || []).reverse() as Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

/**
 * Soft delete a message
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const { error } = await supabase
    .from("rag_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    logger.error(
      { type: "rag_message_delete_error", message_id: messageId, error: error.message },
      "Failed to delete message"
    );
    throw new Error(`Failed to delete message: ${error.message}`);
  }

  logger.debug(
    { type: "rag_message_deleted", message_id: messageId },
    "Message soft deleted"
  );
}
