# DataForSEO Metrics & Corpus Pipeline Fix
**Date:** 2025-11-11
**Issue:** Metrics table empty after DataForSEO job completion, preventing corpus population

## Problem Analysis

### Root Cause
The metrics collection job (`jobs/ingest_metrics_and_score.ts`) was generating random/simulated data instead of using the actual DataForSEO metrics already stored in `public.keywords.extras`.

**Pipeline Flow:**
```
DataForSEO API → public.keywords (with extras.dataforseo) ✅
                      ↓
        keyword_metrics_daily (was empty) ❌
                      ↓
             ai_corpus (not populated) ❌
```

### What Was Wrong

1. **Metrics job ignored DataForSEO data:**
   - Line 166 in `ingest_metrics_and_score.ts`: `const hasRealData = Math.random() < 0.3;`
   - Generated random data 70% of the time
   - Used AI inference for the other 30%
   - **Never checked** the `extras.dataforseo` field that contained real API data

2. **Missing npm script:**
   - `jobs:ingest-metrics-to-corpus` script was not defined in `package.json`
   - Could not run corpus ingestion even if metrics were populated

## Changes Made

### 1. Updated `jobs/ingest_metrics_and_score.ts`

**Modified Keyword interface (lines 12-27):**
```typescript
interface Keyword {
  id: string;
  term: string;
  market: string;
  source: string;
  extras?: {
    search_volume?: number;
    cpc?: number;
    dataforseo?: {
      search_volume?: number;
      competition?: number;
      cpc?: number;
    };
    monthly_trend?: Array<{ year: number; month: number; search_volume: number }>;
  };
}
```

**Updated keywords query (line 65):**
```typescript
// Before:
.select("id, term, market, source")

// After:
.select("id, term, market, source, extras")
```

**Rewrote `collectMetrics()` function (lines 164-210):**
```typescript
async function collectMetrics(keyword: Keyword, openai: OpenAI): Promise<MetricsData> {
  let volume: number | null = null;
  let traffic_rank: number | null = null;
  let competition_score: number | null = null;
  let engagement: number | null = null;
  let ai_confidence = 0.0;

  // First, check if we have DataForSEO data in the extras field
  const dataForSEO = keyword.extras?.dataforseo;
  const hasDataForSEO = dataForSEO && (dataForSEO.search_volume !== undefined || dataForSEO.competition !== undefined);

  if (hasDataForSEO) {
    // Use DataForSEO data - this is real API data, not simulated
    volume = dataForSEO.search_volume ?? keyword.extras?.search_volume ?? null;
    competition_score = dataForSEO.competition !== undefined ? dataForSEO.competition * 100 : null;

    // Calculate engagement from CPC (higher CPC often correlates with higher engagement)
    const cpc = dataForSEO.cpc ?? keyword.extras?.cpc ?? null;
    engagement = cpc !== null ? Math.min(cpc * 10, 100) : null;

    // For traffic_rank, we don't have direct data, but we can estimate from search volume
    // Higher volume = lower (better) rank
    traffic_rank = volume !== null ? Math.max(1, Math.floor(1000000 / (volume + 1))) : null;

    // DataForSEO data has high confidence (0.95 = 95% confidence)
    ai_confidence = 0.95;

    console.log(`[INFO] Using DataForSEO data for "${keyword.term}": volume=${volume}, competition=${competition_score?.toFixed(2)}`);
  } else {
    // Fallback to AI inference for keywords without DataForSEO data
    console.log(`[INFO] No DataForSEO data for "${keyword.term}", using AI inference`);
    const inference = await inferMetricsWithAI(keyword, openai);
    volume = inference.volume ?? null;
    traffic_rank = inference.traffic_rank ?? null;
    competition_score = inference.competition_score ?? null;
    engagement = inference.engagement ?? null;
    ai_confidence = inference.confidence;
  }

  return {
    volume,
    traffic_rank,
    competition_score,
    engagement,
    ai_confidence,
  };
}
```

### 2. Updated `package.json`

**Added missing corpus ingestion script (line 23):**
```json
{
  "scripts": {
    "jobs:ingest-metrics": "tsx jobs/ingest_metrics_and_score.ts",
    "jobs:ingest-metrics-to-corpus": "tsx jobs/ingest-metrics-to-corpus.ts",  // ← NEW
    "jobs:social-aggregator": "tsx jobs/social-metrics-aggregator.ts",
    // ...
  }
}
```

## How to Run the Complete Pipeline

### Prerequisites
Ensure you have the following environment variables set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (for AI inference fallback)

### Step 1: Run Metrics Collection
```bash
npm run jobs:ingest-metrics
```

**What this does:**
- Fetches all keywords from the last 90 days
- For each keyword:
  - **First checks** if `extras.dataforseo` has data (search_volume, competition, cpc)
  - **If yes**: Uses real DataForSEO metrics (95% confidence)
  - **If no**: Falls back to AI inference (~70% confidence)
- Inserts metrics into `keyword_metrics_daily` table
- Calls `apply_demand_trend_for_date()` RPC to compute demand indices

**Expected output:**
```
[INFO] Processing 150 keywords
[INFO] Using DataForSEO data for "handmade gifts": volume=12500, competition=45.50
[INFO] Using DataForSEO data for "vintage jewelry": volume=8900, competition=62.30
...
[INFO] Metrics collection complete. Success: 150, Errors: 0
[INFO] Updated 150 keywords with demand indices and trends
```

### Step 2: Run Corpus Ingestion
```bash
npm run jobs:ingest-metrics-to-corpus
```

**What this does:**
- Fetches keywords updated in the last 7 days (configurable via `LOOKBACK_DAYS`)
- For each keyword:
  - Retrieves daily metrics from `keyword_metrics_daily`
  - Retrieves weekly metrics from `keyword_metrics_weekly`
  - Creates a factual text chunk summarizing all metrics
  - Generates a 384-dimensional semantic embedding using HuggingFace
  - Upserts into `ai_corpus` table with source_type='keyword_metrics'
- Processes in batches of 50 (configurable via `BATCH_SIZE`)

**Expected output:**
```
[INFO] Starting metrics-to-corpus ingestion...
[INFO] Found 150 keywords to process
[INFO] Processing batch 1/3
[INFO] Ingested 50 keyword metrics into ai_corpus
...
[INFO] Successfully ingested 150 metrics into ai_corpus
```

### Step 3: Verify Results

**Check metrics table:**
```sql
SELECT COUNT(*) FROM keyword_metrics_daily;
-- Should show records for your keywords

SELECT keyword_id, collected_on, volume, competition_score, ai_confidence
FROM keyword_metrics_daily
ORDER BY collected_on DESC
LIMIT 10;
```

**Check corpus table:**
```sql
SELECT COUNT(*) FROM ai_corpus WHERE source_type = 'keyword_metrics';
-- Should match the number of keywords processed

SELECT
  id,
  source_type,
  marketplace,
  (source_ref->>'keyword_id') as keyword_id,
  metadata->>'keyword_term' as term,
  LEFT(chunk, 100) as chunk_preview
FROM ai_corpus
WHERE source_type = 'keyword_metrics'
ORDER BY created_at DESC
LIMIT 5;
```

## Environment Variables Reference

### Required
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (has admin permissions)
- `OPENAI_API_KEY` - For AI inference fallback and embeddings

### Optional
- `COUNTRY` - Default: "global"
- `LOOKBACK_DAYS` - Default: 7 (for metrics job), 7 (for corpus job)
- `BATCH_SIZE` - Default: 50 (for corpus job)

## Data Mapping

### DataForSEO → Metrics Table

| DataForSEO Field | Metrics Field | Transformation |
|------------------|---------------|----------------|
| `search_volume` | `volume` | Direct mapping |
| `competition` | `competition_score` | Multiply by 100 (0.45 → 45.0) |
| `cpc` | `engagement` | Multiply by 10, cap at 100 |
| (derived) | `traffic_rank` | Estimate: `1000000 / (volume + 1)` |
| (constant) | `ai_confidence` | 0.95 (95% confidence for real data) |

### Metrics → Corpus Chunk Example

```
Keyword: "handmade gifts". Marketplace: etsy.
Current Metrics: Demand Index: 85.23, Competition: 45.67, Trend Momentum: 12.34
Recent Daily Trends: 2025-11-10: demand=1250, supply=450, competition=0.45;
                     2025-11-09: demand=1180, supply=430, competition=0.44; ...
Weekly Data Points: 4 weeks of historical data available
```

This chunk is then embedded using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) and stored in `ai_corpus` for RAG retrieval.

## Testing

### Run with verbose logging
```bash
# For metrics collection
LOG_LEVEL=debug npm run jobs:ingest-metrics

# For corpus ingestion
LOG_LEVEL=debug npm run jobs:ingest-metrics-to-corpus
```

### Test with subset
```bash
# Only process last 1 day of keywords
LOOKBACK_DAYS=1 npm run jobs:ingest-metrics
LOOKBACK_DAYS=1 npm run jobs:ingest-metrics-to-corpus
```

## Files Modified
- `/home/user/lexyhub/jobs/ingest_metrics_and_score.ts` (lines 12-27, 65, 164-210)
- `/home/user/lexyhub/package.json` (line 23)

## Related Documentation
- `/home/user/lexyhub/docs/internal/DATAFORSEO_PIPELINE_FIX_2025_11_10.md` - Previous DataForSEO fixes
- `/home/user/lexyhub/jobs/dataforseo-k4k/README.md` - DataForSEO ingestion details
- `/home/user/lexyhub/jobs/ingest-metrics-to-corpus.ts` - Corpus ingestion implementation

## Next Steps
1. Run `npm run jobs:ingest-metrics` to populate metrics table
2. Run `npm run jobs:ingest-metrics-to-corpus` to populate ai_corpus
3. Verify both tables are populated correctly
4. Set up cron jobs or scheduled tasks to run these jobs daily/weekly
