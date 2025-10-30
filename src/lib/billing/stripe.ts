import Stripe from "stripe";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

export function getStripeClient(): Stripe | null {
  return stripeClient;
}

export type PlanMapping = {
  plan: "spark" | "scale" | "apex" | string;
  momentumMultiplier: number;
};

const PLAN_HINTS: PlanMapping[] = [
  { plan: "spark", momentumMultiplier: 1 },
  { plan: "scale", momentumMultiplier: 1.4 },
  { plan: "apex", momentumMultiplier: 1.8 },
];

function inferPlan(subscription: Stripe.Subscription): PlanMapping {
  const metadataPlan = subscription.metadata?.plan?.toLowerCase();
  if (metadataPlan) {
    const mapping = PLAN_HINTS.find((hint) => hint.plan === metadataPlan);
    if (mapping) {
      return mapping;
    }
  }

  const nickname = subscription.items.data[0]?.plan?.nickname?.toLowerCase();
  if (nickname) {
    const mapping = PLAN_HINTS.find((hint) => nickname.includes(hint.plan));
    if (mapping) {
      return mapping;
    }
  }

  return { plan: "spark", momentumMultiplier: 1 };
}

export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const userId = subscription.metadata?.user_id ?? subscription.metadata?.userId;
  if (!userId) {
    console.warn("Stripe subscription missing user_id metadata", subscription.id);
    return;
  }

  const planMapping = inferPlan(subscription);

  const payload = {
    stripe_subscription_id: subscription.id,
    user_id: userId,
    plan: planMapping.plan,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    metadata: subscription.metadata ?? {},
  };

  const { error } = await supabase.from("billing_subscriptions").upsert(payload, {
    onConflict: "stripe_subscription_id",
  });

  if (error) {
    console.error("Failed to upsert billing subscription", error);
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      plan: planMapping.plan,
      momentum: subscription.status === "active" ? "active" : "paused",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    console.error("Failed to upsert user profile for plan", profileError);
  }

  const { error: overrideError } = await supabase.from("plan_overrides").insert({
    user_id: userId,
    plan: planMapping.plan,
    momentum_multiplier: planMapping.momentumMultiplier,
    notes: `Updated from Stripe subscription ${subscription.id}`,
    expires_at: subscription.cancel_at_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
  });

  if (overrideError) {
    console.warn("Failed to record plan override", overrideError);
  }
}

export async function recordInvoice(invoice: Stripe.Invoice): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const userId = invoice.metadata?.user_id ?? invoice.metadata?.userId ?? null;

  const { error } = await supabase.from("billing_invoice_events").upsert(
    {
      user_id: userId,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer ? String(invoice.customer) : null,
      amount_due_cents: invoice.amount_due ?? null,
      amount_paid_cents: invoice.amount_paid ?? null,
      status: invoice.status ?? null,
      invoice_date: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
      metadata: invoice.metadata ?? {},
    },
    { onConflict: "stripe_invoice_id" },
  );

  if (error) {
    console.warn("Failed to upsert billing invoice", error);
  }
}

export async function recordWebhookEvent(payload: unknown, event: Stripe.Event): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("webhook_events").insert({
    provider: "stripe",
    event_type: event.type,
    payload,
    status: "received",
    received_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("Failed to persist webhook event", error);
  }
}

export function verifyStripeWebhook(signature: string | null, body: string): Stripe.Event {
  if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook processing is not configured");
  }

  if (!signature) {
    throw new Error("Stripe signature header missing");
  }

  return stripeClient.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
}
