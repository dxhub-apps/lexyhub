import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/billing/stripe";
import type { PlanCode, BillingCycle } from "@/lib/billing/types";
import { isValidPlanCode } from "@/lib/billing/plans";

/**
 * POST /api/billing/checkout/public
 * Create a Stripe Checkout session for new customers from landing page
 *
 * This endpoint is designed for unauthenticated users coming from lexyhub.com
 * It creates a checkout session without requiring a userId upfront.
 * The webhook will handle user creation/association after successful payment.
 *
 * Body:
 * {
 *   planCode: 'basic' | 'pro' | 'growth',
 *   billingCycle: 'monthly' | 'annual',
 *   email?: string, // Optional: pre-fill email
 *   referralCode?: string, // Optional: referral code
 *   successUrl?: string,
 *   cancelUrl?: string
 * }
 *
 * Example usage from landing page (lexyhub.com):
 * ```
 * fetch('https://app.lexyhub.com/api/billing/checkout/public', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     planCode: 'basic',
 *     billingCycle: 'monthly'
 *   })
 * }).then(res => res.json())
 *   .then(data => window.location.href = data.url);
 * ```
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
      planCode,
      billingCycle = 'monthly',
      email,
      referralCode,
      successUrl,
      cancelUrl,
    } = body as {
      planCode: PlanCode;
      billingCycle: BillingCycle;
      email?: string;
      referralCode?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    // Validate inputs
    if (!planCode || !isValidPlanCode(planCode)) {
      return NextResponse.json(
        { error: "Invalid planCode. Must be one of: basic, pro, growth" },
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

    // Get Stripe price ID from database
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'test';
    const { data: priceMapping, error: priceMappingError } = await supabase
      .from("stripe_price_mappings")
      .select("stripe_price_id")
      .eq("plan_code", planCode)
      .eq("billing_cycle", billingCycle)
      .eq("environment", environment)
      .eq("is_active", true)
      .maybeSingle();

    if (priceMappingError || !priceMapping?.stripe_price_id) {
      console.error("Price mapping error:", priceMappingError);
      return NextResponse.json(
        {
          error: `No active Stripe price configured for ${planCode} ${billingCycle}`,
          hint: "Please configure Stripe price IDs in stripe_price_mappings table"
        },
        { status: 500 }
      );
    }

    // Determine base URL for redirects
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lexyhub.com';
    const landingBaseUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'https://lexyhub.com';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: email || undefined, // Pre-fill email if provided
      line_items: [
        {
          price: priceMapping.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // After successful payment, redirect to app to complete signup
      success_url: successUrl || `${appBaseUrl}/auth/callback?session_id={CHECKOUT_SESSION_ID}&plan=${planCode}`,
      cancel_url: cancelUrl || `${landingBaseUrl}/pricing?canceled=true`,
      metadata: {
        plan: planCode,
        billing_cycle: billingCycle,
        referral_code: referralCode || '',
        source: 'landing_page',
      },
      subscription_data: {
        metadata: {
          plan: planCode,
          billing_cycle: billingCycle,
          referral_code: referralCode || '',
          source: 'landing_page',
        },
        trial_period_days: planCode !== 'growth' ? 7 : undefined, // 7-day trial for Basic/Pro
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      phone_number_collection: {
        enabled: false,
      },
    });

    // Track pricing analytics (no user_id yet, just track the session)
    try {
      await supabase.from("pricing_analytics").insert({
        session_id: session.id,
        event_type: 'checkout_started',
        plan_code: planCode,
        billing_cycle: billingCycle,
        referrer: request.headers.get('referer') || null,
        metadata: {
          stripe_session_id: session.id,
          source: 'landing_page',
          email: email || null,
        },
      });
    } catch (error) {
      console.warn("Failed to track checkout_started analytics", error);
      // Don't fail the request if analytics fails
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error("Public checkout error:", error);
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
