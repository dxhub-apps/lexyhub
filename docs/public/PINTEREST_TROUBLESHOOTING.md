# Pinterest Integration Troubleshooting Guide

## 🔍 Common Errors and Fixes

This guide addresses the errors you encountered and provides step-by-step fixes.

---

## Error 1: "pinterest_collection:disabled by feature flag"

### Problem
```
pinterest_collector:start
pinterest_collection:disabled by feature flag
```

### Root Cause
The `pinterest_collection` feature flag is disabled in the database.

### Fix

**Option A: Via Supabase SQL Editor (Recommended)**

1. Go to Supabase Dashboard > SQL Editor
2. Run this query:

```sql
UPDATE feature_flags
SET is_enabled = true
WHERE key = 'pinterest_collection';

-- Verify it worked
SELECT key, is_enabled, description
FROM feature_flags
WHERE key = 'pinterest_collection';
```

**Expected Result:**
```
key                      | is_enabled | description
pinterest_collection     | true       | Enable Pinterest keyword collection
```

**Option B: If feature flag doesn't exist at all**

```sql
INSERT INTO feature_flags (key, description, is_enabled, rollout)
VALUES (
  'pinterest_collection',
  'Enable Pinterest keyword collection',
  true,
  '{"frequency": "15 */2 * * *", "daily_limit": 200}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET is_enabled = true;
```

---

## Error 2: "column kmd.social_mentions does not exist"

### Problem
```
ERROR: 42703: column kmd.social_mentions does not exist
LINE 1: SELECT k.term, kmd.social_mentions, kmd.social_sentiment
```

### Root Cause
The database migration `0031_social_metrics_and_watchlist.sql` hasn't been applied, so the social metrics columns don't exist yet.

### Fix

**Option A: Apply the full migration (Recommended)**

1. Go to Supabase Dashboard > Database > Migrations
2. Find migration `0031_social_metrics_and_watchlist.sql`
3. Click "Run migration"

**Option B: Manually add the columns**

Run in Supabase SQL Editor:

```sql
-- Add social metrics columns to keyword_metrics_daily
ALTER TABLE keyword_metrics_daily
  ADD COLUMN IF NOT EXISTS social_mentions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_sentiment NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS social_platforms JSONB DEFAULT '{}'::jsonb;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'keyword_metrics_daily'
AND column_name IN ('social_mentions', 'social_sentiment', 'social_platforms');
```

**Expected Result:**
```
column_name        | data_type
social_mentions    | integer
social_sentiment   | numeric
social_platforms   | jsonb
```

---

## Error 3: "relation api_usage_tracking does not exist"

### Problem
```
ERROR: 42P01: relation "api_usage_tracking" does not exist
LINE 2: FROM api_usage_tracking
```

### Root Cause
The `api_usage_tracking` table hasn't been created yet (part of migration `0031`).

### Fix

Run in Supabase SQL Editor:

```sql
-- Create api_usage_tracking table
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  period TEXT NOT NULL,
  requests_made INTEGER DEFAULT 0,
  limit_per_period INTEGER NOT NULL,
  last_request_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service, period)
);

CREATE INDEX IF NOT EXISTS api_usage_tracking_service_period_idx
  ON api_usage_tracking(service, period);

-- Verify table was created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'api_usage_tracking';
```

**Expected Result:**
```
table_name
api_usage_tracking
```

---

## Error 4: Daily vs Monthly Tracking Mismatch

### Problem
The Pinterest collector expects **daily** tracking (`YYYY-MM-DD`), but the default `track_api_usage` function uses **monthly** tracking (`YYYY-MM`).

### Fix

Run in Supabase SQL Editor:

```sql
-- Drop old function
DROP FUNCTION IF EXISTS public.track_api_usage(TEXT, INTEGER);

-- Create updated function with daily tracking for Pinterest
CREATE OR REPLACE FUNCTION public.track_api_usage(
  p_service TEXT,
  p_requests INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_period TEXT;
  v_limit INTEGER;
BEGIN
  -- Pinterest uses daily tracking (YYYY-MM-DD), others use monthly (YYYY-MM)
  IF p_service = 'pinterest' THEN
    v_period := TO_CHAR(NOW(), 'YYYY-MM-DD');
    v_limit := 200;  -- 200 requests per day
  ELSE
    v_period := TO_CHAR(NOW(), 'YYYY-MM');
    v_limit := CASE p_service
      WHEN 'twitter' THEN 1500
      WHEN 'reddit' THEN 999999
      WHEN 'google_trends' THEN 999999
      ELSE 1000
    END;
  END IF;

  INSERT INTO public.api_usage_tracking (
    service, period, requests_made, limit_per_period,
    last_request_at, last_reset_at
  )
  VALUES (p_service, v_period, p_requests, v_limit, NOW(), NOW())
  ON CONFLICT (service, period) DO UPDATE SET
    requests_made = api_usage_tracking.requests_made + p_requests,
    last_request_at = NOW(),
    updated_at = NOW();
END;
$$;
```

---

## 🚀 Complete Fix Script

We've created a comprehensive fix script: `fix-pinterest-database.sql`

**To run it:**

1. Go to Supabase Dashboard > SQL Editor
2. Open `fix-pinterest-database.sql`
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"

This script will:
- ✅ Enable the pinterest_collection feature flag
- ✅ Add social metrics columns if missing
- ✅ Create api_usage_tracking table if missing
- ✅ Create social_platform_trends table if missing
- ✅ Create/update track_api_usage function with daily tracking
- ✅ Run verification checks

---

## ✅ Verification Steps

After running the fixes, verify everything is working:

### 1. Check Feature Flag

```sql
SELECT key, is_enabled, rollout
FROM feature_flags
WHERE key = 'pinterest_collection';
```

**Should return:**
```
key: pinterest_collection
is_enabled: true
rollout: {"frequency": "15 */2 * * *", "daily_limit": 200}
```

### 2. Check Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('api_usage_tracking', 'social_platform_trends');
```

**Should return 2 rows.**

### 3. Check Columns Exist

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'keyword_metrics_daily'
AND column_name IN ('social_mentions', 'social_sentiment', 'social_platforms');
```

**Should return 3 rows.**

### 4. Test the Collector

```bash
# Set env vars
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export PINTEREST_ACCESS_TOKEN=pina_your_token

# Run collector
./test-pinterest-local.sh
```

**Expected Output:**
```
pinterest_collector:start
pinterest_usage:0/200 (0.0%)
pinterest_budget:5 searches
collecting:query=handmade gifts limit=25
...
pins_processed:XX keywords_extracted:YY
keywords_stored:ZZ
pinterest_collector:success
```

---

## 📊 Corrected SQL Queries

### View Collected Keywords

```sql
-- Correct query for keywords
SELECT
  k.term,
  k.source,
  k.created_at,
  k.extras->>'save_count' as pinterest_saves,
  k.extras->>'engagement_sum' as engagement,
  k.extras->>'seasonal' as seasonal_info
FROM keywords k
WHERE k.source = 'pinterest'
ORDER BY k.created_at DESC
LIMIT 10;
```

### View Daily Metrics

```sql
-- Correct query for daily metrics
SELECT
  k.term,
  kmd.collected_on,
  kmd.social_mentions,
  kmd.social_sentiment,
  kmd.social_platforms,
  kmd.extras->>'save_count' as saves,
  kmd.extras->>'board_count' as boards
FROM keyword_metrics_daily kmd
JOIN keywords k ON k.id = kmd.keyword_id
WHERE kmd.source = 'pinterest'
  AND kmd.collected_on = CURRENT_DATE
ORDER BY kmd.social_mentions DESC
LIMIT 10;
```

### View API Usage

```sql
-- Correct query for API usage (daily tracking for Pinterest)
SELECT
  service,
  period,
  requests_made,
  limit_per_period,
  ROUND((requests_made::NUMERIC / limit_per_period * 100), 2) as usage_percent,
  last_request_at
FROM api_usage_tracking
WHERE service = 'pinterest'
ORDER BY period DESC
LIMIT 7;
```

### View Platform Trends

```sql
-- View Pinterest-specific trends
SELECT
  k.term,
  spt.platform,
  spt.mention_count,
  spt.engagement_score,
  spt.sentiment,
  spt.metadata->>'save_count' as saves,
  spt.collected_at
FROM social_platform_trends spt
JOIN keywords k ON k.id = spt.keyword_id
WHERE spt.platform = 'pinterest'
ORDER BY spt.collected_at DESC
LIMIT 10;
```

---

## 🔧 Quick Fix Commands

Run these in order in Supabase SQL Editor:

```sql
-- 1. Enable feature flag
UPDATE feature_flags SET is_enabled = true WHERE key = 'pinterest_collection';

-- 2. Add missing columns
ALTER TABLE keyword_metrics_daily
  ADD COLUMN IF NOT EXISTS social_mentions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_sentiment NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS social_platforms JSONB DEFAULT '{}'::jsonb;

-- 3. Create missing table
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  period TEXT NOT NULL,
  requests_made INTEGER DEFAULT 0,
  limit_per_period INTEGER NOT NULL,
  last_request_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service, period)
);

-- 4. Create social_platform_trends table
CREATE TABLE IF NOT EXISTS social_platform_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  engagement_score NUMERIC(12,2),
  sentiment NUMERIC(5,2),
  velocity NUMERIC(10,4),
  top_posts JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Fix track_api_usage function (see fix-track-api-usage-function.sql)

-- 6. Verify all is working
SELECT 'Feature Flag' as item,
  CASE WHEN is_enabled THEN '✅' ELSE '❌' END as status
FROM feature_flags WHERE key = 'pinterest_collection';
```

---

## 📝 Summary of Issues & Fixes

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Feature flag disabled | Not enabled in DB | `UPDATE feature_flags SET is_enabled = true` |
| `social_mentions` missing | Migration not applied | `ALTER TABLE keyword_metrics_daily ADD COLUMN` |
| `api_usage_tracking` missing | Migration not applied | `CREATE TABLE api_usage_tracking` |
| Daily vs monthly tracking | Mismatch in RPC function | Update `track_api_usage` function |

---

## 🆘 Still Having Issues?

1. **Check migration status:**
   ```sql
   SELECT * FROM supabase_migrations ORDER BY version DESC LIMIT 10;
   ```

2. **Manually apply migration:**
   - Copy contents of `supabase/migrations/0031_social_metrics_and_watchlist.sql`
   - Paste into Supabase SQL Editor
   - Run it

3. **Check logs:**
   - GitHub Actions > Pinterest Trends Collector > View logs
   - Look for specific error messages

4. **Test locally first:**
   ```bash
   ./test-pinterest-local.sh
   ```
   This will show detailed error messages.

---

## ✅ Final Checklist

After applying all fixes:

- [ ] Feature flag `pinterest_collection` is enabled
- [ ] Column `social_mentions` exists in `keyword_metrics_daily`
- [ ] Table `api_usage_tracking` exists
- [ ] Table `social_platform_trends` exists
- [ ] Function `track_api_usage` handles daily tracking
- [ ] Local test runs successfully
- [ ] GitHub Actions workflow completes
- [ ] Data appears in database

---

## 📚 Related Files

- `fix-pinterest-database.sql` - Complete database fix script
- `fix-track-api-usage-function.sql` - Fix daily tracking
- `check-and-fix-db.sql` - Diagnostic queries
- `PINTEREST_SETUP.md` - Full setup guide
- `PINTEREST_QUICK_START.md` - Quick reference
