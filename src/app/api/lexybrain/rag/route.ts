/**
 * Ask LexyBrain RAG Endpoint
 *
 * POST /api/lexybrain/rag
 *
 * Main orchestrator for RAG-powered chat interactions
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { lexybrainGenerate } from "@/lib/lexybrain";
import { consumeLexyBrainQuota, LexyBrainQuotaExceededError } from "@/lib/lexybrain-quota";

import {
  RagRequestSchema,
  type RagResponse,
  type RagSource,
  type RagReferences,
} from "@/lib/rag/types";
import { ensureThread, updateThreadTitle, insertUserMessage, insertAssistantMessage, loadThreadHistory } from "@/lib/rag/thread-manager";
import { detectCapabilityHeuristic } from "@/lib/rag/capability-detector";
import { retrieveContext, rerank, fetchFullContext } from "@/lib/rag/retrieval";
import { buildRagPrompt, estimateTokens } from "@/lib/rag/prompt-builder";
import { collectTrainingData, checkTrainingEligibility } from "@/lib/rag/training-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for Vercel

// =====================================================
// Main Endpoint Handler
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let userId: string | null = null;
  let threadId: string | null = null;

  try {
    // ============================================
    // Step 1: Authentication & Validation
    // ============================================

    // Authenticate user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn({ type: "rag_unauthorized" }, "RAG request without authentication");
      return NextResponse.json(
        { error: { code: "authentication_required", message: "Please sign in to use Ask LexyBrain" } },
        { status: 401 }
      );
    }

    userId = user.id;

    // Parse and validate request
    const body = await request.json().catch(() => null);
    const parsed = RagRequestSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn(
        { type: "rag_invalid_request", errors: parsed.error.errors },
        "Invalid RAG request"
      );
      return NextResponse.json(
        { error: { code: "validation_error", message: parsed.error.errors[0]?.message || "Invalid request" } },
        { status: 422 }
      );
    }

    const requestData = parsed.data;

    logger.info(
      {
        type: "rag_request_start",
        user_id: userId,
        thread_id: requestData.threadId,
        message_length: requestData.message.length,
      },
      "RAG request received"
    );

    // ============================================
    // Step 2: Quota Enforcement
    // ============================================

    try {
      await consumeLexyBrainQuota(userId, "rag_messages", 1);
    } catch (error) {
      if (error instanceof LexyBrainQuotaExceededError) {
        logger.warn(
          {
            type: "rag_quota_exceeded",
            user_id: userId,
            used: error.used,
            limit: error.limit,
          },
          "RAG quota exceeded"
        );

        return NextResponse.json(
          {
            error: {
              code: "quota_exceeded",
              message: error.message,
              retryable: false,
            },
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // ============================================
    // Step 3: Thread & Message Persistence (User)
    // ============================================

    const thread = await ensureThread(userId, requestData.threadId);
    threadId = thread.id;

    const userMessage = await insertUserMessage({
      threadId: thread.id,
      content: requestData.message,
      capability: requestData.capability || null,
      contextJson: requestData.context || null,
    });

    // Set thread title from first message
    if (thread.message_count === 0 && !thread.title) {
      const title = requestData.message.slice(0, 100);
      await updateThreadTitle(thread.id, title);
    }

    // ============================================
    // Step 4: Capability Detection
    // ============================================

    const capability = requestData.capability || detectCapabilityHeuristic(requestData.message);

    logger.debug(
      { type: "rag_capability_detected", capability, user_id: userId },
      "Capability detected"
    );

    // ============================================
    // Step 5: Retrieval
    // ============================================

    const retrievalStart = Date.now();

    const { vectorResults, structuredKeywords } = await fetchFullContext({
      query: requestData.message,
      userId,
      capability,
      market: requestData.context?.marketplaces?.[0] || null,
      timeRangeFrom: requestData.context?.timeRange?.from || null,
      timeRangeTo: requestData.context?.timeRange?.to || null,
      keywordIds: requestData.context?.keywordIds,
      topK: 40,
    });

    // Rerank to top 12
    const rankedSources = rerank(vectorResults, 12);

    const retrievalLatency = Date.now() - retrievalStart;

    logger.info(
      {
        type: "rag_retrieval_complete",
        user_id: userId,
        sources_count: rankedSources.length,
        latency_ms: retrievalLatency,
      },
      "Retrieval completed"
    );

    // Lower threshold from 5 to 1 to allow partial data responses
    // If we have at least 1 source, we can provide some context
    const insufficientContext = rankedSources.length < 1;

    // ============================================
    // HARD-STOP: Enforce "No Reliable Data" when corpus is completely empty
    // ============================================
    if (insufficientContext) {
      logger.info(
        {
          type: "rag_no_data",
          user_id: userId,
          thread_id: thread.id,
          sources_count: rankedSources.length,
        },
        "No corpus data found - returning hard-stop no-data response"
      );

      // Insert assistant message with "no data" response
      const noDataMessage = "No reliable data for this query in LexyHub at the moment.";

      const assistantMessage = await insertAssistantMessage({
        threadId: thread.id,
        content: noDataMessage,
        modelId: "n/a",
        retrievedSourceIds: [],
        generationMetadata: {
          tokens_in: 0,
          tokens_out: 0,
          latencyMs: Date.now() - startTime,
          temperature: 0,
        },
        flags: {
          usedRag: false,
          fallbackToGeneric: false,
          insufficientContext: true,
        },
        trainingEligible: false,
      });

      return NextResponse.json({
        threadId: thread.id,
        messageId: assistantMessage.id,
        answer: noDataMessage,
        capability,
        sources: [],
        references: { keywords: [], listings: [], alerts: [], docs: [] },
        model: {
          id: "n/a",
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: Date.now() - startTime,
        },
        flags: {
          usedRag: false,
          fallbackToGeneric: false,
          insufficientContext: true,
        },
      });
    }

    // Log warning if we have limited context (1-4 sources)
    if (rankedSources.length < 5) {
      logger.warn(
        {
          type: "rag_limited_context",
          user_id: userId,
          thread_id: thread.id,
          sources_count: rankedSources.length,
        },
        "Limited corpus data available - proceeding with partial context"
      );
    }

    // ============================================
    // Step 6: Prompt Construction
    // ============================================

    // Load conversation history (last 10 messages)
    const conversationHistory = await loadThreadHistory(thread.id, 10);

    const prompt = await buildRagPrompt({
      capability,
      retrievedContext: rankedSources,
      conversationHistory,
      userMessage: requestData.message,
    });

    const promptTokens = estimateTokens(prompt);

    logger.debug(
      {
        type: "rag_prompt_built",
        user_id: userId,
        prompt_tokens: promptTokens,
      },
      "Prompt constructed"
    );

    // ============================================
    // Step 7: LLM Generation
    // ============================================

    const generationStart = Date.now();

    let generatedText = "";
    let modelId = process.env.LEXYBRAIN_RAG_MODEL_ID || process.env.LEXYBRAIN_MODEL_ID || "unknown";
    let generationLatency = 0;
    let fallbackToGeneric = false;

    try {
      // Use existing LexyBrain client
      const response = await lexybrainGenerate({
        prompt,
        max_tokens: requestData.options?.maxTokens || 1024,
        temperature: requestData.options?.temperature || 0.7,
      });

      generatedText = response.completion;
      modelId = response.model;
      generationLatency = Date.now() - generationStart;

      if (!generatedText) {
        throw new Error("Empty response from LLM");
      }
    } catch (error) {
      generationLatency = Date.now() - generationStart;
      logger.error(
        {
          type: "rag_generation_error",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
          latency_ms: generationLatency,
        },
        "LLM generation failed, using fallback"
      );

      // Fallback response
      fallbackToGeneric = true;
      generatedText = `I encountered an issue generating a response. Based on the retrieved data:\n\n${rankedSources.slice(0, 3).map((s, i) => `${i + 1}. ${s.source_label} (${s.source_type})`).join("\n")}\n\nPlease try rephrasing your question or check back later.`;
    }

    logger.info(
      {
        type: "rag_generation_complete",
        user_id: userId,
        latency_ms: generationLatency,
        fallback: fallbackToGeneric,
      },
      "Generation completed"
    );

    // ============================================
    // Step 8: Response Persistence (Assistant)
    // ============================================

    const trainingEligible = await checkTrainingEligibility(userId);

    const assistantMessage = await insertAssistantMessage({
      threadId: thread.id,
      content: generatedText,
      modelId: modelId,
      retrievedSourceIds: rankedSources.map((s) => ({
        id: s.source_id,
        type: s.source_type,
        score: s.similarity_score,
      })),
      generationMetadata: {
        tokens_in: promptTokens,
        tokens_out: estimateTokens(generatedText),
        latencyMs: generationLatency,
        temperature: requestData.options?.temperature || 0.7,
      },
      flags: {
        usedRag: rankedSources.length > 0,
        fallbackToGeneric,
        insufficientContext,
      },
      trainingEligible,
    });

    // ============================================
    // Step 9: Training Data Collection (async)
    // ============================================

    if (trainingEligible) {
      collectTrainingData({
        userId,
        messageId: assistantMessage.id,
        prompt,
        response: generatedText,
        sources: rankedSources,
        capability,
        market: requestData.context?.marketplaces?.[0] || null,
        nicheTerms: [], // Could extract from context
      }).catch((err) => {
        logger.warn(
          { type: "training_collection_failed", error: err.message },
          "Training data collection failed"
        );
      });
    }

    // ============================================
    // Step 10: Build Response
    // ============================================

    const sources: RagSource[] = rankedSources.map((s) => ({
      id: s.source_id,
      type: s.source_type as "keyword" | "listing" | "alert" | "doc",
      label: s.source_label,
      score: s.similarity_score,
    }));

    const references: RagReferences = {
      keywords: rankedSources.filter((s) => s.source_type === "keyword").map((s) => s.source_id),
      listings: rankedSources.filter((s) => s.source_type === "listing").map((s) => s.source_id),
      alerts: rankedSources.filter((s) => s.source_type === "alert").map((s) => s.source_id),
      docs: rankedSources.filter((s) => s.source_type === "doc").map((s) => s.source_id),
    };

    const totalLatency = Date.now() - startTime;

    const response: RagResponse = {
      threadId: thread.id,
      messageId: assistantMessage.id,
      answer: generatedText,
      capability,
      sources,
      references,
      model: {
        id: modelId,
        usage: {
          inputTokens: promptTokens,
          outputTokens: estimateTokens(generatedText),
        },
        latencyMs: generationLatency,
      },
      flags: {
        usedRag: rankedSources.length > 0,
        fallbackToGeneric,
        insufficientContext,
      },
    };

    logger.info(
      {
        type: "rag_request_complete",
        user_id: userId,
        thread_id: thread.id,
        message_id: assistantMessage.id,
        total_latency_ms: totalLatency,
        retrieval_latency_ms: retrievalLatency,
        generation_latency_ms: generationLatency,
      },
      "RAG request completed successfully"
    );

    return NextResponse.json(response);
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    logger.error(
      {
        type: "rag_request_error",
        user_id: userId,
        thread_id: threadId,
        latency_ms: totalLatency,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "RAG request failed"
    );

    // Capture in Sentry
    Sentry.captureException(error, {
      tags: {
        feature: "rag",
        component: "rag-endpoint",
      },
      extra: {
        user_id: userId,
        thread_id: threadId,
        latency_ms: totalLatency,
      },
    });

    return NextResponse.json(
      {
        error: {
          code: "generation_failed",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
