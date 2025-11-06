# Stripe Setup Checklist - Quick Reference

## 📋 Pre-Launch Setup (30 minutes)

### Step 1: Get Stripe API Keys (5 min)

- [ ] Go to [Stripe Dashboard](https://dashboard.stripe.com)
- [ ] Navigate to **Developers → API keys**
- [ ] Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
- [ ] Save as `STRIPE_SECRET_KEY` in `.env`

### Step 2: Configure Environment Variables (2 min)

Add to your `.env` file:

```bash
# Required
STRIPE_SECRET_KEY=sk_test_xxxxx  # or sk_live_xxxxx for production
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # Get this in Step 3

# Already configured (verify these exist)
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-key
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your domain
```

### Step 3: Set Up Webhook (10 min)

- [ ] Go to **Stripe Dashboard → Developers → Webhooks**
- [ ] Click **"Add endpoint"**
- [ ] Enter URL: `https://yourdomain.com/api/billing/webhook`
  - For local testing: Use [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [ ] Select these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- [ ] Click **"Add endpoint"**
- [ ] Click endpoint → Reveal **"Signing secret"**
- [ ] Copy signing secret (starts with `whsec_`)
- [ ] Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Step 4: Verify Products Exist (5 min)

Go to **Stripe Dashboard → Products**. Verify these products exist:

#### Option A: Products Already Created (Current Setup)

- [ ] Product: **LexyHub Basic**
  - Product ID: `prod_TN8vhpBWYQwYlP`
  - Price ID: `price_1SQOdz3enLCiqy1O4KF74msU`

- [ ] Product: **LexyHub Basic - Founders Deal**
  - Product ID: `prod_TN9qqkccUMgqQX`
  - Price ID: `price_1SQPWO3enLCiqy1Oll2Lhd54`

#### Option B: Create New Products (If Needed)

If products don't exist, create them:

1. Click **"+ Add product"**
2. Fill in:
   - Name: "LexyHub Basic"
   - Description: "Essential tools for growing sellers"
3. Add pricing:
   - Model: Recurring
   - Price: $9.99/month (or your price)
   - Billing period: Monthly
4. Click **"Save product"**
5. Copy the **Price ID** (e.g., `price_xxxxx`)

Repeat for Founders Deal product.

### Step 5: Configure Database (5 min)

Run this SQL in your Supabase SQL Editor:

```sql
-- Insert price mappings for your products
INSERT INTO stripe_price_mappings
  (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  -- Regular Basic Plan
  ('basic', 'monthly', 'price_1SQOdz3enLCiqy1O4KF74msU', 'production', true),

  -- Founders Deal (annual)
  ('basic', 'annual', 'price_1SQPWO3enLCiqy1Oll2Lhd54', 'production', true)
ON CONFLICT DO NOTHING;

-- For test mode, add test price IDs:
INSERT INTO stripe_price_mappings
  (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  ('basic', 'monthly', 'price_test_xxxxx', 'test', true),
  ('basic', 'annual', 'price_test_xxxxx', 'test', true)
ON CONFLICT DO NOTHING;
```

**Note**: Replace `price_test_xxxxx` with actual test price IDs if using test mode.

### Step 6: Test the Integration (3 min)

- [ ] Start your dev server: `npm run dev`
- [ ] Login as a free user
- [ ] Navigate to `/billing`
- [ ] You should see:
  - ✅ Upgrade CTAs visible
  - ✅ "Upgrade to Basic Plan" button
- [ ] Click upgrade button
- [ ] Should redirect to Stripe Checkout
- [ ] Use test card: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g., 12/34)
  - CVC: 123
- [ ] Complete checkout
- [ ] Should redirect back to `/billing?success=true`
- [ ] Verify subscription appears on billing page

---

## 🚀 Production Launch Steps

When ready to go live:

### 1. Switch Stripe to Live Mode

- [ ] Toggle Stripe Dashboard from **Test** to **Live** mode (top left)
- [ ] Get **Live Secret Key** from API keys page
- [ ] Update `.env`: `STRIPE_SECRET_KEY=sk_live_xxxxx`

### 2. Create Live Products

- [ ] Create same products in Live mode
- [ ] Copy live Price IDs
- [ ] Update `stripe_price_mappings` table with `environment='production'`

### 3. Set Up Live Webhook

- [ ] Create new webhook endpoint (same URL, but in Live mode)
- [ ] Get new **Live Signing Secret**
- [ ] Update `.env`: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx` (live)

### 4. Update Environment Variables

- [ ] Set `NEXT_PUBLIC_BASE_URL=https://yourdomain.com`
- [ ] Restart your production server
- [ ] Verify all env vars loaded correctly

### 5. Final Testing

- [ ] Test with real card or Stripe test card in Live mode
- [ ] Verify webhook delivery in Stripe Dashboard
- [ ] Check subscription appears in database
- [ ] Confirm user plan updated

---

## 🧪 Local Testing with Stripe CLI

For testing webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

---

## 🔑 Quick Reference: Environment Variables

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Stripe API key | Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Dashboard → Developers → Webhooks → (your endpoint) |
| `NEXT_PUBLIC_BASE_URL` | Your app URL | Your domain or `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Supabase Dashboard → Settings → API |

---

## 📞 Quick Links

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Test Cards**: https://stripe.com/docs/testing
- **Webhook Docs**: https://stripe.com/docs/webhooks
- **Full Documentation**: See `STRIPE_IMPLEMENTATION.md`

---

## ✅ Completion Checklist

Mark these off as you complete each step:

**Setup:**
- [ ] Stripe API keys added to `.env`
- [ ] Webhook endpoint created and secret added
- [ ] Products exist in Stripe (or IDs confirmed)
- [ ] Database price mappings inserted
- [ ] Local test successful with test card

**Production:**
- [ ] Switched to Stripe Live mode
- [ ] Live API keys in production `.env`
- [ ] Live webhook configured
- [ ] Live products created
- [ ] Production test completed
- [ ] Monitoring set up (Stripe Dashboard webhooks)

**Post-Launch:**
- [ ] First real subscription processed successfully
- [ ] Webhook logs showing successful delivery
- [ ] Invoice appears in user's billing page
- [ ] Customer can manage subscription

---

## 🚨 Troubleshooting

### Webhook Not Working

```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/billing/webhook

# Check webhook logs in Stripe Dashboard
# Verify STRIPE_WEBHOOK_SECRET is correct
# Check your server logs for errors
```

### Checkout Not Loading

- Verify `STRIPE_SECRET_KEY` is correct
- Check product/price IDs exist in Stripe
- Ensure app is running and accessible
- Check browser console for errors

### Subscription Not Syncing

- Check `webhook_events` table for received events
- Verify `user_id` is in Stripe checkout metadata
- Check `billing_subscriptions` table
- Run webhook event manually via Stripe Dashboard

---

*Estimated Total Setup Time: ~30 minutes*
*For detailed information, see `STRIPE_IMPLEMENTATION.md`*
