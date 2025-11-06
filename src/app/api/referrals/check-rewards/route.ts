import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/referrals/check-rewards
 * Check user's referral count and reward status
 *
 * Query params:
 * - userId: string
 *
 * Response:
 * {
 *   referralCount: number,
 *   activeReward: { tier: 'basic' | 'pro', expiresAt: string } | null,
 *   nextReward: { tier: 'basic' | 'pro', referralsNeeded: number } | null,
 *   progress: { current: number, next: number, percentage: number }
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase client unavailable" },
      { status: 503 }
    );
  }

  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Get user's affiliate ID
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({
        referralCount: 0,
        activeReward: null,
        nextReward: { tier: 'basic', referralsNeeded: 1 },
        progress: { current: 0, next: 1, percentage: 0 },
      });
    }

    // Count successful referrals
    const { count: referralCount } = await supabase
      .from("affiliate_referrals")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliate.id);

    // Get active reward
    const { data: activeReward } = await supabase
      .from("active_referral_rewards")
      .select("active_reward_tier, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Determine next reward
    const count = referralCount ?? 0;
    let nextReward = null;
    let progress = { current: count, next: 1, percentage: 0 };

    if (count < 1) {
      nextReward = { tier: 'basic' as const, referralsNeeded: 1 - count };
      progress = { current: count, next: 1, percentage: (count / 1) * 100 };
    } else if (count < 3) {
      nextReward = { tier: 'pro' as const, referralsNeeded: 3 - count };
      progress = { current: count, next: 3, percentage: (count / 3) * 100 };
    } else {
      // Already unlocked everything
      progress = { current: count, next: 3, percentage: 100 };
    }

    return NextResponse.json({
      referralCount: count,
      activeReward: activeReward
        ? {
            tier: activeReward.active_reward_tier,
            expiresAt: activeReward.expires_at,
          }
        : null,
      nextReward,
      progress,
    });
  } catch (error) {
    console.error("Check rewards error:", error);
    return NextResponse.json(
      {
        error: "Failed to check referral rewards",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/referrals/check-rewards
 * Check and auto-grant referral rewards if eligible
 *
 * Body:
 * {
 *   userId: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase client unavailable" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Call the RPC function to check and grant rewards
    const { data, error } = await supabase.rpc("check_and_grant_referral_rewards", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Grant rewards error:", error);
      return NextResponse.json(
        { error: "Failed to check/grant rewards" },
        { status: 500 }
      );
    }

    const result = data?.[0];

    return NextResponse.json({
      rewardGranted: result?.reward_granted ?? false,
      rewardTier: result?.reward_tier || null,
      message: result?.message || "No rewards to grant at this time",
    });
  } catch (error) {
    console.error("Grant rewards error:", error);
    return NextResponse.json(
      {
        error: "Failed to check/grant rewards",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
