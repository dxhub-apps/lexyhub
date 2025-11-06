import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/billing/stripe";

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session for subscription management
 *
 * Body:
 * {
 *   userId: string,
 *   returnUrl?: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripe = getStripeClient();
  const supabase = getSupabaseServerClient();

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase client unavailable" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { userId, returnUrl } = body as {
      userId: string;
      returnUrl?: string;
    };

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for user. Please subscribe first." },
        { status: 404 }
      );
    }

    // Create Customer Portal session
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl || `${baseUrl}/billing`,
    });

    return NextResponse.json({
      url: session.url,
    });

  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      {
        error: "Failed to create portal session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
