import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getStripeClient } from "@/lib/billing/stripe";

/**
 * POST /api/billing/checkout/direct
 * Create a Stripe Checkout session with a direct price ID
 *
 * Body:
 * {
 *   userId: string,
 *   priceId: string,
 *   planName?: string,
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
      priceId,
      planName = 'Basic Plan',
      successUrl,
      cancelUrl,
    } = body as {
      userId: string;
      priceId: string;
      planName?: string;
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

    if (!priceId) {
      return NextResponse.json(
        { error: "priceId is required" },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id, email")
      .eq("user_id", userId)
      .maybeSingle();

    // Determine if we need to create or use existing customer
    let customerId = profile?.stripe_customer_id;

    // Create Stripe checkout session
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : profile?.email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${baseUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${baseUrl}/billing?canceled=true`,
      metadata: {
        user_id: userId,
        userId: userId, // Both formats for compatibility
        plan: 'basic', // Default to basic plan
        plan_name: planName,
        price_id: priceId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          userId: userId,
          plan: 'basic',
          plan_name: planName,
          price_id: priceId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: customerId ? {
        address: 'auto',
        name: 'auto',
      } : undefined,
    });

    // Track pricing analytics (optional, don't block on errors)
    try {
      await supabase.from("pricing_analytics").insert({
        user_id: userId,
        session_id: session.id,
        event_type: 'checkout_started',
        plan_code: 'basic',
        billing_cycle: priceId.includes('annual') || priceId.includes('year') ? 'annual' : 'monthly',
        metadata: {
          stripe_session_id: session.id,
          price_id: priceId,
          plan_name: planName,
        },
      });
    } catch (error) {
      console.warn("Failed to track checkout_started analytics", error);
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      customerId: session.customer,
    });

  } catch (error) {
    console.error("Stripe direct checkout error:", error);
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
