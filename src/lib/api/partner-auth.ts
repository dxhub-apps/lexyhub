import { createHash } from "crypto";

import { env } from "../env";
import { getSupabaseServerClient } from "../supabase-server";

export type PartnerContext = {
  apiKeyId: string | null;
  userId: string | null;
  name: string;
  rateLimitPerMinute: number;
  source: "supabase" | "static";
};

const DEFAULT_RATE_LIMIT = 120;

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function parseStaticKeys(): PartnerContext[] {
  const raw = env.PARTNER_API_STATIC_KEYS;
  if (!raw) {
    return [];
  }

  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, name, limit] = entry.split(":");
      return {
        apiKeyId: hashKey(key ?? ""),
        userId: null,
        name: name ?? "static-partner",
        rateLimitPerMinute: limit ? Number(limit) : DEFAULT_RATE_LIMIT,
        source: "static" as const,
      } satisfies PartnerContext;
    });
}

export async function authenticatePartnerKey(providedKey: string | null): Promise<PartnerContext | null> {
  if (!providedKey) {
    return null;
  }

  const hashed = hashKey(providedKey);
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, user_id, name, status, metadata")
      .eq("hashed_key", hashed)
      .maybeSingle();

    if (error) {
      console.warn("Partner key lookup failed", error);
    }

    if (data && data.status === "active") {
      const metadata = (data.metadata ?? {}) as { rateLimitPerMinute?: number };
      return {
        apiKeyId: data.id,
        userId: data.user_id,
        name: data.name,
        rateLimitPerMinute: metadata.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT,
        source: "supabase",
      } satisfies PartnerContext;
    }
  }

  const staticKey = parseStaticKeys().find((entry) => entry.apiKeyId === hashed);
  if (staticKey) {
    return staticKey;
  }

  return null;
}

export async function checkPartnerRateLimit(context: PartnerContext): Promise<boolean> {
  if (context.source === "static") {
    return true;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase || !context.apiKeyId) {
    return true;
  }

  const windowStart = new Date(Date.now() - 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", context.apiKeyId)
    .gte("requested_at", windowStart);

  if (error) {
    console.warn("Failed to compute partner rate limit", error);
    return true;
  }

  return (count ?? 0) < context.rateLimitPerMinute;
}

export async function recordPartnerRequest(
  context: PartnerContext,
  route: string,
  method: string,
  statusCode: number,
  latencyMs: number,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const payload = {
    api_key_id: context.apiKeyId,
    user_id: context.userId,
    route,
    method,
    status_code: statusCode,
    latency_ms: Math.round(latencyMs),
  };

  const { error } = await supabase.from("api_request_logs").insert(payload);
  if (error) {
    console.warn("Failed to insert api_request_logs row", error);
  }

  if (context.userId) {
    const { error: usageError } = await supabase.from("usage_events").insert({
      user_id: context.userId,
      event_type: "partner_api_request",
      amount: 1,
      source: "partner-api",
    });

    if (usageError) {
      console.warn("Failed to record partner usage", usageError);
    }
  }
}
