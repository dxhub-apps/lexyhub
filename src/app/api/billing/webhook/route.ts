import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { recordInvoice, recordWebhookEvent, syncSubscription, verifyStripeWebhook } from "@/lib/billing/stripe";

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
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
    case "invoice.payment_failed":
      await recordInvoice(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
