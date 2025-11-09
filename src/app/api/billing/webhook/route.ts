import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { recordInvoice, recordWebhookEvent, syncSubscription, verifyStripeWebhook, handleCheckoutCompleted } from "@/lib/billing/stripe";
import { recordCommissionFromInvoice } from "@/lib/billing/affiliates";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();

    let event;
    try {
      event = verifyStripeWebhook(signature, body);
    } catch (error) {
      // Webhook verification failed - this is expected for invalid signatures
      const message = error instanceof Error ? error.message : String(error);

      log.error("Stripe webhook verification failed", {
        error,
        requestId,
        hasSignature: !!signature,
      });

      Sentry.captureException(error, {
        tags: {
          feature: "billing",
          component: "webhook",
          errorType: "verification-failed",
          requestId,
        },
        level: "warning", // Warning level since this could be a malicious request
      });

      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Set Sentry context for this webhook event
    Sentry.setContext("stripe_webhook", {
      eventId: event.id,
      eventType: event.type,
      requestId,
    });

    // Record the webhook event
    try {
      await recordWebhookEvent(JSON.parse(body), event);
    } catch (error) {
      log.error("Failed to record webhook event", { error, eventType: event.type, requestId });
      Sentry.captureException(error, {
        tags: {
          feature: "billing",
          component: "webhook-recording",
          eventType: event.type,
          requestId,
        },
      });
      // Continue processing even if recording fails
    }

    // Process the webhook event
    try {
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
          // Log unhandled event types for monitoring
          log.info("Unhandled webhook event type", { eventType: event.type, requestId });
          break;
      }
    } catch (error) {
      // Critical error processing webhook - this should always be captured
      log.error("Failed to process webhook event", {
        error,
        eventType: event.type,
        eventId: event.id,
        requestId,
      });

      Sentry.captureException(error, {
        tags: {
          feature: "billing",
          component: "webhook-processing",
          eventType: event.type,
          eventId: event.id,
          requestId,
        },
        level: "error",
        contexts: {
          stripe: {
            eventId: event.id,
            eventType: event.type,
          },
        },
      });

      // Return 500 so Stripe retries the webhook
      return NextResponse.json(
        { error: "Failed to process webhook", requestId },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, requestId });
  } catch (error) {
    // Unexpected error at the top level
    log.error("Unexpected error in webhook handler", { error, requestId });

    Sentry.captureException(error, {
      tags: {
        feature: "billing",
        component: "webhook",
        errorType: "unexpected",
        requestId,
      },
      level: "fatal",
    });

    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
