import { NextRequest, NextResponse } from "next/server";

import { getAffiliateByUserId } from "@/lib/db/affiliates";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/affiliates/kpis
 * Returns KPI data for affiliate dashboard:
 * - Current balance (pending earnings)
 * - Total earnings (all time)
 * - Next payout date
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

    // Get commission stats
    const { data: commissionStats } = await supabase
      .from("commissions")
      .select("amount_cents, status")
      .eq("affiliate_id", affiliate.id);

    const totalEarnings = (commissionStats ?? []).reduce(
      (sum, c) => sum + (c.amount_cents ?? 0),
      0,
    );

    const pendingBalance = (commissionStats ?? [])
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);

    const paidEarnings = (commissionStats ?? [])
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);

    // Get next payout date (next scheduled payout in ready or processing status)
    const { data: nextPayout } = await supabase
      .from("payouts")
      .select("period_end, created_at, status")
      .eq("affiliate_id", affiliate.id)
      .in("status", ["ready", "processing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get total referrals count
    const { count: totalReferrals } = await supabase
      .from("affiliate_referrals")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id);

    return NextResponse.json({
      balance: {
        pendingCents: pendingBalance,
        totalEarningsCents: totalEarnings,
        paidCents: paidEarnings,
      },
      payout: {
        nextPayoutDate: nextPayout?.created_at ?? null,
        nextPayoutStatus: nextPayout?.status ?? null,
        minPayoutCents: affiliate.min_payout_cents,
      },
      stats: {
        totalReferrals: totalReferrals ?? 0,
        commissionRate: affiliate.base_rate,
      },
    });
  } catch (error) {
    console.error("Failed to load affiliate KPIs", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
