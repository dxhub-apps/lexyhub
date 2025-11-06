# LexyHub Billing & Affiliates Audit

**Date:** 2025-11-05
**Purpose:** Pre-implementation audit for plan enforcement, quotas, and affiliates v1

---

## Executive Summary

LexyHub has a **solid foundation** for billing and usage tracking. Stripe integration is functional, subscription syncing works, and a basic quota system exists. However, to meet the new requirements (free/$7/$19 plans, monthly quotas, affiliates), we need **targeted additions** rather than a complete rebuild.

**Approach:** Extend, don't replace. We'll add new tables for affiliates, refine quota logic for monthly periods, and integrate commission tracking into the existing webhook flow.

---

## 1. Existing Billing Infrastructure

### ✅ What Works
| Component | Status | Location |
|-----------|--------|----------|
| Stripe Client | ✅ Configured | `/src/lib/billing/stripe.ts` |
| Webhook Handler | ✅ Active | `/src/app/api/billing/webhook/route.ts` |
| Subscription Sync | ✅ Working | `syncSubscription()` in stripe.ts |
| Invoice Recording | ✅ Working | `recordInvoice()` in stripe.ts |
| DB Tables | ✅ Exist | `billing_subscriptions`, `billing_invoice_events` |
| User Profiles | ✅ With `plan` field | `user_profiles.plan` |

### ⚠️ Current vs Target Plans
| Current Plans | Target Plans | Action Needed |
|---------------|--------------|---------------|
| spark, scale, apex | free, basic, pro | **Add mapping or migrate** |
| No pricing info in code | $0, $7/mo, $19/mo | **Document in pricing page** |

**Decision:** We'll support both naming schemes. Add `plan_entitlements` table with free/basic/pro as canonical, and map existing spark→basic, scale→pro in code.

---

## 2. Existing Quota System

### ✅ What Exists
- **File:** `/src/lib/usage/quotas.ts`
- **Functions:** `assertQuota()`, `recordUsage()`, `resolvePlanContext()`
- **Tables:** `usage_events`, `plan_overrides`
- **Current Limits:**
  - Free: 25 daily queries, 10 AI suggestions
  - Growth: 100 daily queries, 60 AI suggestions
  - Scale: 500 daily queries, 250 AI suggestions

### ⚠️ Gaps vs Requirements
| Required Quota | Current Implementation | Gap |
|----------------|------------------------|-----|
| `searches_per_month` | `dailyQueryLimit` (daily) | **Need monthly period tracking** |
| `ai_opportunities_per_month` | `aiSuggestionLimit` (daily) | **Need monthly period tracking** |
| `niches_max` | ❌ Not tracked | **Need niche counter** |
| Monthly reset | Daily window | **Change to monthly periods** |

### Target Quotas (from spec)
```
free:  10 searches/mo, 1 niche max, 2 AI opportunities/mo
basic: 100 searches/mo, 10 niches max, 999 AI opportunities/mo
pro:   unlimited (-1) for all
```

**Decision:** Create `usage_counters` table with `(user_id, period_start, key, value)` for monthly tracking. Keep existing `usage_events` for audit trail.

---

## 3. Affiliates System

### ❌ Current State
**No affiliate infrastructure exists.** Clean slate for implementation.

### 📋 What We Need
1. **Middleware:** Capture `?ref=CODE` and set 90-day cookie
2. **Tables:**
   - `affiliates` (code, rates, status)
   - `affiliate_clicks` (tracking)
   - `affiliate_referrals` (user attribution)
   - `commissions` (invoice-based payouts)
   - `payouts` + `payout_items` (batch processing)
3. **API Routes:**
   - `/api/affiliate/click` (record visit)
   - `/api/affiliate/recordReferral` (at signup)
4. **Webhook Integration:** Trigger commission on `invoice.paid`

**Decision:** Full greenfield implementation as specified in requirements.

---

## 4. Database Conflicts & Dependencies

### Existing Tables to Preserve
- ✅ `billing_subscriptions` — keep as-is, will join with new logic
- ✅ `user_profiles` — keep `plan` field, use for fallback
- ✅ `usage_events` — keep for audit trail
- ✅ `plan_overrides` — keep for manual adjustments

### New Tables to Add
1. `plan_entitlements` (free/basic/pro → limits)
2. `usage_counters` (monthly quota tracking)
3. `affiliates`, `affiliate_clicks`, `affiliate_referrals`
4. `commissions`, `payouts`, `payout_items`

### Migration Strategy
- **Migration 0022:** Create entitlements + usage_counters
- **Migration 0023:** Create affiliate tables
- **Migration 0024:** Add `use_quota()` RPC for atomic increment

**No destructive changes needed.** All migrations are additive.

---

## 5. Stripe Integration Points

### Current Webhook Events Handled
```typescript
// /src/app/api/billing/webhook/route.ts
switch (event.type) {
  case "customer.subscription.created":
  case "customer.subscription.updated":
  case "customer.subscription.deleted":
    await syncSubscription(event.data.object);
    break;
  case "invoice.paid":
  case "invoice.payment_failed":
    await recordInvoice(event.data.object);
    break;
}
```

### ✅ What's Good
- Webhook signature verification working
- Subscription sync updates `billing_subscriptions` and `user_profiles`
- Invoice events logged to `billing_invoice_events`

### 🔧 What to Add
**On `invoice.paid`:**
```typescript
case "invoice.paid":
  await recordInvoice(event.data.object);
  await recordCommissionFromInvoice(event.data.object); // NEW
  break;
```

**Logic:** Check if subscription → user has referral → create commission row (idempotent on `stripe_invoice_id` unique constraint).

---

## 6. Middleware Current State

**File:** `/src/middleware.ts`

**Current Responsibilities:**
- Auth check (redirect to /login)
- Admin route protection
- Session refresh

**✅ Structure is good.** No conflicts with adding affiliate tracking.

**Action:** Add ref cookie logic BEFORE auth checks (so it works for logged-out visitors).

---

## 7. UI/UX Touchpoints

### Profile/Billing Page
**File:** `/src/app/(app)/profile/page.tsx`

**Current Display:**
- Plan: spark/scale/apex
- Subscription status
- Invoice history
- Billing email, auto-renew toggle

**Needed:**
- Show usage chips: "Searches: 7/10" or "Searches: 45/∞"
- Display for niches: "Niches: 1/1"
- Link to pricing page on quota exceeded

### Pricing Page
**Status:** ❌ No `/pricing` route found

**Action:** Create `/src/app/(app)/pricing/page.tsx` with:
- Free: $0 (internal/limited)
- Basic: $7/mo (100 searches, 10 niches, 999 AI ops)
- Pro: $19/mo (unlimited)
- "Ask about Growth+" text link to contact

### Paywall Modal
**Status:** ❌ Does not exist

**Action:** Create `/src/components/billing/PaywallModal.tsx` that triggers on `QuotaError` with upgrade CTA.

---

## 8. Security & Idempotency

### ✅ Good Practices Already in Place
- Webhook signature verification
- Unique constraints on `stripe_subscription_id` and `stripe_invoice_id`
- Server-side Supabase client (no client leakage)

### 🔒 Additional Safeguards Needed
1. **Commission idempotency:** Rely on unique `stripe_invoice_id` in `commissions` table
2. **Self-referral prevention:** Future enhancement (email/IP checks in `affiliate_referrals` logic)
3. **Cookie security:** Use `httpOnly`, `secure` in production, 90-day expiry

---

## 9. Testing Checklist

### Quotas
- [ ] Free user hits 10 searches → 11th fails with `quota_exceeded`
- [ ] Basic upgrade → searches lift to 100
- [ ] Pro → returns ∞, never blocks
- [ ] Monthly period resets on 1st of month

### Affiliates
- [ ] Visit `/?ref=PARTNER` → cookie set + click recorded
- [ ] Signup with cookie → referral created
- [ ] Subscription invoice paid → commission row created
- [ ] Duplicate webhook delivery → no duplicate commission (idempotent)

### Billing
- [ ] Stripe sync updates `billing_subscriptions` and `plan_entitlements` apply
- [ ] Profile page shows current usage

---

## 10. Minimal Change Plan

### Phase 1: Database Schema (Migrations)
1. **0022_entitlements_and_usage.sql**
   - Create `plan_entitlements` with free/basic/pro limits
   - Create `usage_counters` for monthly tracking
   - Seed entitlements

2. **0023_affiliates_core.sql**
   - Create `affiliates`, `affiliate_clicks`, `affiliate_referrals`
   - Create `commissions`, `payouts`, `payout_items`

3. **0024_quota_rpc.sql**
   - Create `use_quota(user, key, amount)` function for atomic increment

### Phase 2: Backend Logic
1. **Update `/src/middleware.ts`**
   - Add affiliate cookie capture

2. **Create `/src/lib/billing/enforce.ts`**
   - Export `useQuota()` that calls RPC

3. **Create `/src/lib/billing/affiliates.ts`**
   - Export `recordCommissionFromInvoice()`

4. **Create `/src/lib/db/helpers.ts`**
   - DB query helpers for affiliates

5. **Update `/src/app/api/billing/webhook/route.ts`**
   - Add commission recording on `invoice.paid`

6. **Create API routes:**
   - `/src/app/api/affiliate/click/route.ts`
   - `/src/app/api/affiliate/recordReferral/route.ts`

### Phase 3: Frontend & UX
1. **Update `/src/app/(app)/profile/page.tsx`**
   - Add usage display chips

2. **Create `/src/app/(app)/pricing/page.tsx`**
   - Display free/basic/pro plans with pricing

3. **Create `/src/components/billing/PaywallModal.tsx`**
   - Upgrade CTA on quota error

4. **Create `/src/components/billing/UsageChip.tsx`**
   - Reusable usage display component

### Phase 4: Documentation & Testing
1. **Create `README_BILLING_AFFILIATES.md`**
   - Runbook for quota usage, referral recording, commission posting

2. **Manual testing checklist**
   - Quota enforcement
   - Affiliate flow
   - Commission creation

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Plan name mismatch breaks UI | Medium | Low | Support both spark/basic, scale/pro in code |
| Monthly quota reset timing issues | Low | Medium | Use `date_trunc('month')` for consistency |
| Duplicate commissions from webhook retries | Low | High | Unique constraint on `stripe_invoice_id` |
| Affiliate cookie conflicts with existing auth | Low | Low | Separate cookie name `aff_ref` |
| User confusion on plan limits | Medium | Medium | Clear UI messaging, paywall modal |

---

## 12. Go/No-Go Decision

### ✅ GREEN LIGHT TO PROCEED

**Reasoning:**
- No breaking changes to existing flows
- All migrations are additive
- Stripe integration is stable and well-structured
- Quota system can be extended cleanly
- Affiliates is greenfield (no legacy conflicts)

**Estimated Implementation Time:** 4-6 hours for production-ready PR

**Dependencies:** None. All work can proceed immediately.

---

## Appendix: File Inventory

### Billing & Stripe
- `/src/lib/billing/stripe.ts` — Stripe client, subscription sync, invoice recording
- `/src/app/api/billing/webhook/route.ts` — Webhook handler
- `/src/app/api/billing/subscription/route.ts` — Subscription API
- `/supabase/migrations/0004_billing_and_api.sql` — Billing tables

### Quotas
- `/src/lib/usage/quotas.ts` — Existing quota logic (daily)
- `/supabase/migrations/0002_watchlists_and_usage.sql` — usage_events table

### Middleware
- `/src/middleware.ts` — Auth & routing middleware

### UI
- `/src/app/(app)/profile/page.tsx` — Profile & billing page

### To Be Created
- `/supabase/migrations/0022_entitlements_and_usage.sql`
- `/supabase/migrations/0023_affiliates_core.sql`
- `/supabase/migrations/0024_quota_rpc.sql`
- `/src/lib/billing/enforce.ts`
- `/src/lib/billing/affiliates.ts`
- `/src/lib/db/helpers.ts`
- `/src/app/api/affiliate/click/route.ts`
- `/src/app/api/affiliate/recordReferral/route.ts`
- `/src/app/(app)/pricing/page.tsx`
- `/src/components/billing/PaywallModal.tsx`
- `/src/components/billing/UsageChip.tsx`
- `/README_BILLING_AFFILIATES.md`

---

**Status:** Audit complete. Ready for implementation. ✅
