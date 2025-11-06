# Landing Page Integration Guide

This guide explains how to integrate checkout from your landing page (lexyhub.com) with your app (app.lexyhub.com).

## Overview

The integration allows users to:
1. Browse plans on lexyhub.com
2. Click a "Get Started" or "Upgrade" button
3. Complete Stripe checkout
4. Be redirected to app.lexyhub.com to complete signup/login

## Setup Steps

### 1. Configure Stripe Price IDs

First, ensure your Pro plan Stripe price IDs are configured:

**Option A: Using Environment Variables (Recommended)**

Add these to your `.env.local` and Vercel environment variables:

```bash
# Pro Plan Price IDs
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_xxxxx
```

**Option B: Database Configuration**

Update the `stripe_price_mappings` table:

```sql
-- Insert Pro plan price IDs
INSERT INTO stripe_price_mappings (plan_code, billing_cycle, stripe_price_id, environment, is_active)
VALUES
  ('pro', 'monthly', 'price_xxxxx', 'production', true),
  ('pro', 'annual', 'price_xxxxx', 'production', true)
ON CONFLICT (plan_code, billing_cycle, environment)
DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  is_active = true,
  updated_at = now();
```

Replace `price_xxxxx` with your actual Stripe price IDs from your Stripe dashboard.

### 2. API Endpoint for Landing Page

The public checkout endpoint is available at:

```
POST https://app.lexyhub.com/api/billing/checkout/public
```

**Request Body:**
```typescript
{
  planCode: 'basic' | 'pro' | 'growth',    // Required
  billingCycle: 'monthly' | 'annual',      // Required
  email?: string,                          // Optional: pre-fill email
  referralCode?: string,                   // Optional: track referrals
  successUrl?: string,                     // Optional: custom redirect
  cancelUrl?: string                       // Optional: custom cancel redirect
}
```

**Response:**
```typescript
{
  sessionId: string,  // Stripe checkout session ID
  url: string        // Redirect user to this URL
}
```

### 3. Landing Page Implementation

Here are examples for different frameworks:

#### Vanilla JavaScript

```html
<!-- Pricing card on lexyhub.com -->
<div class="pricing-card">
  <h3>Pro Plan</h3>
  <p>$12.99/month</p>
  <button
    onclick="handleCheckout('pro', 'monthly')"
    class="cta-button"
  >
    Get Started
  </button>
</div>

<script>
async function handleCheckout(planCode, billingCycle) {
  const button = event.target;
  button.disabled = true;
  button.textContent = 'Loading...';

  try {
    const response = await fetch('https://app.lexyhub.com/api/billing/checkout/public', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planCode,
        billingCycle
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Checkout failed');
    }

    // Redirect to Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to start checkout. Please try again.');
    button.disabled = false;
    button.textContent = 'Get Started';
  }
}
</script>
```

#### React/Next.js

```tsx
// components/PricingCard.tsx
'use client';

import { useState } from 'react';

interface PricingCardProps {
  planCode: 'basic' | 'pro' | 'growth';
  planName: string;
  price: string;
  billingCycle: 'monthly' | 'annual';
}

export function PricingCard({ planCode, planName, price, billingCycle }: PricingCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('https://app.lexyhub.com/api/billing/checkout/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planCode,
          billingCycle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="pricing-card">
      <h3>{planName}</h3>
      <p>{price}</p>
      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className="cta-button"
      >
        {isLoading ? 'Loading...' : 'Get Started'}
      </button>
    </div>
  );
}
```

#### With Email Pre-fill

If you have an email signup form on your landing page:

```javascript
async function handleCheckout(planCode, billingCycle, email) {
  const response = await fetch('https://app.lexyhub.com/api/billing/checkout/public', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planCode,
      billingCycle,
      email  // Pre-fill email in Stripe checkout
    })
  });

  const data = await response.json();
  window.location.href = data.url;
}
```

### 4. URL Scheme for Direct Links

You can also create direct links from your landing page:

**Monthly Plans:**
- Basic: `https://app.lexyhub.com/billing?plan=basic&cycle=monthly`
- Pro: `https://app.lexyhub.com/billing?plan=pro&cycle=monthly`

**Annual Plans:**
- Basic: `https://app.lexyhub.com/billing?plan=basic&cycle=annual`
- Pro: `https://app.lexyhub.com/billing?plan=pro&cycle=annual`

**With Referral Code:**
- `https://app.lexyhub.com/billing?plan=pro&cycle=monthly&ref=AFFILIATE123`

### 5. Post-Checkout Flow

After successful payment:

1. User is redirected to: `https://app.lexyhub.com/auth/callback?session_id={CHECKOUT_SESSION_ID}&plan={planCode}`
2. Your auth callback should:
   - Verify the Stripe session
   - Create/login the user account
   - Associate the subscription with the user
   - Redirect to the dashboard

### 6. Testing

**Test Mode:**
Use Stripe test price IDs and test credit cards:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

**Test Flow:**
1. On lexyhub.com, click "Get Started"
2. Fill out Stripe checkout form
3. Verify redirect to app.lexyhub.com
4. Confirm subscription is created in database

## Environment Variables

Add these to your app.lexyhub.com project:

```bash
# Required
STRIPE_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Optional - Pro Plan Price IDs (if not in database)
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=price_xxxxx

# URLs
NEXT_PUBLIC_APP_URL=https://app.lexyhub.com
NEXT_PUBLIC_LANDING_URL=https://lexyhub.com
```

## CORS Configuration

Ensure your app.lexyhub.com allows requests from lexyhub.com:

```typescript
// middleware.ts or next.config.js
export const config = {
  matcher: '/api/billing/checkout/public',
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Origin', 'https://lexyhub.com');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}
```

## Tracking & Analytics

The public checkout endpoint automatically tracks:
- Checkout started events
- Plan selection
- Referral codes
- Source (landing_page)

View analytics in the `pricing_analytics` table:

```sql
SELECT
  event_type,
  plan_code,
  billing_cycle,
  created_at,
  metadata
FROM pricing_analytics
WHERE metadata->>'source' = 'landing_page'
ORDER BY created_at DESC;
```

## Troubleshooting

**Issue: CORS errors**
- Ensure CORS headers are configured for the public checkout endpoint
- Check that the request is being made from the correct domain

**Issue: "No active Stripe price configured"**
- Verify price IDs are in `stripe_price_mappings` table
- Check the `environment` column matches (`production` vs `test`)
- Ensure `is_active = true`

**Issue: Checkout succeeds but no account created**
- Check your webhook is configured correctly
- Verify the webhook handler processes `checkout.session.completed` events
- Check webhook logs in Stripe dashboard

## Security Considerations

1. **Rate Limiting:** Consider adding rate limiting to the public checkout endpoint
2. **Email Validation:** Validate email format if pre-filling
3. **Webhook Verification:** Always verify webhook signatures
4. **Environment Separation:** Use different Stripe keys for test/production

## Support

For issues or questions:
- Check Stripe webhook logs: https://dashboard.stripe.com/webhooks
- Check application logs in Vercel
- Review Supabase logs for database errors
