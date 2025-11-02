import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resolvePlanContext } from "@/lib/usage/quotas";

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  const searchUserId = new URL(req.url).searchParams.get("userId");
  return searchUserId;
}

export async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "userId header or query parameter is required" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const plan = await resolvePlanContext(userId);

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
