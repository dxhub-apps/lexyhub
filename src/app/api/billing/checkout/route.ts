import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/billing/stripe";
import type { PlanCode, BillingCycle } from "@/lib/billing/types";
import { isValidPlanCode } from "@/lib/billing/plans";

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout session for subscription
 *
 * Body:
 * {
 *   userId: string,
 *   planCode: 'basic' | 'pro' | 'growth',
 *   billingCycle: 'monthly' | 'annual',
 *   successUrl?: string,
 *   cancelUrl?: string
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
    const {
      userId,
      planCode,
      billingCycle = 'monthly',
      successUrl,
      cancelUrl,
    } = body as {
      userId: string;
      planCode: PlanCode;
      billingCycle: BillingCycle;
      successUrl?: string;
      cancelUrl?: string;
    };

    // Validate inputs
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!planCode || !isValidPlanCode(planCode)) {
      return NextResponse.json(
        { error: "Invalid planCode" },
        { status: 400 }
      );
    }

    if (planCode === 'free') {
      return NextResponse.json(
        { error: "Cannot create checkout for free plan" },
        { status: 400 }
      );
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billingCycle. Must be 'monthly' or 'annual'" },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Get Stripe price ID from database
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'test';
    const { data: priceMapping } = await supabase
      .from("stripe_price_mappings")
      .select("stripe_price_id")
      .eq("plan_code", planCode)
      .eq("billing_cycle", billingCycle)
      .eq("environment", environment)
      .eq("is_active", true)
      .maybeSingle();

    if (!priceMapping?.stripe_price_id) {
      return NextResponse.json(
        {
          error: `No active Stripe price configured for ${planCode} ${billingCycle}`,
          hint: "Please configure Stripe price IDs in stripe_price_mappings table"
        },
        { status: 500 }
      );
    }

    // Determine if we need to create or use existing customer
    let customerId = profile?.stripe_customer_id;

    // Create Stripe checkout session
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : undefined, // Will be filled by user
      line_items: [
        {
          price: priceMapping.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${baseUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/pricing?canceled=true`,
      metadata: {
        user_id: userId,
        userId: userId, // Both formats for compatibility
        plan: planCode,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          userId: userId,
          plan: planCode,
          billing_cycle: billingCycle,
        },
        trial_period_days: planCode !== 'growth' ? 7 : undefined, // 7-day trial for Basic/Pro, no trial for Growth
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: customerId ? {
        address: 'auto',
        name: 'auto',
      } : undefined,
    });

    // Track pricing analytics
    await supabase.from("pricing_analytics").insert({
      user_id: userId,
      session_id: session.id,
      event_type: 'checkout_started',
      plan_code: planCode,
      billing_cycle: billingCycle,
      metadata: {
        stripe_session_id: session.id,
      },
    }).catch((error) => {
      console.warn("Failed to track checkout_started analytics", error);
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      customerId: session.customer,
    });

  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
