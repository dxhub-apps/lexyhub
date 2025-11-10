# Stripe Billing Integration - Implementation Documentation

## Overview

LexyHub uses Stripe for subscription billing management. This document outlines the complete implementation, configuration requirements, and operational checklist.

---

## 🎯 Current Implementation Status

### ✅ Completed Features

#### 1. **Checkout Flow**
- ✅ Standard checkout API (`/api/billing/checkout/route.ts`)
  - Supports planCode + billingCycle approach
  - Fetches price IDs from `stripe_price_mappings` table
  - Includes 7-day trial for Basic/Pro plans
  - Tracks checkout analytics

- ✅ Direct checkout API (`/api/billing/checkout/direct/route.ts`)
  - Accepts direct Stripe price IDs
  - Used for special promotions (e.g., Founders Deal)
  - Bypasses database price lookup
  - Supports custom plan names

#### 2. **Webhook Handling**
- ✅ Webhook endpoint (`/api/billing/webhook/route.ts`)
- ✅ Supported events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- ✅ Webhook signature verification
- ✅ Event persistence in `webhook_events` table

#### 3. **Subscription Management**
- ✅ Sync subscriptions from Stripe to database
- ✅ Update user profiles with plan changes
- ✅ Track subscription status and billing periods
- ✅ Handle cancellations and renewals
- ✅ Invoice tracking and history

#### 4. **UI Components**
- ✅ Sidebar Founders Deal CTA (links to special offer)
- ✅ Billing page with:
  - Subscription status display
  - Invoice history
  - Usage tracking
  - Upgrade CTAs for free users
  - Founders Deal promotion
  - Regular Basic Plan upgrade

#### 5. **Database Schema**
- ✅ `billing_subscriptions` - Stripe subscription data
- ✅ `billing_invoice_events` - Invoice tracking
- ✅ `webhook_events` - Webhook event log
- ✅ `stripe_price_mappings` - Price ID configuration
- ✅ `plan_overrides` - Manual plan adjustments
- ✅ `pricing_analytics` - Conversion tracking
- ✅ `usage_warnings` - Quota notifications
- ✅ `upsell_triggers` - Upgrade prompts

#### 6. **Core Utilities**
- ✅ `src/lib/billing/stripe.ts` - Stripe client and sync functions
- ✅ `src/lib/billing/types.ts` - Type definitions and helpers
- ✅ `src/lib/billing/plans.ts` - Plan configuration
- ✅ Environment variable validation (Zod schema)

---

## 📋 TODO / Not Yet Implemented

### High Priority

- [ ] **Customer Portal**
  - Stripe-hosted portal for managing subscriptions
  - Payment method updates
  - Invoice downloads
  - Cancel/resume subscription

- [ ] **Usage Metering**
  - Report usage to Stripe for metered billing
  - Sync monthly usage counts
  - Overage handling

- [ ] **Proration Handling**
  - Upgrade/downgrade prorations
  - Mid-cycle plan changes
  - Credit balance management

- [ ] **Tax Calculation**
  - Stripe Tax integration
  - Tax ID collection
  - Regional tax compliance

### Medium Priority

- [ ] **Email Notifications**
  - Payment success/failure emails
  - Subscription renewal reminders
  - Trial ending notifications
  - Invoice receipts

- [ ] **Admin Dashboard**
  - View all subscriptions
  - Manual plan adjustments
  - Refund processing
  - Analytics dashboard

- [ ] **Dunning Management**
  - Failed payment retry logic
  - Grace period handling
  - Account suspension workflow

- [ ] **Coupons & Discounts**
  - Promotion code management
  - Referral discounts
  - Bulk discount handling

### Low Priority

- [ ] **Multi-currency Support**
  - Currency conversion
  - Regional pricing
  - Payment method localization

- [ ] **Team/Workspace Billing**
  - Shared subscriptions
  - Seat-based pricing
  - Multi-user management

- [ ] **Revenue Recognition**
  - Accounting integrations
  - MRR tracking
  - Churn analytics

---

## 🔧 Environment Variables

### Required for Production

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_xxxxx  # Live secret key from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Webhook signing secret

# Supabase (for database access)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # For server-side operations

# App Configuration
NEXT_PUBLIC_BASE_URL=https://yourdomain.com  # For checkout redirects
```

### Optional for Development

```bash
# Stripe Test Keys (use during development)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx

# Local Development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Where to Find These Values

1. **STRIPE_SECRET_KEY**
   - Stripe Dashboard → Developers → API keys → Secret key
   - Use test key for development, live key for production

2. **STRIPE_WEBHOOK_SECRET**
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - After creating webhook, click to reveal signing secret

3. **Supabase Keys**
   - Supabase Dashboard → Settings → API
   - Copy URL and anon key (public)
   - Copy service_role key (keep secret)

---

## 💳 Stripe Dashboard Setup

### 1. Create Products

You need to create products in Stripe Dashboard for each plan:

#### Product 1: LexyHub Basic Plan (Regular)
- **Product ID**: `prod_TN8vhpBWYQwYlP`
- **Name**: "LexyHub Basic"
- **Description**: "Essential tools for growing sellers"
- **Prices**:
  - Monthly: `price_1SQOdz3enLCiqy1O4KF74msU`
  - Annual: (create if needed)

#### Product 2: LexyHub Basic Plan (Founders Deal)
- **Product ID**: `prod_TN9qqkccUMgqQX`
- **Name**: "LexyHub Basic - Founders Deal"
- **Description**: "Limited time founders offer - $39/year"
- **Price**: `price_1SQPWO3enLCiqy1Oll2Lhd54`
  - Billing: Annual
  - Amount: $39.00

### 2. Configure Webhook Endpoint

1. Go to: **Stripe Dashboard → Developers → Webhooks**
2. Click **"Add endpoint"**
3. Enter endpoint URL: `https://yourdomain.com/api/billing/webhook`
4. Select events to listen to:
   ```
   checkout.session.completed
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.paid
   invoice.payment_failed
   ```
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your `.env` as `STRIPE_WEBHOOK_SECRET`

### 3. Enable Customer Portal (Optional)

1. Go to: **Stripe Dashboard → Settings → Billing → Customer portal**
2. Enable portal
3. Configure allowed actions:
   - ✅ Update payment method
   - ✅ View invoice history
   - ✅ Cancel subscription
4. Set branding (logo, colors)

### 4. Configure Billing Settings

1. **Email Receipts**: Settings → Emails → Enable receipts
2. **Payment Methods**: Enable cards, wallets (Apple Pay, Google Pay)
3. **Subscription Settings**:
   - Default payment method required
   - Subscription proration: Prorate on plan changes
   - Grace period: 3 days (optional)

---

## 🗄️ Database Tables

### Core Tables (Already Migrated)

#### `billing_subscriptions`
Stores Stripe subscription data synced from webhooks.

```sql
- user_id (FK to auth.users)
- stripe_subscription_id (unique)
- plan (varchar: 'free', 'basic', 'pro', 'growth')
- status (varchar: 'active', 'trialing', 'canceled', etc.)
- current_period_start (timestamp)
- current_period_end (timestamp)
- cancel_at_period_end (boolean)
- canceled_at (timestamp, nullable)
- metadata (jsonb)
```

#### `billing_invoice_events`
Tracks all invoices from Stripe.

```sql
- user_id (FK to auth.users)
- stripe_invoice_id (unique)
- stripe_customer_id (varchar)
- amount_due_cents (integer)
- amount_paid_cents (integer)
- status (varchar: 'paid', 'open', 'void', 'uncollectible')
- invoice_date (timestamp)
- metadata (jsonb)
```

#### `stripe_price_mappings`
Maps plan codes to Stripe price IDs by environment.

```sql
- plan_code (varchar: 'basic', 'pro', 'growth')
- billing_cycle (varchar: 'monthly', 'annual')
- stripe_price_id (varchar: 'price_xxxxx')
- environment (varchar: 'test', 'production')
- is_active (boolean)
```

**Example Data:**
```sql
INSERT INTO stripe_price_mappings (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  ('basic', 'monthly', 'price_1SQOdz3enLCiqy1O4KF74msU', 'production', true),
  ('basic', 'annual', 'price_1SQPWO3enLCiqy1Oll2Lhd54', 'production', true);
```

#### `webhook_events`
Logs all webhook events for debugging.

```sql
- provider (varchar: 'stripe')
- event_type (varchar)
- payload (jsonb)
- status (varchar: 'received', 'processed', 'failed')
- received_at (timestamp)
```

#### `user_profiles`
Extended with billing fields.

```sql
- stripe_customer_id (varchar, unique)
- plan (varchar: 'free', 'basic', 'pro', 'growth')
- settings (jsonb - includes payment_method_label)
```

### Analytics Tables

#### `pricing_analytics`
Tracks conversion funnel.

```sql
- user_id (FK, nullable)
- session_id (varchar)
- event_type (varchar: 'page_view', 'tier_clicked', 'checkout_started', 'checkout_completed')
- plan_code (varchar)
- billing_cycle (varchar)
- metadata (jsonb)
- created_at (timestamp)
```

---

## 🧪 Testing Checklist

### Development Testing (Test Mode)

Use Stripe test cards: https://stripe.com/docs/testing

- [ ] **Test Card**: `4242 4242 4242 4242` (Visa, succeeds)
- [ ] **Expiry**: Any future date (e.g., 12/34)
- [ ] **CVC**: Any 3 digits (e.g., 123)

### Checkout Flow

- [ ] Click "Upgrade now" in sidebar → Redirects to billing page with `?upgrade=founders`
- [ ] Founders Deal CTA appears for free users
- [ ] Click "Claim Founders Deal" → Redirects to Stripe Checkout
- [ ] Complete checkout with test card
- [ ] Redirects back to `/billing?success=true`
- [ ] Subscription appears in billing page
- [ ] User plan updated in `user_profiles` table
- [ ] Invoice appears in invoice history

### Regular Upgrade

- [ ] Visit `/billing` as free user (without `?upgrade=founders`)
- [ ] Regular "Upgrade to Basic Plan" CTA appears
- [ ] Click upgrade → Stripe Checkout loads
- [ ] Complete purchase
- [ ] Verify subscription active

### Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid
```

Verify:
- [ ] `webhook_events` table receives events
- [ ] `billing_subscriptions` updated
- [ ] `billing_invoice_events` created
- [ ] User plan synced to `user_profiles`

### Subscription Management

- [ ] View subscription in billing page
- [ ] Update billing email
- [ ] Toggle auto-renew off (cancel at period end)
- [ ] Verify `cancel_at_period_end` set to true
- [ ] Check period end date displayed correctly

### Error Handling

- [ ] Test with declined card: `4000 0000 0000 0002`
- [ ] Verify error message shown
- [ ] Test with insufficient funds: `4000 0000 0000 9995`
- [ ] Verify graceful failure

---

## 🚀 Production Deployment Steps

### Pre-Launch Checklist

1. **Environment Variables**
   - [ ] Set `STRIPE_SECRET_KEY` to live key (starts with `sk_live_`)
   - [ ] Set `STRIPE_WEBHOOK_SECRET` to production webhook secret
   - [ ] Set `NEXT_PUBLIC_BASE_URL` to production domain
   - [ ] Verify all Supabase keys are production keys

2. **Stripe Dashboard**
   - [ ] Switch to **Live mode** (toggle in top left)
   - [ ] Create live products and prices (same as test mode)
   - [ ] Set up live webhook endpoint
   - [ ] Configure customer portal
   - [ ] Enable email receipts
   - [ ] Set up billing alerts

3. **Database**
   - [ ] Run migrations on production database
   - [ ] Seed `stripe_price_mappings` with live price IDs
   - [ ] Verify RLS policies on billing tables
   - [ ] Set up database backups

4. **Testing**
   - [ ] Test complete checkout flow in production
   - [ ] Verify webhook delivery (Stripe Dashboard → Webhooks → Logs)
   - [ ] Test subscription cancellation
   - [ ] Confirm email notifications working

### Post-Launch Monitoring

- [ ] Monitor webhook delivery success rate (target: >99%)
- [ ] Track failed payments and dunning
- [ ] Review subscription analytics weekly
- [ ] Monitor MRR and churn rate
- [ ] Set up alerts for payment failures

---

## 📊 Key Metrics to Track

### Revenue Metrics

- **MRR (Monthly Recurring Revenue)**: Total active subscriptions × monthly price
- **ARR (Annual Recurring Revenue)**: MRR × 12
- **ARPU (Average Revenue Per User)**: Total revenue / active users
- **LTV (Lifetime Value)**: ARPU × average customer lifetime

### Conversion Metrics

- **Checkout Started → Completed**: Track via `pricing_analytics` table
- **Free → Paid Conversion Rate**: % of free users who upgrade
- **Trial → Paid Conversion**: % of trials that convert

### Churn Metrics

- **Monthly Churn Rate**: Canceled subscriptions / total subscriptions
- **Revenue Churn**: Lost MRR / total MRR
- **Reactivation Rate**: Resubscribed / canceled users

### Operational Metrics

- **Payment Success Rate**: Successful charges / total attempts
- **Webhook Delivery Rate**: Successful webhooks / total sent
- **Avg. Resolution Time**: Time to resolve payment issues

---

## 🛠️ Troubleshooting

### Common Issues

#### Webhook Not Receiving Events

1. Check webhook URL is publicly accessible
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Check Stripe Dashboard → Webhooks → Logs for errors
4. Ensure endpoint returns 200 status code

#### Subscription Not Syncing

1. Check webhook event was received (`webhook_events` table)
2. Verify `user_id` in Stripe metadata
3. Check server logs for sync errors
4. Manually trigger sync via Stripe CLI

#### Checkout Fails

1. Verify price ID exists in Stripe
2. Check product is active
3. Ensure currency matches (USD)
4. Verify Stripe keys are correct (test vs live)

#### User Stuck on Free Plan

1. Check `billing_subscriptions` for active subscription
2. Verify webhook processed `checkout.session.completed`
3. Check `user_profiles.plan` field
4. Manually update plan if needed

---

## 📞 Support & Resources

### Stripe Documentation

- [Subscriptions Guide](https://stripe.com/docs/billing/subscriptions/overview)
- [Webhook Events](https://stripe.com/docs/api/events/types)
- [Testing Cards](https://stripe.com/docs/testing)
- [Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

### LexyHub Codebase

- **Stripe Client**: `src/lib/billing/stripe.ts`
- **Checkout API**: `src/app/api/billing/checkout/route.ts`
- **Direct Checkout**: `src/app/api/billing/checkout/direct/route.ts`
- **Webhook Handler**: `src/app/api/billing/webhook/route.ts`
- **Billing Page**: `src/app/(app)/billing/page.tsx`
- **Types**: `src/lib/billing/types.ts`

### Contact

For Stripe-related issues:
- Email: stripe-support@stripe.com
- Dashboard: https://dashboard.stripe.com/support

For LexyHub implementation questions:
- Check this documentation
- Review code comments
- Test in Stripe test mode first

---

## 🎉 Quick Start Summary

To get billing working in your environment:

1. **Get Stripe keys** from dashboard
2. **Set environment variables** in `.env`
3. **Create products** in Stripe Dashboard (or use existing prod IDs)
4. **Set up webhook** endpoint
5. **Seed price mappings** in database
6. **Test checkout flow** with test card
7. **Monitor webhooks** for successful delivery
8. **Launch** and track metrics!

---

*Last Updated: [Current Date]*
*Version: 1.0*
