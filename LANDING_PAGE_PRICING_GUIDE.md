# Landing Page Pricing Configuration

This document provides the exact pricing information and Stripe integration for your landing page at **lexyhub.com**.

## Current Stripe Price Configuration

Your database has the following price IDs configured (test environment):

| Plan | Billing Cycle | Price ID | Usage |
|------|---------------|----------|-------|
| Basic | Monthly | `price_1SQOdz3enLCiqy1O4KF74msU` | Regular pricing |
| Basic | Annual | `price_1SQOi63enLCiqy1OIMsgMh6N` | Regular pricing |
| Pro | Monthly | `price_1SQOdS3enLCiqy1OeXSCpd6F` | Regular pricing |
| Pro | Annual | `price_1SQOjO3enLCiqy1Oetva8HuR` | Regular pricing |
| Growth | Monthly | `price_1SQOcK3enLCiqy1OxHnTeFFj` | Regular pricing |
| Founders Basic | Annual | `price_1SQPWO3enLCiqy1Oll2Lhd54` | **Special founders deal** |
| Founders Pro | Annual | `price_1SQPWn3enLCiqy1OS5fWTyLd` | **Special founders deal** |

## Recommended Landing Page Pricing Table

Based on your `PLAN_CONFIGS` in the app, here's what should be displayed:

### Free Plan
- **Price:** $0/month
- **Display:** "Get Started Free"
- **Action:** Redirect to `https://app.lexyhub.com/signup`
- **Features:**
  - Basic keyword research
  - 10 monthly searches
  - 1 niche tracking
  - 10 AI opportunities
  - Extension support
  - Community support

### Basic Plan
- **Price (Monthly):** $6.99/month
- **Price (Annual):** $69.90/year (save 17%)
- **Founders Deal:** $39/year (special limited offer - 61% off)
- **Features:**
  - 100 monthly searches
  - 10 niche projects
  - 100 AI opportunities
  - Advanced keyword insights
  - Trend analysis
  - Email support
  - Chrome extension boost

### Pro Plan ⭐ (Popular)
- **Price (Monthly):** $12.99/month
- **Price (Annual):** $129.90/year (save 17%)
- **Founders Deal:** Available (check Stripe for price)
- **Features:**
  - 500 monthly searches
  - 50 niche projects
  - 500 AI opportunities
  - Advanced analytics dashboard
  - Market Twin simulator
  - Trend forecasting
  - Priority support
  - Export capabilities

### Growth Plan (Hidden - Contact Sales)
- **Price (Monthly):** $24.99/month
- **Features:**
  - Unlimited searches
  - Unlimited niche projects
  - Unlimited AI opportunities
  - Unlimited keyword storage
  - White-glove support
  - Custom integrations
  - API access
  - Team collaboration
  - Advanced reporting

## Landing Page Implementation

### 1. Basic Pricing Table HTML Structure

```html
<div class="pricing-container">
  <!-- Free Plan -->
  <div class="pricing-card">
    <h3>Free</h3>
    <div class="price">$0<span>/month</span></div>
    <ul class="features">
      <li>✓ 10 monthly searches</li>
      <li>✓ 1 niche tracking</li>
      <li>✓ 10 AI opportunities</li>
      <li>✓ Community support</li>
    </ul>
    <a href="https://app.lexyhub.com/signup" class="btn-primary">Get Started Free</a>
  </div>

  <!-- Basic Plan -->
  <div class="pricing-card">
    <h3>Basic</h3>
    <div class="price">$6.99<span>/month</span></div>
    <div class="annual-price">or $69.90/year</div>
    <ul class="features">
      <li>✓ 100 monthly searches</li>
      <li>✓ 10 niche projects</li>
      <li>✓ 100 AI opportunities</li>
      <li>✓ Email support</li>
    </ul>
    <button onclick="handleCheckout('basic', 'monthly')" class="btn-primary">
      Get Started
    </button>
    <button onclick="handleCheckout('basic', 'annual')" class="btn-secondary">
      Get Annual Plan
    </button>
  </div>

  <!-- Pro Plan (Popular) -->
  <div class="pricing-card featured">
    <div class="badge">Most Popular</div>
    <h3>Pro</h3>
    <div class="price">$12.99<span>/month</span></div>
    <div class="annual-price">or $129.90/year</div>
    <ul class="features">
      <li>✓ 500 monthly searches</li>
      <li>✓ 50 niche projects</li>
      <li>✓ 500 AI opportunities</li>
      <li>✓ Advanced analytics</li>
      <li>✓ Priority support</li>
    </ul>
    <button onclick="handleCheckout('pro', 'monthly')" class="btn-primary">
      Get Started
    </button>
    <button onclick="handleCheckout('pro', 'annual')" class="btn-secondary">
      Get Annual Plan
    </button>
  </div>

  <!-- Growth Plan -->
  <div class="pricing-card enterprise">
    <h3>Growth</h3>
    <div class="price">$24.99<span>/month</span></div>
    <ul class="features">
      <li>✓ Unlimited searches</li>
      <li>✓ Unlimited niches</li>
      <li>✓ Unlimited AI opportunities</li>
      <li>✓ White-glove support</li>
      <li>✓ API access</li>
    </ul>
    <button onclick="handleCheckout('growth', 'monthly')" class="btn-primary">
      Get Started
    </button>
  </div>
</div>
```

### 2. JavaScript Checkout Function

```javascript
// Global loading state
let isCheckoutLoading = false;

async function handleCheckout(planCode, billingCycle = 'monthly') {
  // Prevent multiple clicks
  if (isCheckoutLoading) return;

  const button = event.target;
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Loading...';
  isCheckoutLoading = true;

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

    // Track in analytics (optional)
    if (window.gtag) {
      gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: planCode === 'basic' ? 6.99 : planCode === 'pro' ? 12.99 : 24.99,
        items: [{
          item_name: `${planCode} Plan`,
          item_category: 'Subscription',
        }]
      });
    }

    // Redirect to Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to start checkout. Please try again or contact support.');

    button.disabled = false;
    button.textContent = originalText;
    isCheckoutLoading = false;
  }
}
```

### 3. Founders Deal Banner (Optional)

Add a special banner for founders deals at the top of your pricing page:

```html
<div class="founders-deal-banner">
  <div class="banner-content">
    <span class="badge">🎉 Limited Time Offer</span>
    <h2>Founders Deal - Lock in Special Pricing!</h2>
    <p>Get the Basic Plan for only $39/year (normally $69.90)</p>
    <button onclick="handleFoundersCheckout('basic')" class="btn-founders">
      Claim Founders Deal
    </button>
  </div>
</div>

<script>
async function handleFoundersCheckout(planLevel) {
  // Use the direct price ID for founders deals
  const foundersPriceIds = {
    basic: 'price_1SQPWO3enLCiqy1Oll2Lhd54',
    pro: 'price_1SQPWn3enLCiqy1OS5fWTyLd'
  };

  const button = event.target;
  button.disabled = true;
  button.textContent = 'Loading...';

  try {
    // Use the direct checkout endpoint with specific price ID
    const response = await fetch('https://app.lexyhub.com/api/billing/checkout/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId: foundersPriceIds[planLevel],
        planName: `${planLevel.charAt(0).toUpperCase() + planLevel.slice(1)} Plan (Founders Deal)`
      })
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Founders checkout error:', error);
    alert('Failed to start checkout. Please try again.');
    button.disabled = false;
    button.textContent = 'Claim Founders Deal';
  }
}
</script>
```

### 4. With Email Pre-fill (Recommended)

If you collect emails before checkout:

```html
<form id="pricing-form">
  <input type="email" id="email-input" placeholder="Enter your email" required>
  <button type="button" onclick="handleCheckoutWithEmail('basic', 'monthly')">
    Get Started
  </button>
</form>

<script>
async function handleCheckoutWithEmail(planCode, billingCycle) {
  const email = document.getElementById('email-input').value;

  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address');
    return;
  }

  try {
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
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to start checkout. Please try again.');
  }
}
</script>
```

### 5. Annual Pricing Toggle

Add a toggle to show monthly vs annual pricing:

```html
<div class="billing-toggle">
  <label>
    <input type="radio" name="billing-cycle" value="monthly" checked>
    Monthly
  </label>
  <label>
    <input type="radio" name="billing-cycle" value="annual">
    Annual <span class="badge-save">Save 17%</span>
  </label>
</div>

<script>
// Update prices when toggle changes
document.querySelectorAll('input[name="billing-cycle"]').forEach(input => {
  input.addEventListener('change', (e) => {
    const cycle = e.target.value;
    const isAnnual = cycle === 'annual';

    // Update displayed prices
    document.querySelectorAll('.price').forEach((priceEl, index) => {
      if (index === 1) { // Basic plan
        priceEl.innerHTML = isAnnual
          ? '$69.90<span>/year</span>'
          : '$6.99<span>/month</span>';
      } else if (index === 2) { // Pro plan
        priceEl.innerHTML = isAnnual
          ? '$129.90<span>/year</span>'
          : '$12.99<span>/month</span>';
      }
    });
  });
});
</script>
```

## Recommended Pricing Strategy

### Display This on Landing Page:

1. **Free Plan**: Always visible, redirect to signup
2. **Basic Plan**:
   - Monthly: $6.99/month
   - Annual: $69.90/year
   - Show "Save 17%" badge on annual
3. **Pro Plan** (Mark as "Popular"):
   - Monthly: $12.99/month
   - Annual: $129.90/year
   - Show "Save 17%" badge on annual
4. **Growth Plan**: Either hide or show as "Contact Sales"

### Optional Promotional Banner:

Add a dismissible banner at the top:
```
🎉 Limited Founders Deal: Get Basic Plan for $39/year (61% off) - Only X spots left!
```

## Testing Checklist

- [ ] Free plan redirects to `/signup`
- [ ] Basic monthly checkout works
- [ ] Basic annual checkout works
- [ ] Pro monthly checkout works
- [ ] Pro annual checkout works
- [ ] Growth monthly checkout works
- [ ] Founders deal checkout works (if shown)
- [ ] Email pre-fill works correctly
- [ ] Success redirect lands on app.lexyhub.com
- [ ] Cancel redirect returns to pricing page
- [ ] Mobile responsive pricing cards
- [ ] Loading states show correctly
- [ ] Error messages display properly

## Analytics Tracking

Add this to track conversions:

```javascript
// After successful redirect to Stripe
function trackCheckoutStarted(planCode, billingCycle, price) {
  // Google Analytics
  if (window.gtag) {
    gtag('event', 'begin_checkout', {
      currency: 'USD',
      value: price,
      items: [{
        item_name: `${planCode} Plan`,
        item_category: 'Subscription',
        price: price
      }]
    });
  }

  // Facebook Pixel
  if (window.fbq) {
    fbq('track', 'InitiateCheckout', {
      value: price,
      currency: 'USD',
      content_name: `${planCode} Plan`
    });
  }
}
```

## Support

For questions about pricing integration:
1. Check the full integration guide: `LANDING_PAGE_INTEGRATION.md`
2. Test with Stripe test mode first
3. Verify webhook is configured for post-purchase handling
4. Check Vercel logs for API errors

## Next Steps

1. **Copy the HTML and JavaScript** to your landing page
2. **Test each plan** in Stripe test mode
3. **Set up analytics tracking** (optional)
4. **Configure CORS** if needed
5. **Deploy and test** end-to-end flow
6. **Switch to production** Stripe keys when ready
