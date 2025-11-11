import type { User } from "@supabase/supabase-js";

import { fetchUserPlan, shouldElevateToAdmin } from "@/lib/auth/admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const ADMIN_PLAN = "admin";
const DEFAULT_PLAN = "free";
const UNLIMITED_QUOTA = 2147483647;

export async function ensureAdminProfile(user: User): Promise<{ plan: string | null }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("Supabase service client unavailable; unable to ensure admin profile.");
    return { plan: null };
  }

  // First ensure the profile exists using RPC function
  if (!user.id) {
    console.warn("User ID is missing; unable to ensure profile.");
    return { plan: null };
  }

  // Call RPC to ensure profile exists before fetching
  // Explicitly pass both parameters to avoid function overloading ambiguity
  const { error: rpcError } = await supabase.rpc('ensure_user_profile', {
    p_user_id: user.id,
    p_signup_source: 'web'
  });
  if (rpcError) {
    console.error("Failed to ensure user profile via RPC:", rpcError);
  }

  const { plan: existingPlan, momentum, quota } = await fetchUserPlan(supabase, user.id);

  const elevateToAdmin = shouldElevateToAdmin(user, existingPlan);
  const nextPlan = elevateToAdmin ? ADMIN_PLAN : existingPlan ?? DEFAULT_PLAN;
  const nextMomentum = momentum ?? "active";
  const nextQuota = elevateToAdmin ? UNLIMITED_QUOTA : quota ?? 0;

  const requiresUpdate =
    existingPlan == null ||
    existingPlan !== nextPlan ||
    (elevateToAdmin && (quota ?? 0) < UNLIMITED_QUOTA);

  if (requiresUpdate) {
    const payload = {
      user_id: user.id,
      plan: nextPlan,
      momentum: nextMomentum,
      ai_usage_quota: nextQuota,
      updated_at: new Date().toISOString(),
    } as const;

    const { error: upsertError } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to upsert user profile", upsertError);
    }
  }

  return { plan: nextPlan };
}
