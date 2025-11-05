import { NextResponse } from "next/server";

import { buildChatMessages, buildPromptTrace, TAG_OPTIMIZER_PROMPT } from "@/lib/ai/prompts";
import type { PromptTrace } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { assertQuota, QuotaError, recordUsage } from "@/lib/usage/quotas";

interface TagOptimizerRequest {
  listingId?: string;
  keywordId?: string;
  listingTitle: string;
  currentTags?: string[];
  goals?: string[];
  market?: string;
  attributes?: Record<string, string | number | null | undefined>;
  maxSuggestions?: number;
}

interface TagOptimizerResponse {
  tags: string[];
  reasoning: string;
  confidence: number;
  model: string;
  promptVersion: string;
  trace: PromptTrace<TagOptimizerRequest>;
}

function requireUserId(headers: Headers): string {
  const userId = headers.get("x-user-id");
  if (!userId) {
    throw new Error("Missing x-user-id header");
  }
  return userId;
}

function buildDeterministicTags(request: TagOptimizerRequest): TagOptimizerResponse {
  const titleTokens = request.listingTitle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  const unique = Array.from(new Set(titleTokens));
  const filtered = unique.filter((token) => !(request.currentTags ?? []).includes(token));
  const goals = request.goals ?? [];
  const suggestions = [...filtered, ...goals.map((goal) => goal.toLowerCase())]
    .map((token) => token.replace(/\s+/g, "-"))
    .filter((token) => token.length > 0);

  const max = request.maxSuggestions ?? 6;
  const tags = suggestions.slice(0, max);

  const reasoning =
    tags.length > 0
      ? `Generated deterministically from listing title tokens for market ${request.market ?? "n/a"}.`
      : "Insufficient context to create suggestions; provide more product detail.";

  return {
    tags,
    reasoning,
    confidence: tags.length ? 0.4 : 0.1,
    model: "deterministic-fallback",
    promptVersion: TAG_OPTIMIZER_PROMPT.version,
    trace: buildPromptTrace(TAG_OPTIMIZER_PROMPT, request),
  };
}

function extractJsonCandidate(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch (error) {
    console.warn("Failed to parse JSON from AI response", error);
    return null;
  }
}

async function callOpenAI(
  payload: TagOptimizerRequest,
): Promise<Pick<TagOptimizerResponse, "tags" | "reasoning" | "confidence" | "model"> | null> {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const messages = buildChatMessages(TAG_OPTIMIZER_PROMPT, payload);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI tag optimizer failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response missing content");
    }

    const parsed = extractJsonCandidate(content) as
      | { recommended_tags?: string[]; reasoning?: string; confidence?: number }
      | null;

    const tags = parsed?.recommended_tags?.filter((tag) => typeof tag === "string") ?? [];
    const reasoning = parsed?.reasoning ?? "Model did not provide explicit reasoning.";
    const confidence = typeof parsed?.confidence === "number" ? parsed.confidence : 0.7;

    return {
      tags,
      reasoning,
      confidence,
      model: "gpt-4o-mini",
    };
  } catch (error) {
    console.error("Tag optimizer OpenAI call failed", error);
    return null;
  }
}

async function persistSuggestion(
  userId: string,
  request: TagOptimizerRequest,
  result: TagOptimizerResponse,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { data: prediction, error: predictionError } = await supabase
    .from("ai_predictions")
    .insert({
      listing_id: request.listingId ?? null,
      keyword_id: request.keywordId ?? null,
      user_id: userId,
      scenario_input: request,
      result: {
        recommended_tags: result.tags,
        reasoning: result.reasoning,
        confidence: result.confidence,
      },
      model: result.model,
      prompt_version: result.promptVersion,
      method: "tag-optimizer",
    })
    .select("id")
    .maybeSingle();

  if (predictionError) {
    console.warn("Failed to insert ai_predictions row", predictionError);
  }

  // Task 4: Populate keywords golden source with AI suggestions
  const market = request.market ?? 'us';
  for (const tag of result.tags) {
    try {
      await supabase.rpc('lexy_upsert_keyword', {
        p_term: tag,
        p_market: market,
        p_source: 'ai',
        p_tier: 'free',
        p_method: 'ai_suggestion',
        p_extras: {
          suggested_by: 'tag_optimizer',
          parent_keyword_id: request.keywordId,
          parent_listing_id: request.listingId,
        },
        p_freshness: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to upsert AI suggestion "${tag}" to keywords`, error);
    }
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let userId: string;
  try {
    userId = requireUserId(req.headers);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "userId is required" }, { status: 400 });
  }
  const payload = (await req.json().catch(() => ({}))) as TagOptimizerRequest;

  if (!payload || !payload.listingTitle) {
    return NextResponse.json({ error: "listingTitle is required" }, { status: 400 });
  }

  try {
    await assertQuota(userId, "ai_suggestion");
  } catch (error) {
    if (error instanceof QuotaError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const aiResult = await callOpenAI(payload);
  const base = buildDeterministicTags(payload);
  const result: TagOptimizerResponse = {
    ...base,
    tags: aiResult?.tags?.length ? aiResult.tags : base.tags,
    reasoning: aiResult?.reasoning ?? base.reasoning,
    confidence: aiResult?.confidence ?? base.confidence,
    model: aiResult?.model ?? base.model,
    promptVersion: TAG_OPTIMIZER_PROMPT.version,
    trace: base.trace,
  };

  await persistSuggestion(userId, payload, result);
  await recordUsage(userId, "ai_suggestion", 1, {
    keyword_id: payload.keywordId,
    listing_id: payload.listingId,
    model: result.model,
  });

  return NextResponse.json({
    tags: result.tags,
    reasoning: result.reasoning,
    confidence: result.confidence,
    model: result.model,
    promptVersion: result.promptVersion,
    trace: result.trace,
  } satisfies TagOptimizerResponse);
}
