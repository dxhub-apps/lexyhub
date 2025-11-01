import type { User } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const ADMIN_PLAN = "admin";
const UNLIMITED_QUOTA = 2147483647;

export async function ensureAdminProfile(user: User): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("Supabase service client unavailable; unable to ensure admin profile.");
    return;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("plan, ai_usage_quota")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch user profile", error);
  }

  if (data?.plan === ADMIN_PLAN && data.ai_usage_quota >= UNLIMITED_QUOTA) {
    return;
  }

  const payload = {
    user_id: user.id,
    plan: ADMIN_PLAN,
    momentum: "active",
    ai_usage_quota: UNLIMITED_QUOTA,
  } as const;

  const { error: upsertError } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    console.error("Failed to upsert admin profile", upsertError);
  }
}
