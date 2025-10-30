import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { buildChatMessages, buildPromptTrace, VISUAL_TAG_PROMPT } from "@/lib/ai/prompts";
import type { PromptTrace, VisualTagPromptInput } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { assertQuota, QuotaError, recordUsage } from "@/lib/usage/quotas";

interface VisualTagRequest {
  imageBase64: string;
  filename?: string;
  listingId?: string;
  keywordHints?: string[];
  market?: string;
}

interface VisualTagResponse {
  caption: string;
  tags: Array<{ tag: string; confidence: number }>;
  assetPath?: string;
  trace: PromptTrace<VisualTagPromptInput>;
}

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

function parseBase64Image(imageBase64: string): {
  data: Buffer;
  mimeType: string;
} {
  const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    return { data: Buffer.from(imageBase64, "base64"), mimeType: "image/jpeg" };
  }
  return { data: Buffer.from(match[2], "base64"), mimeType: match[1] };
}

function generateCaption(hints?: string[]): string {
  if (!hints?.length) {
    return "Product photo captured via deterministic BLIP-2 stub analysis.";
  }
  return `BLIP-2 fallback detected motifs: ${hints.join(", ")}.`;
}

function generateTagsFromCaption(
  caption: string,
  hints?: string[],
): Array<{ tag: string; confidence: number }> {
  const tokens = caption
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  const pool = new Set(tokens.concat(hints ?? []));
  const tags: Array<{ tag: string; confidence: number }> = [];
  let multiplier = 0.85;

  for (const token of pool) {
    if (!token || token.length < 3) {
      continue;
    }
    const normalized = token.replace(/\s+/g, "-");
    tags.push({ tag: normalized, confidence: Math.min(0.95, multiplier) });
    multiplier = Math.max(0.4, multiplier - 0.1);
  }

  return tags.slice(0, 6);
}

async function uploadAsset(
  userId: string,
  listingId: string | undefined,
  filename: string | undefined,
  body: Buffer,
  mimeType: string,
): Promise<string | undefined> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return undefined;
  }

  const path = `listings/${listingId ?? "unassigned"}/${randomUUID()}-${filename ?? "asset"}`;
  const { error: storageError } = await supabase.storage
    .from("assets")
    .upload(path, body, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageError && storageError.message?.includes("exists")) {
    const retryPath = `listings/${listingId ?? "unassigned"}/${randomUUID()}-${filename ?? "asset"}`;
    const retry = await supabase.storage.from("assets").upload(retryPath, body, {
      contentType: mimeType,
      upsert: false,
    });
    if (!retry.error) {
      await persistAssetRecord(userId, listingId, retryPath, mimeType, body.length);
      return retryPath;
    }
    console.warn("Supabase storage upload failed", retry.error);
    return undefined;
  }

  if (storageError) {
    console.warn("Supabase storage upload failed", storageError);
    return undefined;
  }

  await persistAssetRecord(userId, listingId, path, mimeType, body.length);
  return path;
}

async function persistAssetRecord(
  userId: string,
  listingId: string | undefined,
  path: string,
  mimeType: string,
  size: number,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("asset_uploads").insert({
    user_id: userId,
    listing_id: listingId ?? null,
    bucket: "assets",
    path,
    mime_type: mimeType,
    size_bytes: size,
    status: "stored",
  });

  if (error) {
    console.warn("Failed to persist asset_uploads row", error);
  }
}

function buildVisualPromptTrace(
  caption: string,
  payload: VisualTagRequest,
): PromptTrace<VisualTagPromptInput> {
  const input: VisualTagPromptInput = {
    caption,
    keywordHints: payload.keywordHints,
    market: payload.market,
  };
  return buildPromptTrace(VISUAL_TAG_PROMPT, input);
}

async function callOpenAIForVisualTags(
  caption: string,
  payload: VisualTagRequest,
): Promise<Array<{ tag: string; confidence: number }>> {
  if (!env.OPENAI_API_KEY) {
    return [];
  }

  try {
    const messages = buildChatMessages(VISUAL_TAG_PROMPT, {
      caption,
      keywordHints: payload.keywordHints,
      market: payload.market,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI visual tag request failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return [];
    }

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return [];
    }

    const parsed = JSON.parse(match[0]) as {
      tags?: Array<{ tag?: string; confidence?: number }>;
    };

    return (
      parsed.tags?.map((item) => ({
        tag: item.tag ?? "",
        confidence: typeof item.confidence === "number" ? item.confidence : 0.6,
      })) ?? []
    ).filter((item) => item.tag.length > 0);
  } catch (error) {
    console.error("OpenAI visual tag enrichment failed", error);
    return [];
  }
}

async function persistSuggestion(
  userId: string,
  request: VisualTagRequest,
  response: VisualTagResponse,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { data: prediction, error: predictionError } = await supabase
    .from("ai_predictions")
    .insert({
      listing_id: request.listingId ?? null,
      user_id: userId,
      scenario_input: request,
      result: {
        caption: response.caption,
        tags: response.tags,
      },
      model: response.tags.length ? "visual-fallback" : "visual-fallback-empty",
      prompt_version: VISUAL_TAG_PROMPT.version,
      method: "visual-tag-ai",
    })
    .select("id")
    .maybeSingle();

  if (predictionError) {
    console.warn("Failed to insert visual prediction", predictionError);
  }

  const { error: suggestionError } = await supabase.from("ai_suggestions").insert({
    ai_prediction_id: prediction?.id ?? null,
    user_id: userId,
    listing_id: request.listingId ?? null,
    suggestion_type: "visual-tag",
    payload: { tags: response.tags, caption: response.caption, asset_path: response.assetPath },
    reasoning: response.caption,
    confidence: response.tags[0]?.confidence ?? 0.5,
    model: "visual-fallback",
    prompt_version: VISUAL_TAG_PROMPT.version,
    extras: { keywordHints: request.keywordHints },
  });

  if (suggestionError) {
    console.warn("Failed to persist visual suggestion", suggestionError);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);
  const payload = (await req.json().catch(() => ({}))) as VisualTagRequest;

  if (!payload.imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  try {
    await assertQuota(userId, "ai_suggestion");
  } catch (error) {
    if (error instanceof QuotaError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const parsed = parseBase64Image(payload.imageBase64);
  const caption = generateCaption(payload.keywordHints);
  const fallbackTags = generateTagsFromCaption(caption, payload.keywordHints);
  const aiTags = await callOpenAIForVisualTags(caption, payload);
  const mergedTags = aiTags.length
    ? aiTags
    : fallbackTags;
  const assetPath = await uploadAsset(
    userId,
    payload.listingId,
    payload.filename,
    parsed.data,
    parsed.mimeType,
  );

  const trace = buildVisualPromptTrace(caption, payload);
  const response: VisualTagResponse = {
    caption,
    tags: mergedTags,
    assetPath,
    trace,
  };

  await persistSuggestion(userId, payload, response);
  await recordUsage(userId, "ai_suggestion", 1, {
    listing_id: payload.listingId,
    asset_path: assetPath,
  });

  return NextResponse.json(response satisfies VisualTagResponse);
}
