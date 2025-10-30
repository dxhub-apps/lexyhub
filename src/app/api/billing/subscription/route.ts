import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

function requireUserId(request: NextRequest): string {
  const userId = request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  const userId = request.nextUrl.searchParams.get("userId");

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
  }

  const [{ data: subscription }, { data: invoices }, { data: profile }] = await Promise.all([
    supabase
      .from("billing_subscriptions")
      .select("plan, status, current_period_end, cancel_at_period_end, metadata, created_at, stripe_subscription_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("billing_invoice_events")
      .select("stripe_invoice_id, invoice_date, amount_paid_cents, amount_due_cents, status")
      .eq("user_id", userId)
      .order("invoice_date", { ascending: false })
      .limit(6),
    supabase
      .from("user_profiles")
      .select("plan, momentum, settings")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    subscription: subscription ?? null,
    invoices: invoices ?? [],
    profile: profile ?? null,
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 500 });
  }

  const userId = requireUserId(request);
  const payload = await request.json();

  const plan = payload.plan as string | undefined;
  const billingEmail = payload.billingEmail as string | undefined;
  const autoRenew = payload.autoRenew as boolean | undefined;
  const paymentMethod = payload.paymentMethod as string | undefined;

  const subscriptionUpdate: Record<string, unknown> = {};
  if (typeof autoRenew === "boolean") {
    subscriptionUpdate.cancel_at_period_end = !autoRenew;
  }
  if (billingEmail) {
    subscriptionUpdate.metadata = { billing_email: billingEmail };
  }

  if (Object.keys(subscriptionUpdate).length > 0) {
    const { error } = await supabase
      .from("billing_subscriptions")
      .update(subscriptionUpdate)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (plan) {
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: userId,
      plan,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (paymentMethod) {
    const { error } = await supabase.from("user_profiles").update({
      settings: { payment_method_label: paymentMethod },
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (error) {
      console.warn("Failed to store payment method label", error);
    }
  }

  return NextResponse.json({ status: "updated" });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
