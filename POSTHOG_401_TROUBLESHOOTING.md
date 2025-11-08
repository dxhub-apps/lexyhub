# PostHog 401 Unauthorized Error - Troubleshooting Guide

## Problem

You're seeing this error in your browser console:

```
POST https://eu.i.posthog.com/i/v0/e/?ip=0&_=... 401 (Unauthorized)
❌ PostHog: Authentication failed (401 Unauthorized)
```

Even though you've set the correct `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in Vercel.

## Automatic host fallback

We now ship an automatic recovery path directly in the client. When PostHog responds with a `401` the app will:

1. Log the full diagnostic message (same as before).
2. **Automatically retry** using the opposite PostHog region (`https://us.i.posthog.com` ↔ `https://eu.i.posthog.com`).
3. Surface a yellow console warning:
   ```
   ⚠️ PostHog fallback host active. Update NEXT_PUBLIC_POSTHOG_HOST to https://<new-host>
   ```

If you see that warning it means the fallback succeeded and events are flowing again, but you still need to update your environment variable to the new host so that future deploys skip the retry.

## Root Causes (Ranked by Likelihood)

### 1. STALE VERCEL DEPLOYMENT (Most Common - 80%)

**The Problem:**
- You updated environment variables in Vercel
- But the deployed app is still using the OLD cached build with OLD variables
- Vercel doesn't automatically rebuild when env vars change

**How to Fix:**
1. Go to your Vercel project dashboard
2. Click "Deployments" tab
3. Find the latest deployment
4. Click the three dots (⋯) → "Redeploy"
5. Check "Use existing Build Cache" is **UNCHECKED**
6. Click "Redeploy"

**Or clear build cache:**
1. Go to Settings → General
2. Scroll to "Build & Development Settings"
3. Click "Clear Build Cache"
4. Trigger a new deployment

**Verification:**
- After redeployment, visit: `https://your-domain.vercel.app/api/debug/posthog`
- Check if the key preview matches your Vercel env var
- If they don't match → still using old build

---

### 2. KEY FROM WRONG POSTHOG INSTANCE (15%)

**The Problem:**
- Your host is set to `https://eu.i.posthog.com` (EU instance)
- But your API key is from the US instance (or vice versa)
- Each PostHog instance has separate projects with separate keys

**How to Fix:**

**Step 1: Verify which instance your project is on**
- Try logging into: https://eu.posthog.com
- If you can't access your project → you're on US instance
- Try: https://app.posthog.com

**Step 2: Update environment variables to match**

**If your project is on EU instance:**
```bash
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=phc_your_eu_key_here
```

**If your project is on US instance:**
```bash
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=phc_your_us_key_here
```

**Step 3: Redeploy** (see #1 above)

---

### 3. INVALID OR REVOKED API KEY (5%)

**The Problem:**
- The API key format is correct (`phc_...`)
- The instance matches (EU/US)
- But PostHog still rejects it because:
  - The project was deleted
  - The API key was revoked
  - You copied a different type of key (personal API key)

**How to Fix:**

**Step 1: Generate a NEW project API key**
1. Log into your PostHog instance:
   - EU: https://eu.posthog.com
   - US: https://app.posthog.com
2. Go to: **Project Settings** → **Project API Key**
3. Look for the "Project API Key" (starts with `phc_`)
   - **NOT** "Personal API Key"
   - **NOT** "Team API Key"
4. Copy the EXACT key (select all, copy, paste - don't type it)

**Step 2: Update Vercel environment variable**
1. Go to Vercel project → Settings → Environment Variables
2. Find `NEXT_PUBLIC_POSTHOG_KEY`
3. Click "Edit" → Paste the NEW key
4. Click "Save"

**Step 3: Redeploy** (see #1 above)

---

### 4. WHITESPACE OR SPECIAL CHARACTERS IN KEY (<1%)

**The Problem:**
- When copying the API key, you accidentally included:
  - Leading/trailing spaces
  - Line breaks
  - Hidden characters

**How to Fix:**
1. In Vercel, edit `NEXT_PUBLIC_POSTHOG_KEY`
2. Delete the entire value
3. Go to PostHog → Copy the key again
4. Paste directly into Vercel (Ctrl+V / Cmd+V)
5. Don't type anything before or after
6. Save and redeploy

---

## Diagnostic Tools

### Tool 1: API Debug Endpoint

Visit: `https://your-domain.vercel.app/api/debug/posthog`

This will show you:
- Current environment variables (masked)
- Server-side vs client-side configuration
- API key validation test
- Specific troubleshooting steps

### Tool 2: PostHog Debugger Component

Add this to any page during development:

```tsx
import { PostHogDebugger } from "@/components/debug/posthog-debugger";

export default function Page() {
  return (
    <div>
      {/* Your page content */}

      {/* Debug tool - only in development */}
      {process.env.NODE_ENV === "development" && <PostHogDebugger />}
    </div>
  );
}
```

Or add to production temporarily to diagnose:

```tsx
{/* Remove this after debugging! */}
<PostHogDebugger />
```

This provides:
- Visual diagnostics overlay
- Server config vs client config comparison
- Test event button
- Copy diagnostics to clipboard

---

## Step-by-Step Verification Checklist

### Step 1: Verify Environment Variables in Vercel

1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find these two variables:
   ```
   NEXT_PUBLIC_POSTHOG_KEY
   NEXT_PUBLIC_POSTHOG_HOST
   ```
3. Click "View" to see the values (they're hidden by default)
4. Verify:
   - Key starts with `phc_`
   - No extra spaces before/after
   - Host is either:
     - `https://eu.i.posthog.com` (EU instance)
     - `https://us.i.posthog.com` (US instance)

### Step 2: Verify PostHog Instance

1. Determine which instance based on host:
   - If host is `https://eu.i.posthog.com` → EU instance
   - If host is `https://us.i.posthog.com` → US instance

2. Log into that instance:
   - EU: https://eu.posthog.com
   - US: https://app.posthog.com

3. Go to: **Project Settings** → **Project API Key**

4. Compare the key shown with your Vercel variable
   - They should match EXACTLY

### Step 3: Clear Cache and Redeploy

1. Vercel Dashboard → Settings → General
2. Scroll down → "Clear Build Cache"
3. Go to Deployments tab
4. Redeploy the latest deployment
5. Uncheck "Use existing Build Cache"

### Step 4: Test the Deployment

1. Visit: `https://your-domain.vercel.app/api/debug/posthog`
2. Check the API test result:
   - ✅ Green = API key is valid and working
   - ❌ Red = Still an issue

3. If still failing:
   - Check the "Key Preview" in the diagnostics
   - Compare with what you see in Vercel settings
   - If they don't match → deployment didn't pick up new variables

### Step 5: Browser Cache (Last Resort)

If the server-side test passes but browser still shows 401:

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache completely
3. Try incognito/private browsing mode

---

## Quick Fixes Summary

**Most Common Fix (90% of cases):**
```bash
# In Vercel:
1. Clear Build Cache (Settings → General)
2. Redeploy (Deployments → Redeploy)
3. Wait 1-2 minutes
4. Test: /api/debug/posthog
```

**If That Doesn't Work:**
```bash
# In PostHog:
1. Log into correct instance (EU or US)
2. Project Settings → Project API Key
3. Copy the exact key (phc_...)

# In Vercel:
1. Settings → Environment Variables
2. Edit NEXT_PUBLIC_POSTHOG_KEY
3. Paste the new key
4. Save
5. Clear Build Cache
6. Redeploy
```

---

## Still Not Working?

If you've tried everything above and still getting 401 errors:

1. **Create a NEW PostHog project:**
   - Sometimes the old project is corrupted
   - Create a fresh project in PostHog
   - Get the new API key
   - Update Vercel with the new key

2. **Check PostHog Status:**
   - Visit: https://status.posthog.com
   - There might be an outage affecting authentication

3. **Verify Network/Firewall:**
   - Some corporate firewalls block PostHog
   - Test from a different network
   - Check if you can access the PostHog API directly

4. **Contact PostHog Support:**
   - If the API key test at `/api/debug/posthog` shows it's valid
   - But browser still gets 401
   - There might be an issue on PostHog's side
   - Email: hey@posthog.com

---

## Prevention

To avoid this issue in the future:

1. **Always redeploy after changing env vars** in Vercel
2. **Clear build cache** when changing configuration
3. **Use the diagnostic endpoint** to verify before deploying
4. **Keep a backup** of your environment variables
5. **Document which instance** (EU/US) your project uses

---

## Related Files

- Configuration: `src/lib/analytics/posthog.ts`
- Debug endpoint: `src/app/api/debug/posthog/route.ts`
- Debug component: `src/components/debug/posthog-debugger.tsx`
- Environment example: `.env.example`
