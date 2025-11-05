import Stripe from "stripe";
import {
  getAffiliate,
  getReferralByUser,
  getSubscription,
  insertCommission,
} from "@/lib/db/affiliates";

/**
 * Records commission from a paid Stripe invoice.
 * Called by webhook on invoice.paid event.
 *
 * Logic:
 * 1. Get subscription from invoice
 * 2. Check if user has active referral
 * 3. Check if referral is within commission window
 * 4. Calculate commission (subtotal - discounts) * rate
 * 5. Insert commission record (idempotent on stripe_invoice_id)
 *
 * @param invoice - Stripe Invoice object
 */
export async function recordCommissionFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  try {
    // Skip if no subscription
    const subscriptionId = invoice.subscription as string | undefined;
    if (!subscriptionId) {
      return;
    }

    // Get subscription to resolve user_id
    const subscription = await getSubscription(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription ${subscriptionId} not found for invoice ${invoice.id}`);
      return;
    }

    // Check if user has referral
    const referral = await getReferralByUser(subscription.user_id);
    if (!referral) {
      return; // No referral, no commission
    }

    // Check if referral is still within commission window
    const now = new Date();
    if (referral.expires_at && new Date(referral.expires_at) < now) {
      return; // Referral expired
    }

    // Get affiliate details
    const affiliate = await getAffiliate(referral.affiliate_id);
    if (!affiliate || affiliate.status !== "active") {
      return; // Affiliate not active
    }

    // Calculate commission basis (subtotal - discounts, excludes tax)
    const subtotal = invoice.subtotal ?? 0; // in cents
    const discounts = (invoice.total_discount_amounts ?? []).reduce(
      (sum, d) => sum + (d.amount ?? 0),
      0,
    );
    const basis = Math.max(0, subtotal - discounts);

    // Calculate commission amount
    const rate = affiliate.base_rate;
    const amount = Math.floor(basis * Number(rate));

    if (amount <= 0) {
      return; // No commission to record
    }

    // Insert commission (idempotent on stripe_invoice_id unique constraint)
    await insertCommission({
      affiliate_id: affiliate.id,
      referral_id: referral.id,
      stripe_invoice_id: invoice.id,
      event_ts: new Date(),
      basis_cents: basis,
      rate,
      amount_cents: amount,
      reason: "invoice_paid",
    });

    console.log(
      `Commission recorded: ${amount} cents for affiliate ${affiliate.code} (invoice ${invoice.id})`,
    );
  } catch (error) {
    console.error("Failed to record commission from invoice", error);
  }
}
