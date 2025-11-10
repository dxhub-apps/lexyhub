# Backend Implementation for Extension v4 - Complete

## Summary

All backend API endpoints and database migrations have been implemented for Chrome Extension v4.

---

## API Endpoints Created

### 1. POST /api/ext/keywords/resolve

**File:** `src/app/api/ext/keywords/resolve/route.ts`

**Purpose:** Match candidate keywords against `public.keywords` database

**Features:**
- Accepts array of candidate keywords
- Normalizes using same logic as database (`lexy_normalize_keyword`)
- Returns only verified keywords with `keyword_id`
- Includes optional metrics (demand, competition, ai_score, trend)
- Rate limit: 100 req/min
- Max 100 candidates per request

**Request:**
```json
{
  "candidates": ["handmade jewelry", "silver rings"],
  "marketplace": "etsy",
  "domain": "www.etsy.com"
}
```

**Response:**
```json
{
  "resolved": [
    {
      "term": "handmade jewelry",
      "keyword_id": "uuid",
      "marketplace": "etsy",
      "metrics": {
        "demand": 0.85,
        "competition": 0.62,
        "ai_score": 0.73,
        "trend": "rising"
      }
    }
  ],
  "count": 1
}
```

---

### 2. POST /api/ext/lexybrain/insights

**File:** `src/app/api/ext/lexybrain/insights/route.ts`

**Purpose:** Provide deterministic LexyBrain insights for keywords

**Features:**
- Checks `public.keywords` for keyword existence
- Returns "no_data" if keyword not tracked
- Calls LexyBrain with appropriate capability (radar/market_brief)
- Caches results in `ai_insights` table
- Quota-aware (consumes LexyBrain quota)
- Rate limit: 30 req/min
- Max duration: 20 seconds

**Request:**
```json
{
  "term": "handmade jewelry",
  "keyword_id": "uuid",
  "marketplace": "etsy",
  "url": "https://www.etsy.com/search?q=handmade+jewelry",
  "capability": "keyword_insights",
  "source": "extension"
}
```

**Response (success):**
```json
{
  "keyword": "handmade jewelry",
  "status": "success",
  "metrics": {
    "demand": 0.85,
    "competition": 0.62,
    "momentum": "rising",
    "risk": "medium",
    "ai_score": 0.73
  },
  "insights": [
    "High demand with manageable competition",
    "Seasonal peak expected in Q4",
    "Consider long-tail variations"
  ]
}
```

**Response (no data):**
```json
{
  "keyword": "random term",
  "status": "no_data",
  "message": "No reliable data available for this keyword"
}
```

---

### 3. POST /api/ext/events

**File:** `src/app/api/ext/events/route.ts`

**Purpose:** Accept structured events for deterministic aggregation

**Features:**
- Privacy-first validation (no PII, no data URLs, no sensitive patterns)
- Stores in `extension_events` table
- Rate limit: 200 req/min
- URL length limit: 2000 chars
- Metadata size limit: 10KB

**Supported Event Types:**
- `keyword_search_event`: Search page activity
- `listing_view_event`: Product page views
- `shop_profile_event`: Shop/store visits
- `lexy_action_event`: Extension actions

**Request:**
```json
{
  "event_type": "keyword_search_event",
  "marketplace": "etsy",
  "keyword_id": "uuid",
  "url": "https://www.etsy.com/search?q=handmade+jewelry",
  "timestamp": "2025-11-10T12:00:00Z",
  "source": "extension",
  "metadata": {
    "search_position": 1,
    "page_number": 1
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Database Migrations

### Migration 0049: Extension Events Table

**File:** `supabase/migrations/0049_extension_events.sql`

**Creates:**
- `public.extension_events` table
  - `id` (bigserial, primary key)
  - `user_id` (uuid, not null)
  - `event_type` (text, not null)
  - `marketplace` (text, nullable)
  - `keyword_id` (uuid, FK to keywords, nullable)
  - `url` (text, nullable)
  - `source` (text, default 'extension')
  - `occurred_at` (timestamptz, default now())
  - `metadata` (jsonb, default '{}')

**Indexes:**
- `extension_events_user_idx` on (user_id, occurred_at)
- `extension_events_type_idx` on (event_type, occurred_at)
- `extension_events_keyword_idx` on (keyword_id, occurred_at)
- `extension_events_marketplace_idx` on (marketplace, occurred_at)

**Purpose:** Structured event tracking for ai_corpus enrichment

---

### Migration 0050: Signup Source Tracking

**File:** `supabase/migrations/0050_signup_source_tracking.sql`

**Changes:**
1. Adds `signup_source` column to `user_profiles`
   - Type: text
   - Default: 'web'
   - Indexed for analytics

2. Updates `ensure_user_profile()` RPC function
   - New signature: `ensure_user_profile(p_user_id uuid, p_signup_source text DEFAULT 'web')`
   - Sets initial plan based on signup source:
     - 'extension' → 'free+' plan with 50 bonus AI quota
     - other → 'free' plan

**Purpose:** Track extension signups and apply bonus quota

---

## Auth & Signup Flow Updates

### Updated Files

1. **`src/app/api/auth/init-profile/route.ts`**
   - Now accepts `signup_source` in request body
   - Passes to `ensure_user_profile()` RPC
   - Returns signup_source in response

2. **`src/app/auth/extension/page.tsx`**
   - Calls `/api/auth/init-profile` with `signup_source: 'extension'`
   - Updated bonus messaging for v4
   - Initializes profile on successful auth

3. **`src/app/extension-signup/page.tsx`** (NEW)
   - Redirect page for extension entry point
   - URL: `/extension-signup?ref=chrome`
   - Redirects to `/auth/extension`

---

## Migration Application

### Required Steps

The database migrations need to be applied to the production/staging database:

```bash
# Migration 0049 - Extension Events
psql $DATABASE_URL < supabase/migrations/0049_extension_events.sql

# Migration 0050 - Signup Source Tracking
psql $DATABASE_URL < supabase/migrations/0050_signup_source_tracking.sql
```

**Or using Supabase CLI:**
```bash
supabase db push
```

**Or using dbmate:**
```bash
dbmate up
```

---

## Testing Checklist

### Keywords Resolution Endpoint

- [ ] Send candidates for a known marketplace
- [ ] Verify only verified keywords returned
- [ ] Check metrics included correctly
- [ ] Test with 100+ candidates (should fail)
- [ ] Test with invalid marketplace (should fail)
- [ ] Test rate limiting (101 requests/min should fail)

### LexyBrain Insights Endpoint

- [ ] Request insights for tracked keyword
- [ ] Verify metrics and insights returned
- [ ] Request insights for untracked keyword (should return no_data)
- [ ] Check quota consumption
- [ ] Verify caching works (2nd request should be cached)
- [ ] Test rate limiting (31 requests/min should fail)

### Events Endpoint

- [ ] Send keyword_search_event
- [ ] Send listing_view_event
- [ ] Send shop_profile_event
- [ ] Send lexy_action_event
- [ ] Verify events stored in extension_events table
- [ ] Test with data: URL (should fail)
- [ ] Test with localhost URL (should fail)
- [ ] Test with oversized metadata (should fail)
- [ ] Test rate limiting (201 requests/min should fail)

### Signup Source Tracking

- [ ] Sign up through /extension-signup
- [ ] Verify user_profiles.signup_source = 'extension'
- [ ] Verify initial plan = 'free+'
- [ ] Verify ai_usage_quota = 50
- [ ] Sign up through regular web flow
- [ ] Verify user_profiles.signup_source = 'web'
- [ ] Verify initial plan = 'free'
- [ ] Verify ai_usage_quota = 0

---

## Integration with Extension

### Extension Should:

1. **On authentication:**
   - Navigate to `https://lexyhub.com/extension-signup?ref=chrome`
   - Poll for token in localStorage
   - Store token in chrome.storage

2. **For keyword highlighting:**
   - Extract candidates from page
   - Call `POST /api/ext/keywords/resolve`
   - Highlight only returned verified keywords

3. **For LexyBrain panel:**
   - Call `POST /api/ext/lexybrain/insights`
   - Display metrics and insights
   - Handle "no_data" status gracefully

4. **For event tracking:**
   - Call `POST /api/ext/events` for user actions
   - Include required fields: event_type, marketplace, url
   - Optional: keyword_id, metadata

---

## Security & Privacy

### Implemented Protections:

1. **Authentication:** All endpoints require valid JWT token
2. **Rate Limiting:** Per-user rate limits on all endpoints
3. **URL Validation:** Blocks data URLs, localhost, sensitive patterns
4. **Size Limits:** URL max 2000 chars, metadata max 10KB
5. **No PII:** Events table designed for public marketplace data only
6. **Quota Enforcement:** LexyBrain insights consume user quota

---

## Performance Considerations

### Optimizations:

1. **Keyword Resolution:** Uses indexed `term_normalized` column
2. **LexyBrain Caching:** Results cached in `ai_insights` table
3. **Event Batching:** Events stored asynchronously
4. **Rate Limiting:** In-memory rate limiting per user

### Database Indexes Created:

- `extension_events_user_idx`
- `extension_events_type_idx`
- `extension_events_keyword_idx`
- `extension_events_marketplace_idx`
- `user_profiles_signup_source_idx`

---

## Monitoring & Analytics

### Queries for Insights:

**Extension signup conversion:**
```sql
SELECT signup_source, COUNT(*) as count
FROM user_profiles
GROUP BY signup_source
ORDER BY count DESC;
```

**Event type distribution:**
```sql
SELECT event_type, COUNT(*) as count
FROM extension_events
WHERE occurred_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;
```

**Top marketplaces:**
```sql
SELECT marketplace, COUNT(*) as events
FROM extension_events
WHERE occurred_at > NOW() - INTERVAL '7 days'
GROUP BY marketplace
ORDER BY events DESC;
```

**Extension user growth:**
```sql
SELECT DATE(created_at) as day, COUNT(*) as signups
FROM user_profiles
WHERE signup_source = 'extension'
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 30;
```

---

## Deployment Notes

### Environment Variables Required:

- `NEXT_PUBLIC_APP_URL` - Base URL for app (used in quota exceeded responses)
- All existing LexyBrain config variables

### Post-Deployment:

1. Apply database migrations (0049, 0050)
2. Verify API endpoints accessible
3. Test with extension locally
4. Monitor error rates and quotas
5. Check Sentry for any issues

---

## Files Changed Summary

**New Files:**
- `src/app/api/ext/keywords/resolve/route.ts`
- `src/app/api/ext/lexybrain/insights/route.ts`
- `src/app/api/ext/events/route.ts`
- `src/app/extension-signup/page.tsx`
- `supabase/migrations/0049_extension_events.sql`
- `supabase/migrations/0050_signup_source_tracking.sql`

**Modified Files:**
- `src/app/api/auth/init-profile/route.ts`
- `src/app/auth/extension/page.tsx`

---

## Success Metrics

After deployment, we should see:

1. ✅ Extension users tracked with `signup_source = 'extension'`
2. ✅ Bonus quota (50 AI calls) applied automatically
3. ✅ Keywords resolved against public.keywords only
4. ✅ LexyBrain insights provided with proper quota enforcement
5. ✅ Events flowing into extension_events table
6. ✅ No PII or sensitive data in events
7. ✅ Rate limits protecting against abuse
8. ✅ Caching reducing LexyBrain API load

---

## Next Steps

1. **Apply Migrations** - Run migration files against database
2. **Deploy Backend** - Deploy to production/staging
3. **Test Integration** - Verify extension works end-to-end
4. **Monitor Metrics** - Watch signup conversion and event volume
5. **Optimize Queries** - Add indexes if needed based on usage patterns

---

**Implementation Status:** ✅ COMPLETE

All backend requirements for Chrome Extension v4 have been implemented and are ready for deployment.
