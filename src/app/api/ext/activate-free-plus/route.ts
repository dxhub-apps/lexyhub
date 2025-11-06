import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { EXTENSION_FREE_PLUS_DURATION_DAYS } from "@/lib/billing/plans";

/**
 * POST /api/ext/activate-free-plus
 * Activate Free+ extension boost for a user
 *
 * Body:
 * {
 *   userId: string
 * }
 *
 * Response:
 * {
 *   activated: boolean,
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
      .select("plan, extension_free_plus_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Only activate for free users
    if (profile?.plan !== 'free') {
      return NextResponse.json({
        activated: false,
        message: "Free+ boost is only available for Free plan users",
        currentPlan: profile?.plan,
      });
    }

    // Check if already activated and not expired
    const now = new Date();
    const existingExpiry = profile?.extension_free_plus_expires_at
      ? new Date(profile.extension_free_plus_expires_at)
      : null;

    if (existingExpiry && existingExpiry > now) {
      // Already active, return existing expiry
      const daysRemaining = Math.ceil(
        (existingExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return NextResponse.json({
        activated: true,
        alreadyActive: true,
        expiresAt: existingExpiry.toISOString(),
        daysRemaining,
      });
    }

    // Activate Free+ boost
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXTENSION_FREE_PLUS_DURATION_DAYS);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        extension_free_plus_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to activate Free+ boost:", error);
      return NextResponse.json(
        { error: "Failed to activate Free+ boost" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activated: true,
      alreadyActive: false,
      expiresAt: expiresAt.toISOString(),
      daysRemaining: EXTENSION_FREE_PLUS_DURATION_DAYS,
      message: `Free+ boost activated! You now have 2.5x higher limits for ${EXTENSION_FREE_PLUS_DURATION_DAYS} days.`,
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
 * GET /api/ext/activate-free-plus
 * Check Free+ boost status for a user
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
    .select("plan, extension_free_plus_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const expiresAt = profile.extension_free_plus_expires_at
    ? new Date(profile.extension_free_plus_expires_at)
    : null;

  const isActive = expiresAt && expiresAt > now;
  const daysRemaining = isActive
    ? Math.ceil((expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return NextResponse.json({
    isActive,
    expiresAt: expiresAt?.toISOString() || null,
    daysRemaining,
    plan: profile.plan,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
