import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePlanContext } from "@/lib/usage/quotas";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);
  const supabase = getSupabaseServerClient();
  const plan = await resolvePlanContext(userId);

  if (!supabase) {
    return NextResponse.json({
      plan: plan.plan,
      momentum: plan.momentum,
      limits: plan.limits,
      usage: {
        ai_suggestion: 0,
        keyword_query: 0,
        watchlist_add: 0,
      },
    });
  }

  const { data, error } = await supabase
    .from("usage_events")
    .select("event_type, amount")
    .eq("user_id", userId)
    .gte("occurred_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.warn("Failed to fetch usage summary", error);
  }

  const usage = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const type = row.event_type ?? "unknown";
    acc[type] = (acc[type] ?? 0) + Number(row.amount ?? 0);
    return acc;
  }, {});

  return NextResponse.json({
    plan: plan.plan,
    momentum: plan.momentum,
    limits: plan.limits,
    usage,
  });
}
