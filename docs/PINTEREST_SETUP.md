# Pinterest Integration Setup Guide

## 📋 Overview

LexyHub's Pinterest integration is a **server-to-server API-based** system for keyword trend collection and analysis. It does NOT use OAuth for user authentication - instead, it uses a direct access token for data collection.

> **⚠️ Encountering errors?** See [PINTEREST_TROUBLESHOOTING.md](./PINTEREST_TROUBLESHOOTING.md) for detailed fixes including:
> - Feature flag disabled error
> - Missing table/column errors
> - Daily vs monthly tracking issues

---

## 🔧 Current Implementation

### Architecture
- **Type**: Server-side API integration (not OAuth)
- **Purpose**: Keyword trend collection & seasonal detection
- **API**: Pinterest API v5 (Free Tier)
- **Limits**: 200 requests/day
- **Schedule**: Every 2 hours (12 runs/day × ~17 searches = ~204/day)

### What It Does
✅ Collects trending keywords from Pinterest searches
✅ Analyzes engagement metrics (saves, comments, reactions)
✅ Detects seasonal trends (Christmas, Halloween, etc.)
✅ Performs sentiment analysis
✅ Stores data in Supabase for multi-platform trend analysis
✅ Browser extension for UI keyword extraction

### What It Doesn't Do
❌ User OAuth (connect individual Pinterest accounts)
❌ Post to Pinterest on behalf of users
❌ Access user-specific boards or pins

---

## 🚀 Setup Instructions

### Step 1: Get Pinterest API Access

1. **Create a Pinterest App**
   - Go to: https://developers.pinterest.com/
   - Click **"My Apps"** > **"Create app"**
   - Fill in app details:
     - **App name**: LexyHub Trend Collector
     - **App description**: Keyword trend analysis for e-commerce sellers
     - **Platform**: Web

2. **Get Your Access Token**
   - In your app dashboard, navigate to **"Access Token"**
   - Click **"Generate token"**
   - Copy the token (starts with `pina_`)

3. **Configure Redirect URI (Optional for Current Setup)**
   - Since we're using server-to-server authentication, the redirect URI is **not currently used**
   - You can set it to: `http://localhost:3000` or `https://yourdomain.com`
   - This is only needed if you implement OAuth in the future

### Step 2: Configure Environment Variables

#### **Option A: GitHub Secrets (Production)**

You mentioned `PINTEREST_ACCESS_TOKEN` is already configured on GitHub. Verify it:

1. Go to your GitHub repository
2. Settings > Secrets and variables > Actions
3. Verify `PINTEREST_ACCESS_TOKEN` exists with your token

Also verify these are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

#### **Option B: Local Development**

Create `.env.local` (or update existing):

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Pinterest
PINTEREST_ACCESS_TOKEN=pina_your_access_token_here

# Optional: Override defaults
PINTEREST_DAILY_LIMIT=200
PINTEREST_PER_RUN_BUDGET=17
```

### Step 3: Verify Database Setup

The Pinterest integration requires these database tables (already in migration `0031_social_metrics_and_watchlist.sql`):

- `feature_flags` - with `pinterest_collection` enabled
- `keywords` - stores extracted keywords
- `keyword_metrics_daily` - daily aggregated metrics
- `social_platform_trends` - Pinterest-specific trend data
- `trend_series` - time-series data
- `api_usage_tracking` - tracks API quota usage

**Verify migrations are applied:**

```bash
# Check if migration is applied
cd supabase
npx supabase db pull
```

Or in Supabase dashboard:
1. Go to SQL Editor
2. Run: `SELECT * FROM feature_flags WHERE key = 'pinterest_collection';`
3. Verify `is_enabled = true`

### Step 4: Test Locally

We've created a test script for you:

```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export PINTEREST_ACCESS_TOKEN=pina_your_token

# Run the test
./test-pinterest-local.sh
```

This will:
- Validate environment variables
- Run 5 test searches (reduced for testing)
- Store keywords in your database
- Show usage statistics

**Expected Output:**

```
🔍 Testing Pinterest Integration...
✅ Environment variables configured

🚀 Running Pinterest Keyword Collector...
   - Daily Limit: 200
   - This Run Budget: 5

pinterest_collector:start
pinterest_usage:5/200 (2.5%)
pinterest_budget:5 searches
collecting:query=handmade gifts limit=25
collecting:query=personalized limit=25
...
pins_processed:120 keywords_extracted:85
keywords_stored:85
pinterest_collector:success

✅ Pinterest collection completed!
```

### Step 5: Verify Data in Supabase

After running the test, check these tables in Supabase:

```sql
-- Check collected keywords
SELECT
  term,
  source,
  tier,
  method,
  extras->>'save_count' as pinterest_saves,
  extras->>'engagement_sum' as engagement,
  extras->>'seasonal' as seasonal_info,
  created_at
FROM keywords
WHERE source = 'pinterest'
ORDER BY created_at DESC
LIMIT 10;

-- Check daily metrics
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

-- Check API usage (Pinterest uses daily tracking: YYYY-MM-DD)
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

-- Check trend series
SELECT
  term,
  trend_score,
  extras->>'seasonal' as seasonal,
  recorded_on
FROM trend_series
WHERE source = 'pinterest'
  AND recorded_on = CURRENT_DATE
ORDER BY trend_score DESC
LIMIT 10;

-- Check platform-specific trends
SELECT
  k.term,
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

**Note:** If you get errors about missing columns or tables, see `PINTEREST_TROUBLESHOOTING.md` for fixes.

### Step 6: Enable GitHub Actions Workflow

The workflow is already configured at `.github/workflows/pinterest-trends-collector.yml`.

**To test it manually:**

1. Go to GitHub > Actions
2. Select "Pinterest Trends Collector"
3. Click "Run workflow"
4. (Optional) Set custom budget (default: 17)

**Automatic Schedule:**
- Runs every 2 hours at :15 past the hour
- Cron: `15 */2 * * *`
- Total runs per day: 12
- Searches per run: ~17
- Total daily searches: ~204 (within 200 limit)

---

## 📊 How It Works

### Data Collection Flow

```
Pinterest Search API
        ↓
[Search 7 product queries]
        ↓
[Extract keywords from pin titles/descriptions]
        ↓
[Calculate engagement: saves×3 + comments×2 + reactions]
        ↓
[Analyze sentiment & detect seasonal patterns]
        ↓
Store in Supabase:
├── keywords (upsert via lexy_upsert_keyword)
├── keyword_metrics_daily
├── social_platform_trends
└── trend_series
        ↓
[Hourly Social Metrics Aggregator]
        ↓
Multi-platform trend analysis
(Reddit 35% + Pinterest 40% + Twitter 20% + TikTok 5%)
```

### Search Queries Used

The collector rotates through these product-focused queries:

1. "handmade gifts"
2. "personalized"
3. "custom design"
4. "print on demand"
5. "etsy products"
6. "trending products"
7. "small business"

### Categories

Rotates through 8 categories:
- diy_and_crafts
- home_decor
- weddings
- gifts
- fashion
- art
- food_and_drink
- beauty

### Engagement Scoring

Pinterest uses a weighted engagement score (highest purchase intent):

```javascript
engagement = (saves × 3) + (comments × 2) + (reactions × 1)
```

**Why saves are weighted 3x:**
- Saves indicate strong purchase intent
- Users save products they plan to buy
- Minimum 5 saves required to be considered

### Seasonal Detection

Automatically detects seasonal keywords and tracks lead times:

| Season | Months | Lead Time |
|--------|--------|-----------|
| Christmas | Nov-Dec | 60 days |
| Halloween | Oct | 45 days |
| Valentine's Day | Feb | 30 days |
| Mother's Day | May | 30 days |
| Father's Day | Jun | 30 days |
| Easter | Mar-Apr | 30 days |
| Summer | Jun-Aug | 60 days |
| Fall | Sep-Nov | 45 days |
| Spring | Mar-May | 45 days |
| Winter | Dec-Feb | 45 days |

---

## 🔍 Monitoring & Troubleshooting

### Check API Usage

```sql
-- Pinterest uses daily tracking (YYYY-MM-DD format)
SELECT
  period,
  requests_made,
  limit_per_period,
  ROUND((requests_made::NUMERIC / limit_per_period * 100), 2) as usage_percent,
  last_request_at,
  last_reset_at
FROM api_usage_tracking
WHERE service = 'pinterest'
ORDER BY period DESC
LIMIT 7;
```

### Common Issues

> **📚 Detailed Solutions:** See [PINTEREST_TROUBLESHOOTING.md](./PINTEREST_TROUBLESHOOTING.md) for comprehensive error fixes.

#### 1. **"pinterest_collection:disabled by feature flag"**
- ❌ Feature flag is disabled in database
- ✅ Run: `UPDATE feature_flags SET is_enabled = true WHERE key = 'pinterest_collection';`
- 📖 See troubleshooting guide for full fix

#### 2. **"column social_mentions does not exist"**
- ❌ Database migration not applied
- ✅ Add columns: `ALTER TABLE keyword_metrics_daily ADD COLUMN social_mentions...`
- 📖 See troubleshooting guide for full script

#### 3. **"relation api_usage_tracking does not exist"**
- ❌ Database table not created
- ✅ Create table: `CREATE TABLE api_usage_tracking...`
- 📖 See troubleshooting guide for full schema

#### 4. **401 Unauthorized**
- ❌ Invalid `PINTEREST_ACCESS_TOKEN`
- ✅ Regenerate token in Pinterest developer dashboard

#### 5. **429 Rate Limited**
- ❌ Exceeded 200 requests/day
- ✅ Wait until next day (resets at midnight UTC)
- ✅ Check `api_usage_tracking` table

#### 6. **No keywords collected**
- ❌ Pins don't meet minimum saves threshold (5)
- ✅ Normal - only high-engagement pins are collected

#### 7. **Workflow fails on GitHub**
- ❌ Missing GitHub secrets
- ✅ Verify all secrets are set in repository settings
- ❌ Database migration not applied
- ✅ Run fix scripts from troubleshooting guide

### Enable Debug Logging

In the workflow or locally, you can see detailed logs:

```bash
# The script already outputs detailed logs
node scripts/pinterest-keyword-collector.mjs
```

Look for these log patterns:
- `pinterest_usage:X/200` - Current quota usage
- `collecting:query=X` - Which query is being searched
- `pins_processed:X keywords_extracted:Y` - Collection stats
- `keywords_stored:X` - Successfully stored keywords

---

## 🎯 Performance Metrics

### Expected Results (per day)

| Metric | Value |
|--------|-------|
| API Calls | ~204 |
| Pins Processed | 500-1,000 |
| Keywords Extracted | 300-800 |
| Keywords Stored | 200-600 |
| Seasonal Keywords | 20-50 |
| High-engagement Keywords | 50-150 |

### Data Quality Filters

Only keywords meeting these criteria are stored:

✅ Phrase length: 8+ characters
✅ N-gram range: 2-5 words
✅ Contains at least one domain term (handmade, custom, gift, etc.)
✅ Minimum 5 saves (purchase intent threshold)
✅ Valid sentiment score (-1 to +1)

---

## 🔮 Future Enhancements (Optional)

If you want to add **OAuth for user accounts** (like Etsy integration), you would need to:

### 1. Implement OAuth Flow

Create `/src/app/api/auth/pinterest/route.ts` (similar to `/src/app/api/auth/etsy/route.ts`):

```typescript
// Would handle:
// - GET: Generate authorization URL
// - GET with ?code: Exchange code for token
// - POST: Link Pinterest account to user
```

### 2. Add Environment Variables

Update `.env.example` and `src/lib/env.ts`:

```bash
PINTEREST_CLIENT_ID=your-app-id
PINTEREST_CLIENT_SECRET=your-app-secret
PINTEREST_REDIRECT_URI=https://yourdomain.com/api/auth/callback/pinterest
```

### 3. Configure Redirect URI in Pinterest App

Set redirect URI to: `https://yourdomain.com/api/auth/callback/pinterest`

### 4. Update Database Schema

Add OAuth tokens to `marketplace_accounts` table (already supports multiple providers).

**Note:** This is **not required** for the current trend collection implementation!

---

## 📚 Related Files

### Core Implementation
- `scripts/pinterest-keyword-collector.mjs` - Main collection script
- `.github/workflows/pinterest-trends-collector.yml` - GitHub Actions workflow
- `extension/src/content/pinterest.ts` - Browser extension integration

### Configuration
- `config/social-platforms.yml` - Platform configuration
- `src/lib/env.ts` - Environment variable schema
- `.env.example` - Environment template

### Database
- `supabase/migrations/0031_social_metrics_and_watchlist.sql` - Schema & feature flags

### Documentation
- `docs/SOCIAL_KEYWORD_PIPELINE.md` - Complete system architecture
- `docs/SOCIAL_PIPELINE_TODO.md` - Implementation roadmap

---

## ✅ Checklist

Before going live, verify:

- [ ] Pinterest app created with API access
- [ ] Access token generated
- [ ] `PINTEREST_ACCESS_TOKEN` set in GitHub Secrets
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] Database migrations applied (`0031_social_metrics_and_watchlist.sql`)
- [ ] Feature flag `pinterest_collection` enabled
- [ ] Local test successful (`./test-pinterest-local.sh`)
- [ ] GitHub Actions workflow enabled
- [ ] First workflow run completed successfully
- [ ] Data appears in Supabase tables
- [ ] API usage tracking working

---

## 🆘 Support

If you encounter issues:

1. Check GitHub Actions logs for workflow runs
2. Verify API usage in `api_usage_tracking` table
3. Confirm feature flag is enabled
4. Test locally with `./test-pinterest-local.sh`
5. Check Pinterest API status: https://status.pinterest.com/

---

## 🎉 Summary

**For your current setup (data collection), you need:**

1. ✅ Pinterest Access Token (already have)
2. ✅ GitHub Secret configured (already done)
3. ✅ Database migration applied
4. ✅ Feature flag enabled

**You DON'T need:**
- ❌ OAuth redirect URI configuration (not used)
- ❌ User authentication flow
- ❌ Pinterest account linking

The **redirect URI field** in your Pinterest app settings can be set to any valid URL (like `http://localhost:3000`) - it won't be used by the current implementation.

**Your Pinterest integration is ready to go! 🚀**

Just run the test script or trigger the GitHub Actions workflow to start collecting trend data.
