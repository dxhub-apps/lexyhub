import { getSupabaseServerClient } from "@/lib/supabase-server";

export type Affiliate = {
  id: string;
  code: string;
  status: "active" | "paused" | "banned";
  base_rate: number;
  lifetime: boolean;
  recur_months: number;
  cookie_days: number;
  min_payout_cents: number;
};

export type AffiliateClick = {
  affiliate_id: string;
  ref_code: string;
  landing_path: string;
  utm: Record<string, unknown>;
  ip: string;
  ua: string;
};

export type AffiliateReferral = {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  ref_code: string;
  attributed_at: string;
  expires_at: string | null;
};

export type Commission = {
  affiliate_id: string;
  referral_id: string;
  stripe_invoice_id: string;
  event_ts: Date;
  basis_cents: number;
  rate: number;
  amount_cents: number;
  reason: string;
};

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch affiliate by code", error);
    return null;
  }

  return data as Affiliate | null;
}

export async function getAffiliate(id: string): Promise<Affiliate | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch affiliate", error);
    return null;
  }

  return data as Affiliate | null;
}

export async function insertAffiliateClick(click: AffiliateClick): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("affiliate_clicks").insert({
    affiliate_id: click.affiliate_id,
    ref_code: click.ref_code,
    landing_path: click.landing_path,
    utm: click.utm,
    ip: click.ip,
    ua: click.ua,
  });

  if (error) {
    console.warn("Failed to insert affiliate click", error);
  }
}

export async function createReferral(params: {
  affiliate_id: string;
  referred_user_id: string;
  ref_code: string;
  expires_at: Date | null;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("affiliate_referrals").insert({
    affiliate_id: params.affiliate_id,
    referred_user_id: params.referred_user_id,
    ref_code: params.ref_code,
    expires_at: params.expires_at ? params.expires_at.toISOString() : null,
  });

  if (error) {
    // If unique constraint violation (user already referred), silently ignore
    if (error.code === "23505") {
      return;
    }
    console.warn("Failed to create referral", error);
  }
}

export async function getReferralByUser(userId: string): Promise<AffiliateReferral | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("affiliate_referrals")
    .select("*")
    .eq("referred_user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch referral by user", error);
    return null;
  }

  return data as AffiliateReferral | null;
}

export async function getSubscription(
  subscriptionId: string,
): Promise<{ user_id: string; plan: string } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("user_id, plan")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch subscription", error);
    return null;
  }

  return data as { user_id: string; plan: string } | null;
}

export async function insertCommission(commission: Commission): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("commissions").insert({
    affiliate_id: commission.affiliate_id,
    referral_id: commission.referral_id,
    stripe_invoice_id: commission.stripe_invoice_id,
    event_ts: commission.event_ts.toISOString(),
    basis_cents: commission.basis_cents,
    rate: commission.rate,
    amount_cents: commission.amount_cents,
    reason: commission.reason,
    status: "pending",
  });

  if (error) {
    // If duplicate invoice (idempotency), silently ignore
    if (error.code === "23505") {
      return;
    }
    console.error("Failed to insert commission", error);
  }
}
