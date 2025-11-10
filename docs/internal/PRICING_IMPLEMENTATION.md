# LexyHub Pricing Strategy Implementation

**Implementation Date:** November 6, 2025
**Branch:** `claude/lexyhub-pricing-implementation-011CUrNDd27MZaWQjAYrCrFd`

## Overview

This document describes the comprehensive pricing strategy implementation for LexyHub, including Free, Basic, Pro, and hidden Growth tiers with full Stripe integration, usage tracking, warnings, and upsell automation.

---

## 1. Database Schema Changes

### Migration: `0032_pricing_strategy_implementation.sql`

#### New/Updated Tables:

**`user_profiles` (enhanced)**
- Added `trial_expires_at` - Tracks trial expiration for paid tiers
- Added `extension_free_plus_expires_at` - Tracks 30-day extension boost

**`plan_limits`** - New table for pricing tier definitions
- Stores display information, pricing, features, and Stripe price IDs
- Includes `is_hidden` flag for Growth tier (not shown publicly)

**`plan_entitlements`** - Updated with new tier structure
- Free: 10 searches, 1 niche, 10 AI opportunities
- Basic ($6.99): 100 searches, 10 niches, 100 AI opportunities
- Pro ($12.99): 500 searches, 50 niches, 500 AI opportunities
- Growth ($24.99): Unlimited (-1 for all metrics)

**`usage_warnings`** - New table for tracking usage notifications
- Prevents spam by tracking when warnings were sent
- Tracks threshold levels (80%, 90%, 100%)

**`upsell_triggers`** - New table for Growth plan upsell funnel
- Tracks trigger events (quota_exceeded, feature_locked, heavy_usage, admin_offer)
- Monitors conversion funnel (shown, clicked, converted, dismissed)

**`pricing_analytics`** - New table for conversion tracking
- Events: page_view, tier_clicked, checkout_started, checkout_completed, checkout_abandoned
- UTM parameter tracking for attribution

**`stripe_price_mappings`** - New table for environment-specific price IDs
- Supports test/production environments
- Maps plan codes and billing cycles to Stripe price IDs

---

## 2. Pricing Tier Structure

### Tier Comparison

| Tier | Price (Monthly) | Price (Annual) | Searches | Niches | AI Ops | Storage | Visibility |
|------|----------------|----------------|----------|--------|--------|---------|------------|
| Free | $0 | $0 | 10 | 1 | 10 | 50 | Public |
| Basic | $6.99 | $69.90 | 100 | 10 | 100 | 500 | Public |
| Pro | $12.99 | $129.90 | 500 | 50 | 500 | 5,000 | Public |
| Growth | $24.99 | $249.90 | ∞ | ∞ | ∞ | ∞ | Hidden |

**Annual Savings:** ~17% discount on annual billing

---

## 3. Key Features Implemented

### A. Stripe Integration

#### Checkout Flow
- **API Route:** `/api/billing/checkout`
- Creates Stripe Checkout sessions with plan metadata
- Supports monthly/annual billing cycles
- Includes 7-day trial for Basic/Pro (no trial for Growth)
- Tracks checkout analytics automatically

#### Customer Portal
- **API Route:** `/api/billing/portal`
- Provides self-service subscription management
- Users can update payment methods, billing info, and cancel subscriptions

#### Webhook Handling (Enhanced)
- **API Route:** `/api/billing/webhook`
- **Events Handled:**
  - `checkout.session.completed` - Updates customer ID, tracks analytics
  - `customer.subscription.created/updated/deleted` - Syncs subscription status
  - `invoice.paid` - Records payment, triggers commission tracking
  - `invoice.payment_failed` - Records failed payment

#### Plan Inference
- Supports new plan codes (free, basic, pro, growth)
- Maintains backwards compatibility with legacy codes (spark, scale, apex)
- Uses metadata for reliable plan detection

---

### B. Usage Tracking & Warnings

#### Quota Enforcement
- **File:** `src/lib/billing/enforce.ts`
- Atomic RPC-based quota checks via PostgreSQL functions
- Automatic usage warnings at 80% and 90% thresholds
- Creates upsell triggers when limits are exceeded

#### Warning System
- **Thresholds:**
  - 80% - Yellow warning banner
  - 90% - Orange critical warning
  - 100% - Red blocked state with upgrade CTA

- **Features:**
  - De-duplication to prevent spam (one warning per threshold per period)
  - Async non-blocking implementation
  - Ready for email integration (TODO: email templates)

#### Usage Statistics API
- **File:** `src/lib/billing/usage.ts`
- `getUserUsageStats()` - Comprehensive usage analytics per user
- Returns used/limit/percentage/warning level for all quotas

---

### C. Chrome Extension Free+ Tier

#### Activation API
- **Route:** `/api/ext/activate-free-plus`
- **POST:** Activate 30-day Free+ boost for free users
- **GET:** Check current Free+ status

#### Boost Details
- **Duration:** 30 days from activation
- **Multiplier:** 2.5x on all limits
- **Applies to:** Free plan users only
- **Boosted Limits:**
  - Searches: 25/month (vs 10)
  - Niches: 3 (vs 1)
  - AI Opportunities: 25/month (vs 10)

#### UI Components
- **FreePlusIndicator** - Shows active boost status with countdown
- **FreePlusExpiredNotice** - Displays when boost expires

---

### D. Growth Plan Upsell System

#### Trigger Conditions
1. **Quota Exceeded** - Automatic when Pro user hits limits
2. **Feature Locked** - When interacting with Growth-only features
3. **Heavy Usage** - 90%+ usage on any quota
4. **Admin Offer** - Manually triggered by admins

#### Upsell Funnel Tracking
- **API Routes:**
  - `/api/billing/upsell/click` - Track CTA clicks
  - `/api/billing/upsell/dismiss` - Track dismissals

- **Database:** `upsell_triggers` table tracks full conversion funnel
- **Analytics:** Shows shown_at, clicked_at, converted_at, dismissed_at

#### UI Components
- **GrowthUpsellModal** - Full-featured modal with plan comparison
- Includes feature lists, pricing comparison, and sales CTA
- Dismissible with 7-day cooldown to prevent spam

#### Success Metric
- **Target:** 10% of Pro users upgrade to Growth within 90 days

---

### E. Pricing Page Redesign

#### Features
- **File:** `src/app/(app)/pricing/page.tsx`
- Monthly/Annual billing toggle with savings badge
- Responsive 3-column grid (shows only public tiers)
- Dynamic pricing from `plan_limits` config
- Direct links to checkout with plan/cycle parameters

#### Plan Cards
- Feature lists with checkmarks
- "Most Popular" badge on Basic tier
- Hover effects with shadow/scale transitions
- Mobile-responsive design

#### Growth Plan Teaser
- Dashed-border card below main tiers
- "Contact Sales" CTA for inquiries
- Highlights unlimited nature without revealing pricing

---

## 4. File Structure

### New Files Created

```
📁 Database
└── supabase/migrations/
    └── 0032_pricing_strategy_implementation.sql

📁 Types & Utilities
├── src/lib/billing/
│   ├── types.ts          # TypeScript types for billing system
│   ├── plans.ts          # Plan configurations and constants
│   └── usage.ts          # Enhanced usage tracking utilities

📁 API Routes
├── src/app/api/billing/
│   ├── checkout/route.ts          # Stripe checkout sessions
│   ├── portal/route.ts            # Customer portal access
│   └── upsell/
│       ├── click/route.ts         # Track upsell clicks
│       └── dismiss/route.ts       # Track upsell dismissals
└── src/app/api/ext/
    └── activate-free-plus/route.ts  # Extension boost activation

📁 UI Components
└── src/components/
    ├── billing/
    │   ├── UsageWarningBanner.tsx      # Usage limit warnings
    │   ├── GrowthUpsellModal.tsx       # Growth tier upsell modal
    │   └── FreePlusIndicator.tsx       # Extension boost indicator
    └── ui/
        └── alert.tsx                   # Alert component (new)

📁 Pages
└── src/app/(app)/
    └── pricing/page.tsx  # Redesigned pricing page
```

### Enhanced Files

```
src/lib/billing/
├── stripe.ts         # Added handleCheckoutCompleted, updated plan mappings
└── enforce.ts        # Added usage warnings and upsell triggers

src/app/api/billing/webhook/route.ts  # Added checkout.session.completed handler
```

---

## 5. Integration Points

### Stripe Configuration Required

**In Stripe Dashboard:**
1. Create products for Basic, Pro, Growth
2. Create prices for monthly and annual billing
3. Configure webhook endpoint: `https://yourdomain.com/api/billing/webhook`
4. Add webhook events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

**In Database:**
Update `stripe_price_mappings` table with actual Stripe price IDs:
```sql
UPDATE stripe_price_mappings
SET stripe_price_id = 'price_XXXXXXXXX'
WHERE plan_code = 'basic' AND billing_cycle = 'monthly';
-- Repeat for all plans and cycles
```

### Environment Variables

```env
# Already configured
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Base URL for redirects
NEXT_PUBLIC_BASE_URL=https://app.lexyhub.com
```

---

## 6. Usage Examples

### A. User Signs Up and Upgrades

```typescript
// 1. User clicks "Upgrade to Pro" on pricing page
// Link: /billing?plan=pro&cycle=monthly

// 2. Billing page calls checkout API
const response = await fetch('/api/billing/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: user.id,
    planCode: 'pro',
    billingCycle: 'monthly',
  }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe

// 3. Stripe webhook fires on successful payment
// - Updates user_profiles.stripe_customer_id
// - Creates billing_subscriptions record
// - Tracks pricing_analytics.checkout_completed
```

### B. User Approaches Limit

```typescript
// 1. User performs search
await useQuota(userId, 'searches', 1);

// 2. Quota enforcement checks usage
// If usage >= 80%, creates usage_warnings record
// If usage >= 100%, throws QuotaExceededError and creates upsell_trigger

// 3. Dashboard shows warning banner
<UsageWarningBanner
  quotaKey="searches"
  used={90}
  limit={100}
  percentage={90}
  warningLevel="critical"
  currentPlan="basic"
/>
```

### C. Pro User Sees Growth Upsell

```typescript
// 1. Check if user should see upsell
const shouldShow = await shouldShowGrowthUpsell(userId);

// 2. If true, show modal
<GrowthUpsellModal
  open={showUpsell}
  onOpenChange={setShowUpsell}
  triggerId={trigger.id}
  currentPlan="pro"
  onContactSales={() => window.location.href = 'mailto:sales@lexyhub.com'}
/>

// 3. Track interaction
// - Shown: automatic when modal opens
// - Clicked: when user clicks "Contact Sales"
// - Dismissed: when user clicks "Maybe Later"
```

### D. Extension User Activates Free+

```typescript
// 1. Extension calls activation API
const response = await fetch('/api/ext/activate-free-plus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId }),
});

const data = await response.json();
// { activated: true, expiresAt: '2025-12-06T...', daysRemaining: 30 }

// 2. Dashboard shows boost indicator
<FreePlusIndicator
  daysRemaining={28}
  expiresAt="2025-12-06T12:00:00Z"
/>

// 3. Quota enforcement uses boosted limits
// Free plan now gets 25 searches instead of 10
```

---

## 7. Admin Dashboard Integration

### Subscription Management Views (TODO - Phase 7)

Planned features for admin dashboard:
- List all user subscriptions with plan/status filters
- View individual user subscription details
- Manually adjust plan tier or grant trials
- Monitor usage metrics across all users
- Identify accounts nearing limits or trials ending
- Live application status monitoring

**Location:** `/admin/subscriptions` (to be created)

---

## 8. Email Notifications (TODO - Phase 8)

### Templates Needed

1. **Welcome Email (Free)**
   - Sent on signup
   - Highlights Free+ extension boost opportunity

2. **Upgrade Confirmation (Paid Tiers)**
   - Sent on successful checkout
   - Includes plan details, billing info, and next steps

3. **Usage Warning (80%)**
   - Sent when first hitting 80% threshold
   - Gentle reminder with upgrade suggestion

4. **Usage Critical (90%)**
   - Sent when hitting 90% threshold
   - Stronger upgrade recommendation

5. **Limit Reached (100%)**
   - Sent when quota exhausted
   - Clear CTA to upgrade

6. **Renewal Reminder**
   - 7 days before renewal
   - Confirms plan and billing amount

7. **Payment Failed**
   - Sent on failed payment
   - Instructions to update payment method

8. **Free+ Expiring Soon**
   - 3 days before Free+ expires
   - Encourage upgrade to retain higher limits

**Integration:** Email service (SendGrid, Postmark, or Resend) to be configured

---

## 9. Analytics & Reporting

### Pricing Analytics Table

Tracks full conversion funnel:
```sql
SELECT
  plan_code,
  billing_cycle,
  COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_type = 'checkout_started') as checkouts_started,
  COUNT(*) FILTER (WHERE event_type = 'checkout_completed') as checkouts_completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'checkout_completed') /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'checkout_started'), 0),
    2
  ) as conversion_rate
FROM pricing_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY plan_code, billing_cycle;
```

### Upsell Performance

```sql
SELECT
  trigger_type,
  COUNT(*) as total_triggers,
  COUNT(shown_at) as shown,
  COUNT(clicked_at) as clicked,
  COUNT(converted_at) as converted,
  COUNT(dismissed_at) as dismissed,
  ROUND(100.0 * COUNT(clicked_at) / NULLIF(COUNT(shown_at), 0), 2) as ctr,
  ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(shown_at), 0), 2) as conversion_rate
FROM upsell_triggers
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY trigger_type;
```

### MRR Calculation

```sql
SELECT
  SUM(
    CASE
      WHEN plan = 'basic' THEN 6.99
      WHEN plan = 'pro' THEN 12.99
      WHEN plan = 'growth' THEN 24.99
      ELSE 0
    END
  ) as mrr
FROM billing_subscriptions
WHERE status IN ('active', 'trialing');
```

---

## 10. Testing Checklist

### Stripe Integration
- [ ] Test checkout flow for each plan (Basic, Pro, Growth)
- [ ] Verify monthly vs annual pricing
- [ ] Confirm 7-day trial starts correctly
- [ ] Test webhook processing for all events
- [ ] Verify customer portal access and functionality

### Usage Tracking
- [ ] Test quota enforcement at each tier
- [ ] Verify 80% and 90% warnings fire once per period
- [ ] Confirm 100% blocking works
- [ ] Test upsell trigger creation

### Extension Free+
- [ ] Activate Free+ for free user
- [ ] Verify boosted limits apply
- [ ] Test expiration handling
- [ ] Confirm paid users cannot activate

### UI Components
- [ ] Test pricing page on mobile/tablet/desktop
- [ ] Verify monthly/annual toggle works
- [ ] Test usage warning banners at each level
- [ ] Test Growth upsell modal interactions

---

## 11. Security Considerations

### Implemented Safeguards
- ✅ Stripe webhook signature verification
- ✅ Server-side plan validation
- ✅ No client-side price tampering possible
- ✅ Atomic quota operations (RLS + RPC)
- ✅ User ID required for all billing operations
- ✅ No sensitive payment data stored locally

### GDPR Compliance
- User subscription data retained for billing purposes
- Users can cancel via Customer Portal
- Stripe manages PCI compliance for payment data
- Webhook events logged for audit trail

---

## 12. Next Steps

### Immediate (Post-Deployment)
1. **Configure Stripe Products and Prices**
   - Create products in Stripe Dashboard
   - Update `stripe_price_mappings` with real price IDs

2. **Run Database Migration**
   ```bash
   supabase migration up
   ```

3. **Test Stripe Webhooks**
   - Use Stripe CLI for local testing
   - Verify webhook endpoint in production

4. **Configure Email Service**
   - Set up SendGrid/Postmark/Resend
   - Create email templates
   - Add email sending to warning handlers

### Short-Term (Within 1 Week)
5. **Admin Dashboard Enhancement**
   - Build subscription management views
   - Add usage metrics dashboard
   - Move status page functionality

6. **Analytics Setup**
   - Create dashboards in PostHog/Amplitude
   - Set up MRR/ARR tracking
   - Monitor conversion funnels

7. **Documentation**
   - Update user-facing docs
   - Create upgrade guides
   - Document admin workflows

### Medium-Term (Within 1 Month)
8. **Growth Plan Optimization**
   - Analyze upsell trigger effectiveness
   - A/B test modal copy and design
   - Monitor 10% conversion target

9. **Email Automation**
   - Implement all email templates
   - Set up drip campaigns
   - Test email deliverability

10. **Feature Enhancements**
    - Add usage forecasting
    - Implement team/multi-user support for Growth
    - Build API access for Growth tier

---

## 13. Support & Troubleshooting

### Common Issues

**Issue:** Checkout session fails with "No Stripe price configured"
- **Solution:** Update `stripe_price_mappings` table with actual Stripe price IDs

**Issue:** Webhook signature verification fails
- **Solution:** Ensure `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard webhook secret

**Issue:** User not seeing updated plan after payment
- **Solution:** Check `billing_subscriptions` table and verify webhook processed successfully

**Issue:** Free+ not activating for user
- **Solution:** Verify user is on 'free' plan and check `extension_free_plus_expires_at` column

### Debug Queries

```sql
-- Check user's current plan and subscription
SELECT
  up.user_id,
  up.plan,
  up.extension_free_plus_expires_at,
  bs.status,
  bs.stripe_subscription_id,
  bs.current_period_end
FROM user_profiles up
LEFT JOIN billing_subscriptions bs ON bs.user_id = up.user_id
WHERE up.user_id = 'USER_UUID';

-- Check recent pricing analytics
SELECT * FROM pricing_analytics
ORDER BY created_at DESC
LIMIT 20;

-- Check active upsell triggers
SELECT * FROM upsell_triggers
WHERE shown_at IS NULL
  OR (dismissed_at IS NULL AND shown_at > NOW() - INTERVAL '7 days')
ORDER BY created_at DESC;
```

---

## 14. Credits

**Implementation:** Claude (Anthropic AI Assistant)
**Date:** November 6, 2025
**Scope:** Database schema, API routes, UI components, Stripe integration, usage tracking, upsell automation

**Technologies Used:**
- Next.js 14 (App Router)
- TypeScript
- Supabase (PostgreSQL + RLS)
- Stripe Checkout & Billing Portal
- Radix UI components
- TailwindCSS
