import { getSupabaseServerClient } from "../supabase-server";
import { captureException } from "../observability/sentry";

export type PlanTier = "free" | "growth" | "scale";

export type PlanLimits = {
  dailyQueryLimit: number;
  aiSuggestionLimit: number;
  watchlistLimit: number;
  watchlistItemCapacity: number;
};

export type PlanContext = {
  userId: string;
  plan: PlanTier;
  momentum: string;
  limits: PlanLimits;
  momentumMultiplier: number;
};

const DEFAULT_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    dailyQueryLimit: 25,
    aiSuggestionLimit: 10,
    watchlistLimit: 3,
    watchlistItemCapacity: 25,
  },
  growth: {
    dailyQueryLimit: 100,
    aiSuggestionLimit: 60,
    watchlistLimit: 10,
    watchlistItemCapacity: 75,
  },
  scale: {
    dailyQueryLimit: 500,
    aiSuggestionLimit: 250,
    watchlistLimit: 25,
    watchlistItemCapacity: 150,
  },
};

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

export class MissingSupabaseClientError extends Error {
  constructor() {
    super("Supabase client unavailable");
    this.name = "MissingSupabaseClientError";
  }
}

function resolveBasePlan(plan?: string | null): PlanTier {
  if (plan === "growth" || plan === "scale") {
    return plan;
  }
  return "free";
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function fetchOverrides(userId: string): Promise<{
  plan?: PlanTier;
  dailyQueryLimit?: number;
  watchlistLimit?: number;
  watchlistItemCapacity?: number;
  aiSuggestionLimit?: number;
  momentumMultiplier?: number;
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new MissingSupabaseClientError();
  }

  const { data, error } = await supabase
    .from("plan_overrides")
    .select(
      "plan, daily_query_limit, watchlist_limit, watchlist_item_capacity, ai_suggestion_limit, momentum_multiplier"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    captureException(error, {
      tags: { domain: "usage", operation: "fetchOverrides" },
      user: { id: userId },
      level: "warning",
      extra: { code: error.code },
    });
    console.warn("Failed to load plan overrides", error);
    return {};
  }

  const override = data?.[0];
  if (!override) {
    return {};
  }

  return {
    plan: override.plan ? resolveBasePlan(override.plan) : undefined,
    dailyQueryLimit: override.daily_query_limit ?? undefined,
    watchlistLimit: override.watchlist_limit ?? undefined,
    watchlistItemCapacity: override.watchlist_item_capacity ?? undefined,
    aiSuggestionLimit: override.ai_suggestion_limit ?? undefined,
    momentumMultiplier: override.momentum_multiplier ?? undefined,
  };
}

export async function resolvePlanContext(userId: string): Promise<PlanContext> {
  const supabase = getSupabaseServerClient();
  const basePlan: PlanTier = "free";

  if (!supabase) {
    throw new MissingSupabaseClientError();
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan, momentum")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    captureException(error, {
      tags: { domain: "usage", operation: "resolvePlan" },
      user: { id: userId },
      level: "warning",
      extra: { code: error.code },
    });
    console.warn("Unable to fetch user profile for quotas", error);
  }

  const overrides = await fetchOverrides(userId);

  const plan = overrides.plan ?? resolveBasePlan(data?.plan);
  const limits = { ...DEFAULT_LIMITS[plan] };

  if (overrides.dailyQueryLimit) {
    limits.dailyQueryLimit = overrides.dailyQueryLimit;
  }
  if (overrides.watchlistLimit) {
    limits.watchlistLimit = overrides.watchlistLimit;
  }
  if (overrides.watchlistItemCapacity) {
    limits.watchlistItemCapacity = overrides.watchlistItemCapacity;
  }
  if (overrides.aiSuggestionLimit) {
    limits.aiSuggestionLimit = overrides.aiSuggestionLimit;
  }

  return {
    userId,
    plan,
    momentum: data?.momentum ?? "new",
    limits,
    momentumMultiplier: overrides.momentumMultiplier ?? 1,
  };
}

async function sumUsage(
  userId: string,
  eventType: string,
  since: Date,
): Promise<number> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new MissingSupabaseClientError();
  }

  const { data, error } = await supabase
    .from("usage_events")
    .select("amount")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("occurred_at", since.toISOString());

  if (error) {
    captureException(error, {
      tags: { domain: "usage", operation: "sumUsage" },
      user: { id: userId },
      level: "warning",
      extra: { code: error.code, eventType },
    });
    console.warn("Failed to read usage events", error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export async function assertQuota(
  userId: string,
  eventType: "ai_suggestion" | "keyword_query" | "watchlist_add",
  amount: number = 1,
): Promise<PlanContext> {
  const context = await resolvePlanContext(userId);
  const windowStart = startOfToday();

  let limit = Infinity;
  if (eventType === "ai_suggestion") {
    limit = context.limits.aiSuggestionLimit * context.momentumMultiplier;
  } else if (eventType === "keyword_query") {
    limit = context.limits.dailyQueryLimit * context.momentumMultiplier;
  } else if (eventType === "watchlist_add") {
    limit = context.limits.watchlistItemCapacity;
  }

  if (!Number.isFinite(limit)) {
    return context;
  }

  const used = await sumUsage(userId, eventType, windowStart);
  if (used + amount > limit) {
    throw new QuotaError(
      `Quota exceeded for ${eventType}. Used ${used} of ${limit} with request amount ${amount}.`,
    );
  }

  return context;
}

export async function recordUsage(
  userId: string,
  eventType: string,
  amount: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new MissingSupabaseClientError();
  }

  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    amount,
    metadata: metadata ?? {},
  });

  if (error) {
    console.warn("Failed to record usage", error);
  }
}
