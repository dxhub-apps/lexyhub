import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { recordInvoice, recordWebhookEvent, syncSubscription, verifyStripeWebhook, handleCheckoutCompleted } from "@/lib/billing/stripe";
import { recordCommissionFromInvoice } from "@/lib/billing/affiliates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event;
  try {
    event = verifyStripeWebhook(signature, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await recordWebhookEvent(JSON.parse(body), event);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
      await recordInvoice(event.data.object as Stripe.Invoice);
      await recordCommissionFromInvoice(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await recordInvoice(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
