# DataForSEO Keywords For Keywords Ingestion

## Overview

The DataForSEO K4K (Keywords For Keywords) ingestion job expands seed keywords using the **DataForSEO Google Ads Keywords For Keywords Standard API** and upserts normalized results into the LexyHub PostgreSQL database.

This pipeline enables LexyHub to build a comprehensive keyword database with real market data including search volume, CPC, competition metrics, and monthly trend data.

## Architecture

### System Flow

```
┌─────────────────┐
│  keyword_seeds  │
│   (enabled=true)│
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Group by Locale    │
│  (lang + location)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Chunk into Tasks   │
│  (max 20 per task)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Post to DataForSEO  │
│  (with concurrency) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Poll tasks_ready   │
│  (until complete)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Fetch Results      │
│  (with concurrency) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Save raw_sources   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Normalize Keywords │
│  (validation rules) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Upsert to keywords  │
│   (deduplicated)    │
└─────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Main Entry | `jobs/dataforseo-k4k/index.ts` | Orchestrates the entire pipeline |
| Configuration | `jobs/dataforseo-k4k/config.ts` | Validates environment variables |
| HTTP Client | `jobs/dataforseo-k4k/client.ts` | Handles DataForSEO API calls with retries |
| Normalization | `jobs/dataforseo-k4k/normalize.ts` | Cleans and validates keyword terms |
| Polling | `jobs/dataforseo-k4k/poller.ts` | Tracks task completion status |
| Persistence | `jobs/dataforseo-k4k/supabase.ts` | Database read/write operations |
| Types | `jobs/dataforseo-k4k/types.ts` | TypeScript interfaces |

## Database Schema

### Required Tables

#### `keyword_seeds`
Stores seed keywords to be expanded.

```sql
CREATE TABLE keyword_seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  market text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  language_code text DEFAULT 'en',
  location_code text DEFAULT '2840',
  priority integer DEFAULT 0,
  status text DEFAULT 'pending',
  last_run_at timestamptz,
  next_run_at timestamptz,
  term_normalized text GENERATED ALWAYS AS (lexy_normalize_keyword(term)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `raw_sources`
Archives complete API responses for audit and replay.

```sql
CREATE TABLE raw_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  source_type text NOT NULL,
  source_key text,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
```

#### `keywords`
Normalized keyword golden source with market metrics.

```sql
CREATE TABLE keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  term_normalized text,
  source text NOT NULL,
  market text NOT NULL,
  tier text DEFAULT 'free',
  extras jsonb DEFAULT '{}',
  competition_score numeric(6,3),
  freshness_ts timestamptz,
  ingest_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Note**: DataForSEO metrics (`search_volume`, `cpc`, `monthly_trend`) are stored in the `extras` JSONB column.

## Configuration

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATAFORSEO_LOGIN` | DataForSEO account username | `user@example.com` |
| `DATAFORSEO_PASSWORD` | DataForSEO account password | `your-password` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGc...` |

#### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `LEXYHUB_MARKET` | `google` | Market identifier |
| `DEFAULT_LANGUAGE_CODE` | `en` | ISO language code |
| `DEFAULT_LOCATION_CODE` | `2840` | DataForSEO location code (2840 = USA) |
| `K4K_MAX_TERMS_PER_TASK` | `20` | Max keywords per API task (max: 20) |
| `K4K_DEVICE` | `desktop` | Device type: `desktop`, `mobile`, `tablet` |
| `K4K_SEARCH_PARTNERS` | `false` | Include search partner data |
| `K4K_INCLUDE_ADULT` | `false` | Include adult keywords |
| `BATCH_MAX_SEEDS` | `5000` | Max seeds per run (cost control) |
| `CONCURRENCY_TASK_POST` | `20` | Parallel POST requests |
| `CONCURRENCY_TASK_GET` | `20` | Parallel GET requests |
| `POLL_INTERVAL_MS` | `4000` | Poll every 4 seconds |
| `POLL_TIMEOUT_MS` | `900000` | Timeout after 15 minutes |
| `DRY_RUN` | `false` | Estimate only, no API calls |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |

### GitHub Secrets

Add these secrets to your repository:
1. Navigate to **Settings → Secrets and variables → Actions**
2. Add new repository secrets:
   - `DATAFORSEO_LOGIN`
   - `DATAFORSEO_PASSWORD`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Usage

### Local Execution

```bash
# Set environment variables
export DATAFORSEO_LOGIN="your-login"
export DATAFORSEO_PASSWORD="your-password"
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Run the job
npm run jobs:dataforseo-k4k
```

### Dry Run (Estimate Only)

```bash
DRY_RUN=true npm run jobs:dataforseo-k4k
```

This will:
- Fetch enabled seeds
- Group and chunk into tasks
- **Estimate cost** (no API calls)
- Exit with summary

### GitHub Actions

#### Manual Trigger
1. Go to **Actions** → **DataForSEO K4K Ingestion**
2. Click **Run workflow**
3. Configure inputs:
   - `batch_max_seeds`: Number of seeds (default: 5000)
   - `dry_run`: Enable to estimate only
   - `language_code`: Override default language
   - `location_code`: Override default location
   - `log_level`: Set verbosity
4. Click **Run workflow**

#### Scheduled Execution
The workflow runs automatically **daily at 3 AM UTC** (off-peak hours).

## Normalization Rules

Keywords are normalized according to these rules:

### Text Transformations
1. **Trim** leading/trailing whitespace
2. **Lowercase** all characters
3. **Unicode normalization** (NFKC)
4. **Remove** emojis and control characters
5. **Collapse** multiple spaces to single space

### Validation Rules
Keywords are **rejected** if:
- Length < 2 or > 120 characters
- Only digits and punctuation (no letters)
- Contains only control characters

### Example

| Original | Normalized | Valid? |
|----------|------------|--------|
| `"  Handmade  Gifts  "` | `"handmade gifts"` | ✅ |
| `"Coffee ☕ Mugs"` | `"coffee mugs"` | ✅ |
| `"12345"` | `"12345"` | ❌ (no letters) |
| `"a"` | `"a"` | ❌ (too short) |

## Cost Management

### Cost Estimation

Each DataForSEO task costs approximately **$0.0012 USD**.

**Example**: Processing 5,000 seeds with 20 keywords per task:
- Tasks needed: 5000 ÷ 20 = 250 tasks
- Estimated cost: 250 × $0.0012 = **$0.30 USD**

### Cost Controls

1. **`BATCH_MAX_SEEDS`**: Caps the number of seeds processed per run
2. **DRY_RUN mode**: Preview cost before committing
3. **Scheduled runs**: Daily runs prevent surprise costs
4. **Task chunking**: Maximizes keywords per task (up to 20)

### Monitoring Costs

Check the run summary in logs:

```json
{
  "ingestBatchId": "uuid",
  "seedsRead": 5000,
  "tasksPosted": 250,
  "tasksCompleted": 250,
  "estimatedCostUsd": 0.30
}
```

## Observability

### Structured Logs

All events are logged as JSON with context:

#### Key Events

**POSTED_TASK**
```json
{
  "taskId": "11201901-1535-0216-0000-8a63e6e8df81",
  "locale": "en:2840",
  "keywords_count": 20,
  "cost": 0.0012
}
```

**TASK_READY**
```json
{
  "taskId": "11201901-1535-0216-0000-8a63e6e8df81",
  "durationMs": 45230
}
```

**FETCH_RESULT**
```json
{
  "taskId": "11201901-1535-0216-0000-8a63e6e8df81",
  "items_count": 834
}
```

**UPSERT_SUMMARY**
```json
{
  "taskId": "11201901-1535-0216-0000-8a63e6e8df81",
  "inserted": 0,
  "updated": 812,
  "failed": 0,
  "skipped": 22
}
```

**RUN_SUMMARY**
```json
{
  "ingestBatchId": "uuid",
  "startedAt": "2025-11-06T12:00:00Z",
  "completedAt": "2025-11-06T12:15:34Z",
  "durationMs": 934521,
  "seedsRead": 5000,
  "localeGroups": 3,
  "tasksPosted": 250,
  "tasksCompleted": 250,
  "tasksFailed": 0,
  "rowsRawSaved": 250,
  "rowsInserted": 0,
  "rowsUpdated": 203450,
  "rowsSkippedInvalid": 1234,
  "estimatedCostUsd": 0.30
}
```

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | All tasks completed |
| `1` | Fatal error | Check logs, fix config/credentials |
| `2` | Partial success | Some tasks failed/timed out, investigate |

## Error Handling

### Retry Logic

The HTTP client automatically retries:
- **429 (Rate Limit)**: Exponential backoff, max 5 retries
- **5xx (Server Error)**: Exponential backoff, max 5 retries
- **Network Errors**: ECONNRESET, ETIMEDOUT, etc.

Backoff strategy:
- Base delay: 1 second
- Max delay: 30 seconds
- Jitter: ±500ms

### Failure Scenarios

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Invalid credentials | Exit code 1 | Fix `DATAFORSEO_LOGIN`/`PASSWORD` |
| No enabled seeds | Exit code 0 (graceful) | Add seeds to database |
| Task post fails | Retry with backoff | Check DataForSEO status |
| Poll timeout | Mark incomplete as failed | Increase `POLL_TIMEOUT_MS` |
| Partial failures | Exit code 2 | Review failed task logs |

### Idempotency

- Tasks are tracked in `raw_sources` by `source_key` (task ID)
- Re-running the same batch skips already-processed tasks
- Keyword upserts use `(term_normalized, market, source)` uniqueness
- Safe to re-run after partial failures

## Maintenance

### Routine Tasks

**Weekly**
- Review run summaries in GitHub Actions
- Check `rowsSkippedInvalid` count (should be < 5%)
- Verify cost aligns with expectations

**Monthly**
- Archive old `raw_sources` rows (optional)
- Review DataForSEO account balance
- Update seed priorities based on performance

### Database Maintenance

**Vacuum raw_sources**
```sql
VACUUM ANALYZE raw_sources;
```

**Check index health**
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('keyword_seeds', 'raw_sources', 'keywords')
ORDER BY idx_scan ASC;
```

**Monitor table sizes**
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('keyword_seeds', 'raw_sources', 'keywords');
```

## Troubleshooting

See the [Runbook](./dataforseo-k4k-runbook.md) for detailed troubleshooting steps.

## API Reference

### DataForSEO Endpoints

**Base URL**: `https://api.dataforseo.com`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v3/keywords_data/google_ads/keywords_for_keywords/task_post` | POST | Submit keyword expansion tasks |
| `/v3/keywords_data/google_ads/tasks_ready` | GET | List completed tasks |
| `/v3/keywords_data/google_ads/keywords_for_keywords/task_get/{id}` | GET | Fetch task results |

### DataForSEO Documentation

- [Keywords For Keywords API](https://docs.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/task_post/)
- [Location Codes](https://docs.dataforseo.com/v3/keywords_data/google_ads/locations/)
- [Language Codes](https://docs.dataforseo.com/v3/keywords_data/google_ads/languages/)

## Appendix

### Location Codes (Common)

| Code | Location |
|------|----------|
| 2840 | United States |
| 2826 | United Kingdom |
| 2124 | Canada |
| 2036 | Australia |
| 2276 | Germany |
| 2250 | France |
| 2724 | Spain |
| 2380 | Italy |

### Language Codes (Common)

| Code | Language |
|------|----------|
| en | English |
| es | Spanish |
| fr | French |
| de | German |
| it | Italian |
| pt | Portuguese |
| ja | Japanese |
| zh | Chinese |

---

## Related Documentation

- [Runbook](./dataforseo-k4k-runbook.md) - Operational procedures and troubleshooting
- [Database Schema](../supabase/migrations/0036_dataforseo_k4k_support.sql) - Migration file
- [GitHub Workflow](../.github/workflows/dataforseo-k4k-ingestion.yml) - CI/CD configuration
