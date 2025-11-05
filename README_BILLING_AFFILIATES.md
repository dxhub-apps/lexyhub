# LexyHub Billing, Quotas & Affiliates Runbook

**Version:** 1.0
**Last Updated:** 2025-11-05

---

## Table of Contents

1. [Overview](#overview)
2. [Plan Enforcement](#plan-enforcement)
3. [Quota System](#quota-system)
4. [Affiliate Program](#affiliate-program)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

LexyHub implements a three-tier subscription model with monthly quota enforcement and an in-house affiliate program.

### Plans

| Plan | Price | Searches/mo | Niches Max | AI Opportunities/mo |
|------|-------|-------------|------------|---------------------|
| Free | $0 | 10 | 1 | 2 |
| Basic | $7 | 100 | 10 | 999 |
| Pro | $19 | ∞ | ∞ | ∞ |

### Key Features

- **Monthly quotas** enforced via atomic RPC
- **Stripe webhook** integration for subscription sync
- **Affiliate tracking** with 90-day cookie attribution
- **Commission automation** on invoice.paid events

---

## Plan Enforcement

### How It Works

1. User subscribes via Stripe
2. Webhook syncs subscription to `billing_subscriptions` table
3. Plan limits read from `plan_entitlements` table
4. Quota RPC enforces limits on each action

### Checking User Plan

```typescript
import { resolvePlanContext } from "@/lib/usage/quotas";

const context = await resolvePlanContext(userId);
console.log(context.plan); // "free" | "basic" | "pro"
console.log(context.limits);
```

### Overriding Limits

Manual overrides can be added to `plan_overrides` table:

```sql
INSERT INTO public.plan_overrides (user_id, plan, daily_query_limit, notes)
VALUES ('uuid-here', 'pro', NULL, 'VIP customer');
```

---

## Quota System

### Enforcing Quotas

Use the `useQuota()` function to check and increment usage:

```typescript
import { useQuota, QuotaExceededError } from "@/lib/billing/enforce";

try {
  const result = await useQuota(userId, "searches", 1);
  console.log(`Allowed: ${result.used}/${result.limit}`);
} catch (error) {
  if (error instanceof QuotaExceededError) {
    // Show paywall modal
    console.error(`Quota exceeded: ${error.used}/${error.limit}`);
  }
}
```

### Quota Keys

- `searches` — Keyword searches
- `ai_opportunities` — AI-generated suggestions
- `niches` — Active niche tracking slots

### Viewing Usage

```typescript
import { getCurrentUsage } from "@/lib/billing/enforce";

const usage = await getCurrentUsage(userId);
console.log(usage.searches); // { used: 7, limit: 10 }
```

### Monthly Reset

Quotas reset automatically on the 1st of each month. The `use_quota` RPC uses `date_trunc('month')` to determine the current period.

---

## Affiliate Program

### Registering an Affiliate

```sql
INSERT INTO public.affiliates (code, base_rate, lifetime, recur_months, cookie_days)
VALUES ('PARTNER2024', 0.30, false, 12, 90);
```

**Parameters:**
- `code` — Unique affiliate code (e.g., `PARTNER2024`)
- `base_rate` — Commission rate as decimal (0.30 = 30%)
- `lifetime` — If true, commissions apply forever
- `recur_months` — Months to credit commissions (if not lifetime)
- `cookie_days` — Attribution window (default 90)

### Tracking Flow

1. **Click Capture:**
   - User visits `https://lexyhub.com/?ref=PARTNER2024`
   - Middleware sets 90-day cookie
   - Click recorded in `affiliate_clicks`

2. **Referral Attribution:**
   - User signs up
   - Call `/api/affiliate/recordReferral` with `userId`
   - Referral created in `affiliate_referrals`

3. **Commission Recording:**
   - User's subscription invoice is paid
   - Webhook triggers `recordCommissionFromInvoice()`
   - Commission inserted into `commissions` table

### Example: Recording Referral at Signup

```typescript
// In your signup flow (after user creation)
await fetch("/api/affiliate/recordReferral", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: newUser.id }),
});
```

### Commission Calculation

```
basis_cents = invoice.subtotal - invoice.total_discount_amounts
amount_cents = floor(basis_cents * affiliate.base_rate)
```

**Excludes:** Taxes (commission based on subtotal - discounts only)

### Viewing Commissions

```sql
SELECT
  a.code,
  c.stripe_invoice_id,
  c.amount_cents,
  c.status
FROM public.commissions c
JOIN public.affiliates a ON a.id = c.affiliate_id
WHERE c.status = 'pending'
ORDER BY c.created_at DESC;
```

---

## API Reference

### `/api/billing/usage`

**GET** — Get current monthly usage

**Query Params:**
- `userId` (required)

**Response:**
```json
{
  "usage": {
    "searches": { "used": 7, "limit": 10 },
    "ai_opportunities": { "used": 1, "limit": 2 },
    "niches": { "used": 1, "limit": 1 }
  }
}
```

### `/api/affiliate/click`

**POST** — Record affiliate click (called by middleware)

**Body:**
```json
{
  "ref": "PARTNER2024",
  "path": "/",
  "utm": { "utm_source": "twitter" }
}
```

### `/api/affiliate/recordReferral`

**POST** — Create referral attribution

**Body:**
```json
{
  "userId": "uuid-here"
}
```

**Response:**
```json
{
  "ok": true,
  "affiliate": "PARTNER2024",
  "expires_at": "2026-11-05T00:00:00Z"
}
```

### `/api/billing/webhook`

**POST** — Stripe webhook handler

**Handles:**
- `customer.subscription.created|updated|deleted` → sync subscription
- `invoice.paid` → record invoice + commission
- `invoice.payment_failed` → record invoice

---

## Database Schema

### Core Tables

**`plan_entitlements`**
- Defines quota limits per plan tier

**`usage_counters`**
- Tracks monthly usage per user
- Primary key: `(user_id, period_start, key)`

**`affiliates`**
- Registered affiliate partners

**`affiliate_clicks`**
- Click tracking for analytics

**`affiliate_referrals`**
- User → affiliate attribution

**`commissions`**
- Commission records (unique on `stripe_invoice_id`)

### RPC Function

**`use_quota(p_user uuid, p_key text, p_amount int)`**

Returns:
```sql
(allowed boolean, used int, limit int)
```

**Usage:**
```sql
SELECT * FROM public.use_quota('uuid-here', 'searches', 1);
-- Returns: (true, 8, 10) if allowed
-- Returns: (false, 10, 10) if quota exceeded
```

---

## Common Operations

### 1. Create a Test Affiliate

```sql
INSERT INTO public.affiliates (code, base_rate, status)
VALUES ('TEST2024', 0.25, 'active')
RETURNING *;
```

### 2. Manually Attribute a Referral

```sql
INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, ref_code)
VALUES (
  (SELECT id FROM public.affiliates WHERE code = 'TEST2024'),
  'user-uuid-here',
  'TEST2024'
);
```

### 3. Check User's Current Quota

```sql
SELECT
  key,
  value AS used,
  (
    SELECT CASE
      WHEN key = 'searches' THEN searches_per_month
      WHEN key = 'ai_opportunities' THEN ai_opportunities_per_month
      WHEN key = 'niches' THEN niches_max
    END
    FROM public.plan_entitlements
    WHERE plan_code = (
      SELECT plan FROM public.user_profiles WHERE user_id = uc.user_id
    )
  ) AS limit
FROM public.usage_counters uc
WHERE user_id = 'user-uuid-here'
  AND period_start = date_trunc('month', now())::date;
```

### 4. Reset User's Quota (Emergency)

```sql
UPDATE public.usage_counters
SET value = 0
WHERE user_id = 'user-uuid-here'
  AND period_start = date_trunc('month', now())::date;
```

### 5. View Pending Commissions

```sql
SELECT
  a.code AS affiliate,
  COUNT(*) AS pending_count,
  SUM(c.amount_cents) AS total_cents
FROM public.commissions c
JOIN public.affiliates a ON a.id = c.affiliate_id
WHERE c.status = 'pending'
GROUP BY a.code;
```

---

## Troubleshooting

### Issue: Quota not resetting on 1st of month

**Cause:** User cached old quota data

**Fix:**
1. Check `usage_counters` for correct `period_start`
2. Verify RPC uses `date_trunc('month', now())`
3. Reload user session

### Issue: Commission not recorded for paid invoice

**Checklist:**
1. Does referral exist in `affiliate_referrals`?
2. Is referral expired (`expires_at < now()`)?
3. Is affiliate status `active`?
4. Check webhook logs in `webhook_events` table
5. Verify `stripe_subscription_id` maps to `user_id` in `billing_subscriptions`

**Debug Query:**
```sql
SELECT
  i.stripe_invoice_id,
  bs.user_id,
  ar.id AS referral_id,
  ar.expires_at
FROM public.billing_invoice_events i
LEFT JOIN public.billing_subscriptions bs ON bs.stripe_subscription_id = i.metadata->>'subscription'
LEFT JOIN public.affiliate_referrals ar ON ar.referred_user_id = bs.user_id
WHERE i.stripe_invoice_id = 'in_xxx';
```

### Issue: Duplicate commissions on webhook retry

**Expected:** Should not happen due to unique constraint on `stripe_invoice_id`

**If duplicates exist:**
```sql
-- Find duplicates
SELECT stripe_invoice_id, COUNT(*)
FROM public.commissions
GROUP BY stripe_invoice_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keep oldest)
DELETE FROM public.commissions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.commissions
  GROUP BY stripe_invoice_id
);
```

### Issue: User sees "Quota exceeded" but has valid subscription

**Possible causes:**
1. Subscription not synced (check `billing_subscriptions.status`)
2. Plan entitlement missing (check `plan_entitlements` for their plan)
3. Cached plan in `user_profiles` out of date

**Fix:**
```sql
-- Force sync user plan from subscription
UPDATE public.user_profiles
SET plan = (
  SELECT plan
  FROM public.billing_subscriptions
  WHERE user_id = user_profiles.user_id
    AND status = 'active'
  ORDER BY current_period_end DESC
  LIMIT 1
)
WHERE user_id = 'user-uuid-here';
```

---

## Testing Checklist

### Quotas

- [ ] Free user hits 10 searches → 11th blocked
- [ ] Basic user lifts to 100 after upgrade
- [ ] Pro user has ∞ limits
- [ ] Monthly reset on 1st works correctly

### Affiliates

- [ ] Visit `/?ref=CODE` sets cookie
- [ ] Click recorded in `affiliate_clicks`
- [ ] Signup creates referral
- [ ] Paid invoice creates commission
- [ ] Webhook retry does NOT duplicate commission

### UI

- [ ] Usage chips display on profile page
- [ ] Pricing page shows correct plans
- [ ] Paywall modal triggers on quota exceeded

---

## Support Contacts

- **Technical Issues:** dev@lexyhub.com
- **Affiliate Inquiries:** affiliates@lexyhub.com
- **Billing Questions:** billing@lexyhub.com

---

**End of Runbook**
