import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminUser } from "@/lib/backoffice/auth";
import { getFeatureFlags, invalidateFeatureFlagCache } from "@/lib/feature-flags";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const featureFlagKeys = [
  "require_official_etsy_api",
  "allow_search_sampling",
  "allow_user_telemetry",
] as const;

const updateSchema = z.object({
  key: z.enum(featureFlagKeys),
  is_enabled: z.boolean(),
});

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  const flags = await getFeatureFlags({ supabase });

  return NextResponse.json({ flags });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 422 });
  }

  const { key, is_enabled } = parsed.data;

  const { error } = await supabase
    .from("feature_flags")
    .upsert({ key, is_enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: `Unable to update feature flag: ${error.message}` }, { status: 500 });
  }

  invalidateFeatureFlagCache();
  const flags = await getFeatureFlags({ supabase, forceRefresh: true });

  return NextResponse.json({ flags, flag: { key, is_enabled } });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
