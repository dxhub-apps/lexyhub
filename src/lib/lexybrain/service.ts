// lib/lexybrain/service.ts
"use server";

import { callLexyBrainRunpod, LexyBrainRequest } from "./runpodClient";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// types for app-level response
export type LexyBrainInsight = {
  completion: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function generateLexyBrainInsight(args: {
  userId: string | null;
  prompt: string;
  context?: Record<string, any>;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}): Promise<LexyBrainInsight> {
  const startedAt = Date.now();
  const db = getSupabaseServerClient();

  if (!db) {
    throw new Error("Database client not available");
  }

  // 1) log request
  const { data: requestData, error: requestError } = await db
    .from("lexybrain_requests")
    .insert({
      user_id: args.userId,
      prompt: args.prompt,
      context_json: args.context || {},
    })
    .select("id")
    .single();

  if (requestError || !requestData) {
    throw new Error(`Failed to log request: ${requestError?.message || "Unknown error"}`);
  }

  const requestId = requestData.id;

  // 2) call worker
  let output;
  try {
    const input: LexyBrainRequest = {
      prompt: args.prompt,
      system: args.system,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      top_p: args.topP,
      context: args.context,
    };

    const res = await callLexyBrainRunpod(input);
    output = res;

    const latency = Date.now() - startedAt;

    // 3) log success
    await db.from("lexybrain_responses").insert({
      request_id: requestId,
      model_name: res.model,
      output_json: res,
      generated_at: new Date().toISOString(),
      latency_ms: latency,
      success: true,
    });

    return {
      completion: res.completion,
      model: res.model,
      usage: res.usage,
    };
  } catch (err: any) {
    const latency = Date.now() - startedAt;

    // log failure, minimal info
    await db.from("lexybrain_responses").insert({
      request_id: requestId,
      model_name: "lexybrain-worker",
      output_json: { error: String(err && err.message || err) },
      generated_at: new Date().toISOString(),
      latency_ms: latency,
      success: false,
    });

    throw err;
  }
}
