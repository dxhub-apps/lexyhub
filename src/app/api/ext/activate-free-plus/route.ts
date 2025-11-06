import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const EXTENSION_TRIAL_DURATION_DAYS = 14;

/**
 * POST /api/ext/activate-trial
 * Activate 14-day Pro trial for users who sign up via Chrome extension
 *
 * Body:
 * {
 *   userId: string
 * }
 *
 * Response:
 * {
 *   activated: boolean,
 *   plan: 'pro',
 *   expiresAt: string,
 *   daysRemaining: number
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

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan, extension_trial_expires_at, extension_trial_activated_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Check if user already has a paid subscription
    const { data: subscription } = await supabase
      .from("billing_subscriptions")
      .select("status, plan")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (subscription) {
      return NextResponse.json({
        activated: false,
        message: `You already have an active ${subscription.plan} subscription`,
        currentPlan: subscription.plan,
      });
    }

    // Check if already activated and not expired
    const now = new Date();
    const existingExpiry = profile?.extension_trial_expires_at
      ? new Date(profile.extension_trial_expires_at)
      : null;

    if (existingExpiry && existingExpiry > now) {
      // Already active, return existing expiry
      const daysRemaining = Math.ceil(
        (existingExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return NextResponse.json({
        activated: true,
        alreadyActive: true,
        plan: 'pro',
        expiresAt: existingExpiry.toISOString(),
        daysRemaining,
      });
    }

    // Check if trial was already used (can only activate once)
    if (profile?.extension_trial_activated_at) {
      return NextResponse.json({
        activated: false,
        message: "Extension trial can only be activated once per account",
        previouslyActivatedAt: profile.extension_trial_activated_at,
      });
    }

    // Activate 14-day Pro trial
    const activatedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXTENSION_TRIAL_DURATION_DAYS);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        extension_trial_activated_at: activatedAt.toISOString(),
        extension_trial_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to activate extension trial:", error);
      return NextResponse.json(
        { error: "Failed to activate extension trial" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activated: true,
      alreadyActive: false,
      plan: 'pro',
      expiresAt: expiresAt.toISOString(),
      daysRemaining: EXTENSION_TRIAL_DURATION_DAYS,
      message: `🎉 Pro trial activated! You have full Pro access for ${EXTENSION_TRIAL_DURATION_DAYS} days.`,
    });

  } catch (error) {
    console.error("Free+ activation error:", error);
    return NextResponse.json(
      {
        error: "Failed to activate Free+ boost",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ext/activate-trial
 * Check extension trial status for a user
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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan, extension_trial_expires_at, extension_trial_activated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const expiresAt = profile.extension_trial_expires_at
    ? new Date(profile.extension_trial_expires_at)
    : null;

  const isActive = expiresAt && expiresAt > now;
  const daysRemaining = isActive
    ? Math.ceil((expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return NextResponse.json({
    isActive,
    plan: isActive ? 'pro' : profile.plan,
    expiresAt: expiresAt?.toISOString() || null,
    daysRemaining,
    activatedAt: profile.extension_trial_activated_at,
    wasUsed: !!profile.extension_trial_activated_at,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
