# Stripe Variables & Configuration Reference

## 🔐 Environment Variables

### Stripe Configuration

```bash
# Stripe Secret Key (REQUIRED)
# Location: Stripe Dashboard → Developers → API keys
# Test: sk_test_51xxxxx...
# Live: sk_live_51xxxxx...
STRIPE_SECRET_KEY=sk_test_51xxxxx

# Webhook Signing Secret (REQUIRED for webhooks)
# Location: Stripe Dashboard → Developers → Webhooks → (endpoint) → Signing secret
# Test: whsec_xxxxx
# Live: whsec_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Application Configuration

```bash
# Base URL for redirect URLs in Stripe checkout
# Development: http://localhost:3000
# Production: https://yourdomain.com
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase Configuration (for database access)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 💳 Stripe Product & Price IDs

### Current Products in Stripe

#### Product 1: LexyHub Basic (Regular Monthly)
```
Product ID:  prod_TN8vhpBWYQwYlP
Price ID:    price_1SQOdz3enLCiqy1O4KF74msU
Billing:     Monthly
Amount:      $9.99/month (verify in Stripe Dashboard)
Description: Essential tools for growing sellers
```

#### Product 2: LexyHub Basic - Founders Deal
```
Product ID:  prod_TN9qqkccUMgqQX
Price ID:    price_1SQPWO3enLCiqy1Oll2Lhd54
Billing:     Annual
Amount:      $39/year
Description: Limited time founders offer
```

### Where These IDs Are Used

| Price ID | Used In | Purpose |
|----------|---------|---------|
| `price_1SQOdz3enLCiqy1O4KF74msU` | Billing page "Upgrade to Basic Plan" button | Regular subscription upgrade |
| `price_1SQPWO3enLCiqy1Oll2Lhd54` | Sidebar Founders Deal + Billing page special offer | Promotional pricing |

---

## 📊 Database Configuration

### Table: `stripe_price_mappings`

This table maps plan codes to Stripe price IDs by environment.

#### Example Records

```sql
-- Production mappings
INSERT INTO stripe_price_mappings
  (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  ('basic', 'monthly', 'price_1SQOdz3enLCiqy1O4KF74msU', 'production', true),
  ('basic', 'annual', 'price_1SQPWO3enLCiqy1Oll2Lhd54', 'production', true),
  ('pro', 'monthly', 'price_xxxxx', 'production', true),
  ('pro', 'annual', 'price_xxxxx', 'production', true),
  ('growth', 'monthly', 'price_xxxxx', 'production', true),
  ('growth', 'annual', 'price_xxxxx', 'production', true);

-- Test mappings (for development)
INSERT INTO stripe_price_mappings
  (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  ('basic', 'monthly', 'price_test_xxxxx', 'test', true),
  ('basic', 'annual', 'price_test_xxxxx', 'test', true);
```

### Schema Details

```sql
CREATE TABLE stripe_price_mappings (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) NOT NULL,           -- 'basic', 'pro', 'growth'
  billing_cycle VARCHAR(20) NOT NULL,       -- 'monthly', 'annual'
  stripe_price_id VARCHAR(255) NOT NULL,    -- 'price_xxxxx'
  environment VARCHAR(20) NOT NULL,          -- 'test', 'production'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan_code, billing_cycle, environment)
);
```

---

## 🔗 API Endpoints

### Checkout Endpoints

#### 1. Standard Checkout (Plan-based)
```
POST /api/billing/checkout
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "planCode": "basic",
  "billingCycle": "monthly",
  "successUrl": "https://yourdomain.com/billing?success=true",
  "cancelUrl": "https://yourdomain.com/billing?canceled=true"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxxxx",
  "customerId": "cus_xxxxx"
}
```

**Usage:** Standard upgrade flow using plan configuration from database.

---

#### 2. Direct Checkout (Price ID-based)
```
POST /api/billing/checkout/direct
```

**Request Body:**
```json
{
  "userId": "user-uuid",
  "priceId": "price_1SQPWO3enLCiqy1Oll2Lhd54",
  "planName": "Basic Plan (Founders Deal)",
  "successUrl": "https://yourdomain.com/billing?success=true",
  "cancelUrl": "https://yourdomain.com/billing?canceled=true"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/c/pay/cs_test_xxxxx",
  "customerId": "cus_xxxxx"
}
```

**Usage:** Special promotions, direct price ID checkout (e.g., Founders Deal).

---

### Subscription Management

#### Get Subscription
```
GET /api/billing/subscription?userId={userId}
```

**Response:**
```json
{
  "subscription": {
    "plan": "basic",
    "status": "active",
    "current_period_end": "2025-12-01T00:00:00Z",
    "cancel_at_period_end": false,
    "metadata": {},
    "stripe_subscription_id": "sub_xxxxx"
  },
  "invoices": [
    {
      "stripe_invoice_id": "in_xxxxx",
      "invoice_date": "2025-11-01T00:00:00Z",
      "amount_paid_cents": 999,
      "status": "paid"
    }
  ],
  "profile": {
    "plan": "basic",
    "momentum": "active",
    "settings": {}
  }
}
```

---

#### Update Subscription
```
PATCH /api/billing/subscription?userId={userId}
```

**Request Body:**
```json
{
  "plan": "basic",
  "billingEmail": "billing@example.com",
  "autoRenew": true,
  "paymentMethod": "Visa ending in 4242"
}
```

**Response:**
```json
{
  "status": "updated"
}
```

---

### Webhook Endpoint

```
POST /api/billing/webhook
```

**Headers:**
```
Stripe-Signature: t=xxxxx,v1=xxxxx
```

**Handled Events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Response:**
```json
{
  "received": true
}
```

---

## 🎨 UI Components

### Sidebar CTA

**File:** `src/components/layout/Sidebar.tsx`

**Configuration:**
```tsx
// Links to billing page with upgrade parameter
<Link href="/billing?upgrade=founders">
  Upgrade now →
</Link>
```

**When Shown:**
- Always visible in sidebar (when not collapsed)
- For all users (free and paid)

---

### Billing Page CTAs

**File:** `src/app/(app)/billing/page.tsx`

#### Founders Deal CTA

**When Shown:**
- URL contains `?upgrade=founders`
- User is on free or spark plan
- `currentPlan === "free" || currentPlan === "spark"`

**Price ID Used:**
```tsx
handleUpgradeClick('price_1SQPWO3enLCiqy1Oll2Lhd54', 'Basic Plan (Founders Deal)')
```

---

#### Regular Basic Plan CTA

**When Shown:**
- User is on free or spark plan
- URL does NOT contain `?upgrade=founders`

**Price ID Used:**
```tsx
handleUpgradeClick('price_1SQOdz3enLCiqy1O4KF74msU', 'Basic Plan')
```

---

## 🗺️ User Flow

### Flow 1: Founders Deal (from Sidebar)

```
1. User clicks "Upgrade now →" in sidebar
   ↓
2. Redirects to /billing?upgrade=founders
   ↓
3. Shows Founders Deal CTA with special pricing
   ↓
4. User clicks "Claim Founders Deal - $39/year"
   ↓
5. Calls POST /api/billing/checkout/direct
   with priceId: price_1SQPWO3enLCiqy1Oll2Lhd54
   ↓
6. Redirects to Stripe Checkout
   ↓
7. User completes payment
   ↓
8. Stripe webhook: checkout.session.completed
   ↓
9. Syncs subscription to database
   ↓
10. Redirects to /billing?success=true
    ↓
11. Shows updated subscription status
```

---

### Flow 2: Regular Upgrade (from Billing Page)

```
1. User visits /billing
   ↓
2. Shows "Upgrade to Basic Plan" CTA (if free user)
   ↓
3. User clicks upgrade button
   ↓
4. Calls POST /api/billing/checkout/direct
   with priceId: price_1SQOdz3enLCiqy1O4KF74msU
   ↓
5. Redirects to Stripe Checkout
   ↓
6. User completes payment
   ↓
7. Stripe webhook: checkout.session.completed
   ↓
8. Syncs subscription to database
   ↓
9. Redirects to /billing?success=true
   ↓
10. Shows updated subscription status
```

---

## 📝 Metadata Structure

### Checkout Session Metadata

```javascript
{
  user_id: "uuid",           // User UUID from Supabase
  userId: "uuid",            // Duplicate for compatibility
  plan: "basic",             // Plan code
  plan_name: "Basic Plan",   // Display name
  price_id: "price_xxxxx",   // Stripe price ID used
  billing_cycle: "annual"    // monthly or annual
}
```

### Subscription Metadata

```javascript
{
  user_id: "uuid",
  userId: "uuid",
  plan: "basic",
  plan_name: "Basic Plan",
  price_id: "price_xxxxx"
}
```

---

## 🧪 Test Data

### Stripe Test Cards

| Card Number | Type | Result |
|-------------|------|--------|
| `4242 4242 4242 4242` | Visa | Succeeds |
| `4000 0000 0000 0002` | Visa | Card declined |
| `4000 0000 0000 9995` | Visa | Insufficient funds |
| `4000 0082 6000 0000` | Visa | 3D Secure required |

**All test cards:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## 📍 File Locations

### Backend Files

| File | Purpose |
|------|---------|
| `src/lib/billing/stripe.ts` | Stripe client and sync functions |
| `src/lib/billing/types.ts` | TypeScript types and utilities |
| `src/lib/billing/plans.ts` | Plan configuration |
| `src/app/api/billing/checkout/route.ts` | Standard checkout API |
| `src/app/api/billing/checkout/direct/route.ts` | Direct price ID checkout API |
| `src/app/api/billing/webhook/route.ts` | Webhook handler |
| `src/app/api/billing/subscription/route.ts` | Subscription management API |
| `src/lib/env.ts` | Environment variable validation |

### Frontend Files

| File | Purpose |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Sidebar with Founders Deal CTA |
| `src/app/(app)/billing/page.tsx` | Billing page with upgrade CTAs |
| `src/components/billing/UsageChip.tsx` | Usage display component |

### Documentation

| File | Purpose |
|------|---------|
| `STRIPE_IMPLEMENTATION.md` | Complete implementation docs |
| `STRIPE_SETUP_CHECKLIST.md` | Quick setup guide |
| `STRIPE_VARIABLES_REFERENCE.md` | This file - all variables & config |

---

## 🔄 Sync Behavior

### When Subscription Changes

1. **Stripe Event Occurs** (e.g., subscription updated)
2. **Webhook Fired** to `/api/billing/webhook`
3. **Event Verified** using `STRIPE_WEBHOOK_SECRET`
4. **Event Logged** to `webhook_events` table
5. **Subscription Synced**:
   - Updates `billing_subscriptions` table
   - Updates `user_profiles.plan` field
   - Records invoice in `billing_invoice_events`
   - Logs to `plan_overrides` table

### Data Flow

```
Stripe → Webhook → Verify → Parse → Sync → Database
                                        ↓
                              Update User Profile
                                        ↓
                              Record Analytics
```

---

## 🎯 Plan Hierarchy

```
free (0)     - Free tier, limited features
   ↓
basic (1)    - $9.99/mo or $39/year (Founders)
   ↓
pro (2)      - Higher limits, more features
   ↓
growth (3)   - Unlimited usage, all features
```

**Upgrade Logic:**
- User can upgrade from any tier to a higher tier
- Downgrades require manual handling or customer portal
- Free users see upgrade CTAs
- Paid users see subscription management

---

*This reference document contains all variables, IDs, and configuration needed for the Stripe integration.*
