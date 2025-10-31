import { NextRequest, NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

import { verifyToken } from "@/lib/tokens";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice("Bearer ".length);
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const [providersResult, accountsResult] = await Promise.all([
    supabase
      .from("data_providers")
      .select("id, display_name, provider_type, is_enabled"),
    supabase
      .from("marketplace_accounts")
      .select("provider_id", { count: "exact" }),
  ]);

  if (providersResult.error) {
    return NextResponse.json(
      { error: `Unable to load providers: ${providersResult.error.message}` },
      { status: 500 },
    );
  }

  if (accountsResult.error) {
    return NextResponse.json(
      { error: `Unable to load marketplace accounts: ${accountsResult.error.message}` },
      { status: 500 },
    );
  }

  const accountsByProvider = new Map<string, number>();
  if (Array.isArray(accountsResult.data)) {
    for (const row of accountsResult.data as Array<{ provider_id: string }>) {
      const providerId = row.provider_id ?? "unknown";
      accountsByProvider.set(providerId, (accountsByProvider.get(providerId) ?? 0) + 1);
    }
  }

  const apps = (providersResult.data ?? []).map((provider) => ({
    id: provider.id,
    name: provider.display_name ?? provider.id,
    type: provider.provider_type ?? "marketplace",
    enabled: Boolean(provider.is_enabled),
    connectedAccounts: accountsByProvider.get(provider.id) ?? 0,
  }));

  await track("apps.listed", {
    actor: payload.sub ?? "anonymous",
    count: apps.length,
  });

  return NextResponse.json({ apps }, { status: 200 });
}
