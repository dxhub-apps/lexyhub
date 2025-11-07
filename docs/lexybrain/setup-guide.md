# LexyBrain Setup Guide

This guide walks you through setting up LexyBrain from database migrations to production deployment.

## Prerequisites

- Supabase project with pgvector extension enabled
- RunPod account with Llama-3-8B serverless endpoint
- Node.js 18+ and npm
- Access to your deployment environment variables (Vercel, etc.)

## 1. Database Setup

### Run Migrations

The LexyBrain core migration creates all necessary tables, indexes, and RPC functions:

```bash
# Local development
supabase migration up

# Or apply specific migration
supabase db push
```

**Migration 0037** (`0037_lexybrain_core_tables.sql`) creates:
- ✅ `ai_insights` - Cache table for AI-generated insights
- ✅ `ai_usage_events` - Analytics and cost tracking
- ✅ `ai_failures` - Error logging and debugging
- ✅ `lexybrain_prompt_configs` - Admin-configurable prompts
- ✅ `keyword_embeddings` - Vector embeddings for similarity search
- ✅ Plan entitlements with LexyBrain quotas (including **admin** plan with unlimited quota)
- ✅ RPC functions: `similar_keywords()`, `niche_context()`, `search_keywords_by_embedding()`
- ✅ Default prompt configurations for all 4 insight types

### Verify Migration

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'ai_%' OR table_name LIKE 'lexybrain%' OR table_name = 'keyword_embeddings';

-- Verify admin plan has unlimited quota
SELECT * FROM plan_entitlements WHERE plan_code = 'admin';
-- Should show -1 for ai_calls_per_month, briefs_per_month, sims_per_month

-- Check prompt configs
SELECT name, type, is_active FROM lexybrain_prompt_configs;
-- Should have 5 configs: global, market_brief, radar, ad_insight, risk
```

## 2. RunPod Configuration

### Get RunPod API Credentials

1. **Sign up for RunPod**: https://www.runpod.io/
2. **Create a Serverless Endpoint**:
   - Go to Serverless → Create Endpoint
   - Select model: **Llama-3-8B-Instruct** (or compatible)
   - Note your endpoint URL (e.g., `https://api.runpod.ai/v2/your-endpoint-id`)
3. **Get API Key**:
   - Go to Settings → API Keys
   - Create a new API key
   - Copy the key (starts with `runpod_`)

### Alternative: Use OpenAI or Other LLM Provider

If you don't have RunPod, you can modify `src/lib/lexybrain-client.ts` to use OpenAI or another provider:

```typescript
// Example: OpenAI adapter
export async function callLexyBrainRaw(prompt: string, options = {}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

## 3. Environment Variables

### Required Environment Variables

Add these to your `.env.local` (development) and deployment platform (Vercel, etc.):

```bash
# ========================================
# LexyBrain Configuration
# ========================================

# Feature flag (set to "true" to enable)
LEXYBRAIN_ENABLE=true

# LexyBrain HTTP endpoint URL (llama.cpp server)
# Format: https://<endpoint-id>-<hash>.runpod.run
LEXYBRAIN_MODEL_URL=https://your-endpoint-id-hash.runpod.run

# LexyBrain shared secret (X-LEXYBRAIN-KEY header)
# This is configured in RunPod's "Required Request Headers"
LEXYBRAIN_KEY=your-shared-secret-here

# Model version identifier (for logging/analytics)
LEXYBRAIN_MODEL_VERSION=llama-3-8b-instruct

# Daily cost cap in cents (optional, default: 10000 = $100)
# Set to prevent runaway costs from heavy usage
LEXYBRAIN_DAILY_COST_CAP=10000

# Max latency in milliseconds (optional, default: 15000 = 15s)
LEXYBRAIN_MAX_LATENCY_MS=15000

# Enable notifications for high-severity RiskSentinel alerts (optional, default: false)
LEXYBRAIN_NOTIFICATIONS_ENABLED=true
```

### Vercel Environment Variables

In your Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add each variable above
3. Select environments: Production, Preview, Development
4. **Important**: Re-deploy after adding variables

### Testing Environment Variables

```bash
# Test locally
npm run dev

# Check if variables are loaded
curl http://localhost:3000/api/lexybrain/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market_brief",
    "market": "etsy",
    "niche_terms": ["handmade jewelry"]
  }'
```

## 4. Admin User Setup

### Grant Admin Access

Admin users get **unlimited quota** for all LexyBrain features. There are 3 ways to grant admin access:

#### Method 1: Email Allowlist (Recommended)

```bash
# Add admin email to environment
ADMIN_EMAILS=admin@example.com,another@example.com
```

#### Method 2: Database Flag

```sql
-- Set admin flag in user metadata
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'admin@example.com';
```

#### Method 3: Admin Plan

```sql
-- Assign admin plan (has unlimited quota by default)
UPDATE user_profiles
SET plan = 'admin'
WHERE user_id = 'your-user-uuid';
```

### Verify Admin Access

```typescript
// Check if user is admin
const { isAdmin } = await checkAdminAccess(userId);

// Admin should have unlimited quota
const entitlements = await getPlanEntitlements(userId);
console.log(entitlements);
// {
//   plan_code: 'admin',
//   ai_calls_per_month: -1,  // -1 means unlimited
//   briefs_per_month: -1,
//   sims_per_month: -1
// }
```

## 5. Testing LexyBrain

### Test 1: Basic Generation

```bash
# Generate Market Brief
curl https://your-app.vercel.app/api/lexybrain/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "type": "market_brief",
    "market": "etsy",
    "niche_terms": ["handmade jewelry", "silver rings"]
  }'
```

**Expected Response:**
```json
{
  "niche": "handmade jewelry & silver rings",
  "summary": "Growing market with strong demand...",
  "top_opportunities": [...],
  "risks": [...],
  "actions": [...],
  "confidence": 0.85
}
```

### Test 2: Quota Check

```bash
# Check quota usage
curl https://your-app.vercel.app/api/lexybrain/quota \
  -H "Authorization: Bearer your-jwt-token"
```

**Expected Response (Admin):**
```json
{
  "ai_calls": {
    "used": 0,
    "limit": -1,  // -1 = unlimited
    "percentage": 0
  },
  "ai_brief": {
    "used": 0,
    "limit": -1,
    "percentage": 0
  },
  "ai_sim": {
    "used": 0,
    "limit": -1,
    "percentage": 0
  }
}
```

### Test 3: Cache Behavior

```bash
# First request (should take 5-15 seconds)
time curl https://your-app.vercel.app/api/lexybrain/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "type": "radar",
    "market": "etsy",
    "niche_terms": ["vintage posters"]
  }'

# Second request (should be instant - cached)
time curl https://your-app.vercel.app/api/lexybrain/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "type": "radar",
    "market": "etsy",
    "niche_terms": ["vintage posters"]
  }'
```

## 6. Troubleshooting

> **Quick Fix**: If experiencing multiple errors, use the automated fix script:
> ```bash
> # Verify database state
> psql $DATABASE_URL < scripts/verify-lexybrain-db.sql
>
> # Apply all fixes at once
> psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
> ```
> See `scripts/README.md` for detailed information.

### Error: "401 Unauthorized" from RunPod

**Cause**: Invalid or missing `LEXYBRAIN_KEY` environment variable.

**Fix**:
1. Verify your RunPod API key is correct
2. Check environment variables are set in deployment (see `.env.example` for all required variables)
3. Re-deploy after adding/updating variables

```bash
# Test API key
curl https://api.runpod.ai/v2/your-endpoint-id/run \
  -H "Authorization: Bearer runpod_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

**Environment variables checklist**:
```bash
LEXYBRAIN_ENABLE=true
# CRITICAL: Use the HTTP llama.cpp server URL, NOT api.runpod.ai/v2/...
LEXYBRAIN_MODEL_URL=https://your-endpoint-id-hash.runpod.run
LEXYBRAIN_KEY=your-shared-secret-here
LEXYBRAIN_MODEL_VERSION=llama-3-8b-instruct
```

**IMPORTANT - URL Format**:
LexyBrain is deployed as an **HTTP llama.cpp server**, not a job-based API.

- ✅ **CORRECT**: `https://c01emmd6h9te8e-abc123.runpod.run` (llama.cpp HTTP server)
- ❌ **WRONG**: `https://api.runpod.ai/v2/c01emmd6h9te8e` (RunPod job API - not used)
- ❌ **WRONG**: `https://api.runpod.ai/v2/c01emmd6h9te8e/run` (RunPod job API - not used)

The code will automatically append `/completion` to make requests.

**Authentication**:
- Uses `X-LEXYBRAIN-KEY` header with shared secret
- NOT `Authorization: Bearer <runpod-api-key>`
- The shared secret must match what's configured in RunPod's "Required Request Headers"

**Debug endpoint**:
Check your actual configuration at:
```bash
curl https://your-app.vercel.app/api/lexybrain/debug
```

### Error: "column ai_usage_events.ts does not exist"

**Cause**: Migration 0037 hasn't been run yet.

**Fix Options**:

**Option 1 - Recommended**: Run the full migration
```bash
supabase db push
```

**Option 2**: Apply only migration 0037
```bash
psql $DATABASE_URL < supabase/migrations/0037_lexybrain_core_tables.sql
```

**Option 3**: Use the quick fix script (fixes all 3 errors at once)
```bash
psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
```

**To verify the fix**:
```bash
psql $DATABASE_URL < scripts/verify-lexybrain-db.sql
```

### Error: "Failed to lookup plan entitlements" for admin user

**Cause**: Admin plan not seeded in `plan_entitlements` table.

**Fix Options**:

**Option 1 - Recommended**: Run the full migration (includes seeding)
```bash
supabase db push
```

**Option 2**: Use the quick fix script
```bash
psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
```

**Option 3**: Manual SQL
```sql
INSERT INTO plan_entitlements (
  plan_code,
  searches_per_month,
  ai_opportunities_per_month,
  niches_max,
  ai_calls_per_month,
  briefs_per_month,
  sims_per_month,
  extension_boost
) VALUES (
  'admin', -1, -1, -1, -1, -1, -1, '{}'::jsonb
)
ON CONFLICT (plan_code) DO UPDATE SET
  ai_calls_per_month = -1,
  briefs_per_month = -1,
  sims_per_month = -1;
```

### Error: "Quota exceeded" for admin user

**Cause**: User's `plan` in `user_profiles` is not set to "admin".

**Fix**:
```sql
-- Set user to admin plan
UPDATE user_profiles
SET plan = 'admin'
WHERE user_id = 'your-user-uuid';

-- Verify
SELECT user_id, plan FROM user_profiles WHERE user_id = 'your-user-uuid';
```

### Slow Response Times (>20 seconds)

**Cause**: Cold start on RunPod serverless endpoint.

**Fix**:
1. Enable "Always On" for your RunPod endpoint (costs more)
2. Increase workers/replicas for better availability
3. Implement warm-up pings every 5 minutes

```typescript
// Warm-up function (call via cron)
export async function warmUpLexyBrain() {
  await fetch('/api/lexybrain/generate', {
    method: 'POST',
    body: JSON.stringify({
      type: 'radar',
      market: 'etsy',
      niche_terms: ['test']
    })
  });
}
```

### High Costs

**Issue**: LexyBrain costs accumulating quickly.

**Solutions**:
1. **Lower daily cost cap**:
   ```bash
   LEXYBRAIN_DAILY_COST_CAP=5000  # $50/day
   ```

2. **Increase cache TTLs** (in `lexybrain-config.ts`):
   ```typescript
   export function getLexyBrainTtl(type: LexyBrainOutputType): number {
     return {
       market_brief: 48 * 60,  // 48 hours instead of 24
       radar: 48 * 60,
       ad_insight: 12 * 60,
       risk: 24 * 60
     }[type];
   }
   ```

3. **Monitor usage**:
   ```sql
   -- Check daily costs
   SELECT
     DATE(ts) as date,
     SUM(cost_cents) / 100.0 as cost_dollars,
     COUNT(*) as requests
   FROM ai_usage_events
   WHERE cache_hit = false
   GROUP BY DATE(ts)
   ORDER BY date DESC;
   ```

## 7. Monitoring & Analytics

### View Usage Dashboard

```sql
-- Refresh materialized view
REFRESH MATERIALIZED VIEW lexybrain_usage_summary;

-- View analytics
SELECT
  date,
  type,
  total_requests,
  cache_hits,
  ROUND((cache_hits::numeric / total_requests * 100), 2) as cache_hit_rate,
  ROUND(avg_latency_ms, 0) as avg_latency_ms,
  ROUND(total_cost_cents / 100.0, 2) as cost_dollars
FROM lexybrain_usage_summary
ORDER BY date DESC, type;
```

### Set Up Alerts

Create alerts for:
- Daily cost exceeds threshold
- Cache hit rate drops below 40%
- Average latency exceeds 10 seconds
- Error rate exceeds 5%

### Admin Metrics Endpoint

```bash
# Get admin analytics (requires admin access)
curl https://your-app.vercel.app/api/admin/lexybrain/metrics \
  -H "Authorization: Bearer admin-jwt-token"
```

## 8. Notifications (Optional)

LexyBrain can automatically notify users when RiskSentinel detects high-severity risks.

### How It Works

When a RiskSentinel analysis returns alerts with `severity: "high"`:
1. A notification is created in the `notifications` table
2. A delivery record is created for the user in `notification_delivery`
3. User sees the notification in-app (and optionally via email)

### Enable Notifications

```bash
# Add to environment variables
LEXYBRAIN_NOTIFICATIONS_ENABLED=true
```

### User Notification Preferences

Users can control their AI notification preferences:

```sql
-- Check user's AI notification preferences
SELECT * FROM user_notification_prefs
WHERE user_id = 'your-user-uuid' AND category = 'ai';

-- Users can disable AI notifications
UPDATE user_notification_prefs
SET inapp_enabled = false, email_enabled = false
WHERE user_id = 'your-user-uuid' AND category = 'ai';
```

### Test Notifications

```bash
# Generate RiskSentinel output with high-severity alerts
curl https://your-app.vercel.app/api/lexybrain/generate \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "type": "risk",
    "market": "etsy",
    "niche_terms": ["oversaturated product"]
  }'

# Check if notification was created
curl https://your-app.vercel.app/api/notifications/feed \
  -H "Authorization: Bearer your-jwt-token"
```

### Disable Notifications

To disable notifications system-wide:

```bash
# Remove or set to false
LEXYBRAIN_NOTIFICATIONS_ENABLED=false
```

Or delete the environment variable entirely.

## 9. Production Checklist

Before launching to production:

- [ ] Migration 0037 successfully applied
- [ ] RunPod endpoint configured and tested
- [ ] Environment variables set in production
- [ ] Admin users have unlimited quota (plan = 'admin')
- [ ] Cache working correctly (second request is instant)
- [ ] Daily cost cap set appropriately
- [ ] Error logging configured (Sentry)
- [ ] Analytics tracking enabled (PostHog)
- [ ] Quotas working for non-admin users
- [ ] UI components rendering correctly
- [ ] Documentation accessible to users
- [ ] Notifications enabled/disabled as desired (LEXYBRAIN_NOTIFICATIONS_ENABLED)
- [ ] User notification preferences working correctly

## Next Steps

- Review [Technical Documentation](./technical.md) for deep-dive into architecture
- Read [Business Documentation](./business.md) for feature descriptions
- Check [Extension Integration Guide](./extension-integration.md) for Chrome extension setup

## Support

For issues or questions:
- Check error logs in Supabase dashboard
- Review Sentry for exceptions
- Check PostHog for user analytics
- Contact: support@lexyhub.com
