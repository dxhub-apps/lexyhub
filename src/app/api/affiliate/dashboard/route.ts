import { NextRequest, NextResponse } from "next/server";

import { getAffiliateByUserId } from "@/lib/db/affiliates";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get affiliate dashboard data:
 * - Affiliate details
 * - Total clicks, referrals, commissions
 * - Recent referrals with status
 * - Commission history
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    // Get affiliate record for this user
    const affiliate = await getAffiliateByUserId(userId);
    if (!affiliate) {
      return NextResponse.json({ error: "Not an affiliate" }, { status: 404 });
    }

    // Get total clicks
    const { count: totalClicks } = await supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id);

    // Get total referrals
    const { count: totalReferrals } = await supabase
      .from("affiliate_referrals")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id);

    // Get total commissions (pending + paid)
    const { data: commissionStats } = await supabase
      .from("commissions")
      .select("amount_cents, status")
      .eq("affiliate_id", affiliate.id);

    const totalEarnings = (commissionStats ?? []).reduce(
      (sum, c) => sum + (c.amount_cents ?? 0),
      0,
    );

    const pendingEarnings = (commissionStats ?? [])
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);

    const paidEarnings = (commissionStats ?? [])
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);

    // Get recent referrals (last 50)
    const { data: referrals } = await supabase
      .from("affiliate_referrals")
      .select("id, referred_user_id, ref_code, attributed_at, expires_at")
      .eq("affiliate_id", affiliate.id)
      .order("attributed_at", { ascending: false })
      .limit(50);

    // Get commission history (last 100)
    const { data: commissions } = await supabase
      .from("commissions")
      .select("id, stripe_invoice_id, event_ts, amount_cents, status, reason")
      .eq("affiliate_id", affiliate.id)
      .order("event_ts", { ascending: false })
      .limit(100);

    // Get conversion rate
    const conversionRate = totalClicks && totalReferrals
      ? ((totalReferrals / totalClicks) * 100).toFixed(1)
      : "0.0";

    return NextResponse.json({
      affiliate: {
        code: affiliate.code,
        status: affiliate.status,
        base_rate: affiliate.base_rate,
        lifetime: affiliate.lifetime,
        recur_months: affiliate.recur_months,
      },
      stats: {
        totalClicks: totalClicks ?? 0,
        totalReferrals: totalReferrals ?? 0,
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        conversionRate,
      },
      referrals: referrals ?? [],
      commissions: commissions ?? [],
    });
  } catch (error) {
    console.error("Failed to load affiliate dashboard", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
