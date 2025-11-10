# Pinterest Integration - Quick Fix Summary

## 🚨 Issues You Encountered

You ran into 3 main errors:

1. ❌ `pinterest_collection:disabled by feature flag`
2. ❌ `column kmd.social_mentions does not exist`
3. ❌ `relation "api_usage_tracking" does not exist`

## ✅ The Fix (5 minutes)

### Step 1: Run the Complete Fix Script

1. **Open Supabase Dashboard** → SQL Editor
2. **Open this file:** `fix-pinterest-database.sql`
3. **Copy all contents** (the entire file)
4. **Paste into SQL Editor**
5. **Click "Run"**

This single script will:
- ✅ Enable the `pinterest_collection` feature flag
- ✅ Add missing `social_mentions`, `social_sentiment`, `social_platforms` columns
- ✅ Create `api_usage_tracking` table
- ✅ Create `social_platform_trends` table
- ✅ Fix the `track_api_usage` function (daily tracking for Pinterest)
- ✅ Run verification checks

### Step 2: Verify the Fix

The script includes automatic verification at the end. You should see:

```
check_type                                  | status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature Flag                                | ✅ ENABLED
api_usage_tracking table                    | ✅ EXISTS
social_platform_trends table                | ✅ EXISTS
social columns in keyword_metrics_daily     | ✅ EXISTS (3/3)
track_api_usage function                    | ✅ EXISTS
```

### Step 3: Test Pinterest Collector

**Option A: GitHub Actions**
```
1. Go to GitHub → Actions
2. Select "Pinterest Trends Collector"
3. Click "Run workflow"
4. Check logs for success ✅
```

**Option B: Local Test**
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export PINTEREST_ACCESS_TOKEN=pina_your_token

./test-pinterest-local.sh
```

**Expected Output:**
```
pinterest_collector:start
pinterest_usage:0/200 (0.0%)
pinterest_budget:5 searches
collecting:query=handmade gifts limit=25
pins_processed:XX keywords_extracted:YY
keywords_stored:ZZ
pinterest_collector:success ✅
```

---

## 📚 Documentation Files Created

| File | Purpose |
|------|---------|
| **fix-pinterest-database.sql** | Complete fix script (RUN THIS FIRST) |
| **PINTEREST_TROUBLESHOOTING.md** | Detailed error explanations & fixes |
| **PINTEREST_SETUP.md** | Full setup guide with corrected queries |
| **PINTEREST_QUICK_START.md** | 5-minute quickstart |
| **fix-track-api-usage-function.sql** | Daily tracking fix (included in main fix) |
| **check-and-fix-db.sql** | Diagnostic queries |
| **test-pinterest-local.sh** | Local testing script |

---

## 🎯 What Was Wrong

### Issue 1: Feature Flag Disabled
The `pinterest_collection` feature flag existed in the migration file but was disabled in your database.

**Fix:** `UPDATE feature_flags SET is_enabled = true WHERE key = 'pinterest_collection';`

### Issue 2: Missing Columns
Migration `0031_social_metrics_and_watchlist.sql` adds columns to `keyword_metrics_daily`, but they weren't applied to your database yet.

**Fix:** `ALTER TABLE keyword_metrics_daily ADD COLUMN social_mentions...`

### Issue 3: Missing Table
The `api_usage_tracking` table from migration 0031 wasn't created yet.

**Fix:** `CREATE TABLE api_usage_tracking...`

### Issue 4: Daily vs Monthly Tracking
The Pinterest collector expects **daily** tracking (`2025-11-06`) but the default RPC function used **monthly** tracking (`2025-11`).

**Fix:** Updated `track_api_usage` function to use daily tracking for Pinterest.

---

## 🔍 Root Cause

The database migration `0031_social_metrics_and_watchlist.sql` exists in your codebase but hasn't been fully applied to your Supabase database yet.

**Why?**
- The migration file is present locally (committed Nov 6, 13:03)
- But Supabase migrations may not have been pushed/applied to remote

**Solution:**
Run the fix script which manually creates everything needed.

---

## ✅ After the Fix

Once you run `fix-pinterest-database.sql`, your Pinterest integration will:

1. ✅ Collect keywords every 2 hours automatically
2. ✅ Store 200-600 keywords per day
3. ✅ Track engagement metrics (saves × 3 + comments × 2)
4. ✅ Detect seasonal trends
5. ✅ Respect 200 requests/day limit
6. ✅ Work with multi-platform trend analysis (40% weight)

---

## 📊 Verify Data Collection

After the first successful run, check Supabase:

```sql
-- See collected keywords
SELECT term, extras->>'save_count' as saves, created_at
FROM keywords
WHERE source = 'pinterest'
ORDER BY created_at DESC
LIMIT 5;

-- Check today's usage
SELECT requests_made, limit_per_period, last_request_at
FROM api_usage_tracking
WHERE service = 'pinterest'
AND period = TO_CHAR(NOW(), 'YYYY-MM-DD');
```

---

## 🆘 Still Having Issues?

1. **See detailed guide:** [PINTEREST_TROUBLESHOOTING.md](./PINTEREST_TROUBLESHOOTING.md)
2. **Check setup:** [PINTEREST_SETUP.md](./PINTEREST_SETUP.md)
3. **Quick reference:** [PINTEREST_QUICK_START.md](./PINTEREST_QUICK_START.md)

---

## 🎉 Summary

**What to do RIGHT NOW:**

1. Open Supabase SQL Editor
2. Run `fix-pinterest-database.sql`
3. Verify all checks show ✅
4. Test the collector (GitHub Actions or locally)
5. Done! Pinterest integration is working 🚀

**Time required:** ~5 minutes

**All changes committed to:** `claude/integrate-pinterest-api-011CUrgU2n6LcYu5FvTfpWgn`
