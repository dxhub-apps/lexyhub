# DataForSEO K4K Ingestion - Complete Setup Guide

## Overview

LexyHub's DataForSEO Keywords for Keywords (K4K) ingestion pipeline automatically expands seed keywords into comprehensive keyword datasets with search volume, CPC, and competition metrics.

**Architecture**: Seed Keywords → DataForSEO API → Staging Layer → Normalized Keywords

---

## Quick Start

### 1. Get DataForSEO Credentials

1. Sign up at [DataForSEO](https://dataforseo.com/)
2. Navigate to [API Dashboard](https://app.dataforseo.com/api-dashboard)
3. Copy your login (email) and password

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
# DataForSEO Credentials (REQUIRED)
DATAFORSEO_LOGIN=your-email@example.com
DATAFORSEO_PASSWORD=your-api-password

# DataForSEO Configuration (Optional - defaults shown)
DATAFORSEO_LOCATION_CODE=2840        # United States
DATAFORSEO_LANGUAGE_CODE=en          # English
DATAFORSEO_K4K_MAX_TERMS_PER_TASK=20 # Max per API call
DATAFORSEO_K4K_DEVICE=desktop        # desktop | mobile | tablet
```

### 3. Bootstrap Seed Keywords

Run the migration to insert initial seed terms:

```bash
# Apply migration
npm run supabase:migrate

# Or manually insert seeds
psql $DATABASE_URL -f supabase/migrations/0051_bootstrap_keyword_seeds.sql
```

### 4. Run Ingestion Job

**Option A: GitHub Actions (Recommended)**
- Job runs automatically daily at 3 AM UTC
- Manual trigger: Go to Actions → "DataForSEO K4K Ingestion" → Run workflow

**Option B: Local Execution**
```bash
cd jobs/dataforseo-k4k
DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=xxx \
SUPABASE_SERVICE_ROLE_KEY=xxx \
npx tsx index.ts
```

**Option C: API Endpoint (Admin Only)**
```bash
curl -X POST https://app.lexyhub.com/api/jobs/dataforseo/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false,
    "batchMaxSeeds": 5000,
    "languageCode": "en",
    "locationCode": "2840"
  }'
```

---

## Architecture

### Data Flow

```
┌─────────────────┐
│ keyword_seeds   │ Curated seed terms (necklace, mug, etc.)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ DataForSEO API  │ Keywords for Keywords endpoint
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ raw_sources     │ Complete API responses (staging/audit)
└────────┬────────┘
         │
         ↓ (normalization)
┌─────────────────┐
│ keywords        │ Golden source (LexyHub keyword intelligence)
└─────────────────┘
```

### Database Tables

#### `keyword_seeds`
**Purpose**: Source keywords to expand via DataForSEO

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| term | text | Seed keyword (e.g., "necklace") |
| market | text | Market identifier ("google") |
| language_code | text | Language (ISO 639-1, e.g., "en") |
| location_code | text | Location code (DataForSEO ID, e.g., "2840" = USA) |
| priority | int | Processing priority (10=highest) |
| status | text | "pending" \| "done" \| "error" |
| enabled | boolean | Include in next run? |
| last_run_at | timestamptz | Last processed timestamp |

**Indexes**:
- Unique: `(term_normalized, market)`
- Query: `(enabled, priority DESC, created_at ASC)` WHERE `status IN ('pending', 'error')`

#### `raw_sources`
**Purpose**: Immutable audit trail of all API responses

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| provider | text | "dataforseo" |
| source_type | text | "google_ads_keywords_for_keywords_standard" |
| source_key | text | DataForSEO task ID (unique per response) |
| status | text | "pending" \| "completed" \| "failed" |
| payload | jsonb | Complete API response |
| metadata | jsonb | { language_code, location_code, seed_term, timestamp } |
| ingested_at | timestamptz | When response was saved |
| processed_at | timestamptz | When normalized into keywords |

**Indexes**:
- Unique: `(provider, source_type, source_key)` - prevents duplicate processing
- Query: `(provider, source_type, status)`

#### `keywords`
**Purpose**: Verified keyword intelligence (golden source)

| Column | Type | Description |
|--------|------|-------------|
| term | text | Keyword as provided |
| term_normalized | text | Lowercase, trimmed, normalized |
| market | text | "google" |
| source | text | "dataforseo_google_ads_k4k_standard" |
| ingest_source_key | text | Links back to raw_sources.source_key |
| raw_source_id | uuid | Foreign key to raw_sources |
| extras | jsonb | `{ search_volume, cpc, monthly_trend, locale }` |
| freshness_ts | timestamptz | Data freshness timestamp |

**Unique Constraint**: `(term_normalized, market, source)`

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATAFORSEO_LOGIN` | ✅ Yes | - | Email for DataForSEO account |
| `DATAFORSEO_PASSWORD` | ✅ Yes | - | API password |
| `BATCH_MAX_SEEDS` | No | 5000 | Max seeds to process per run |
| `K4K_MAX_TERMS_PER_TASK` | No | 20 | Keywords per API task (max 20) |
| `K4K_DEVICE` | No | desktop | Device type: desktop \| mobile \| tablet |
| `K4K_LANGUAGE_CODE` | No | en | ISO 639-1 language code |
| `K4K_LOCATION_CODE` | No | 2840 | DataForSEO location ID |
| `K4K_SEARCH_PARTNERS` | No | false | Include search partners? |
| `K4K_INCLUDE_ADULT` | No | false | Include adult keywords? |
| `CONCURRENCY_TASK_POST` | No | 20 | Parallel POST requests |
| `CONCURRENCY_TASK_GET` | No | 20 | Parallel GET requests |
| `POLL_INTERVAL_MS` | No | 4000 | Task polling interval |
| `POLL_TIMEOUT_MS` | No | 900000 | Max wait for task completion (15min) |
| `DRY_RUN` | No | false | Simulate without API calls |
| `LOG_LEVEL` | No | info | debug \| info \| warn \| error |

### Location Codes

Common DataForSEO location codes:

| Location | Code |
|----------|------|
| United States | 2840 |
| United Kingdom | 2826 |
| Canada | 2124 |
| Australia | 2036 |
| Germany | 2276 |

Full list: https://docs.dataforseo.com/v3/keywords_data/google_ads/locations/

### Language Codes

| Language | Code |
|----------|------|
| English | en |
| Spanish | es |
| French | fr |
| German | de |

Full list: https://docs.dataforseo.com/v3/keywords_data/google_ads/languages/

---

## Cost Estimation

**DataForSEO Pricing**: $0.0012 per task

**Example Calculations**:
- 1000 seeds / 20 keywords per task = 50 tasks = **$0.06**
- 5000 seeds / 20 keywords per task = 250 tasks = **$0.30**
- 10,000 seeds / 20 keywords per task = 500 tasks = **$0.60**

**Monthly Budget Recommendations**:
- **Starter**: $5-10/month (4,000-8,000 seeds)
- **Growth**: $20-30/month (16,000-25,000 seeds)
- **Scale**: $50-100/month (40,000-83,000 seeds)

---

## Operational Procedures

### Adding New Seeds

**Option 1: Manual SQL Insert**
```sql
INSERT INTO keyword_seeds (term, market, language_code, location_code, priority, status, enabled)
VALUES
  ('custom keyword', 'google', 'en', '2840', 10, 'pending', true),
  ('another keyword', 'google', 'en', '2840', 9, 'pending', true);
```

**Option 2: Bulk CSV Import**
```bash
psql $DATABASE_URL -c "COPY keyword_seeds(term, market, language_code, location_code, priority, status, enabled) FROM '/path/to/seeds.csv' CSV HEADER"
```

### Monitoring Job Health

**Check via API**:
```bash
curl https://app.lexyhub.com/api/jobs/dataforseo/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response includes**:
- Recent job runs (last 10)
- Seed statistics (total, pending, processed)
- Staging layer metrics (raw_sources counts)
- Keywords ingested from DataForSEO
- Health indicators

**Check via SQL**:
```sql
-- Pending seeds
SELECT COUNT(*) FROM keyword_seeds WHERE enabled = true AND status = 'pending';

-- Recent job runs
SELECT * FROM job_runs WHERE job_name = 'dataforseo-k4k' ORDER BY started_at DESC LIMIT 5;

-- Staging health
SELECT status, COUNT(*) FROM raw_sources WHERE provider = 'dataforseo' GROUP BY status;

-- Ingested keywords
SELECT COUNT(*) FROM keywords WHERE ingest_source LIKE '%dataforseo%';
```

### Troubleshooting

#### Job Fails to Start

**Symptoms**: No job run created, no logs

**Checklist**:
1. Verify `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are set
2. Check `SUPABASE_SERVICE_ROLE_KEY` is valid
3. Ensure seeds exist: `SELECT COUNT(*) FROM keyword_seeds WHERE enabled = true AND status = 'pending'`

#### DataForSEO API Errors

**429 Rate Limit**:
- Job retries automatically with exponential backoff
- Reduce `CONCURRENCY_TASK_POST` to 10
- Increase `POLL_INTERVAL_MS` to 6000

**401 Unauthorized**:
- Verify credentials in DataForSEO dashboard
- Check for password changes

**5xx Server Errors**:
- DataForSEO service issue (rare)
- Job will retry automatically
- Check DataForSEO status page

#### No Keywords Ingested

**Check staging layer**:
```sql
SELECT * FROM raw_sources WHERE provider = 'dataforseo' AND status = 'pending';
```

If pending records exist, normalization failed. Check logs for validation errors.

**Check seed status**:
```sql
SELECT status, COUNT(*) FROM keyword_seeds GROUP BY status;
```

If all seeds are "done" but no keywords, check for normalization issues (invalid characters, length, etc.).

### Re-running Failed Seeds

**Reset status to pending**:
```sql
UPDATE keyword_seeds
SET status = 'pending', last_run_at = NULL
WHERE status = 'error';
```

**Re-process staged responses**:
```sql
UPDATE raw_sources
SET status = 'pending', processed_at = NULL
WHERE provider = 'dataforseo' AND status = 'failed';
```

---

## Data Normalization Rules

### Keyword Validation

Keywords are **REJECTED** if:
- Length < 2 characters
- Length > 120 characters
- Contains only digits/punctuation (no letters)
- Invalid after Unicode normalization

### Normalization Process

1. **Trim** leading/trailing whitespace
2. **Lowercase** entire string
3. **Unicode** NFKC normalization
4. **Remove** emojis and control characters
5. **Collapse** multiple spaces to single space
6. **Final** trim

**Examples**:
```
"  Organic   SEO  " → "organic seo"
"HANDMADE 🎨" → "handmade"
"café" → "café"
```

---

## Advanced Configuration

### Custom Batch Processing

Create seed batches by priority:

```sql
-- High priority batch
SELECT * FROM keyword_seeds
WHERE enabled = true AND priority >= 9
ORDER BY priority DESC, created_at ASC
LIMIT 1000;
```

### Multi-Locale Support

Run separate batches per locale:

```bash
# English/US batch
BATCH_MAX_SEEDS=2000 K4K_LANGUAGE_CODE=en K4K_LOCATION_CODE=2840 npx tsx index.ts

# Spanish/Mexico batch
BATCH_MAX_SEEDS=2000 K4K_LANGUAGE_CODE=es K4K_LOCATION_CODE=2484 npx tsx index.ts
```

### Deduplication Strategy

The pipeline handles deduplication at multiple levels:

1. **API Level**: `raw_sources.source_key` unique constraint prevents duplicate API responses
2. **Keyword Level**: `keywords(term_normalized, market, source)` unique index prevents duplicate keywords
3. **Seed Level**: `keyword_seeds(term_normalized, market)` unique index prevents duplicate seeds

---

## API Reference

### POST `/api/jobs/dataforseo/trigger`

**Authentication**: Admin only

**Request Body**:
```json
{
  "dryRun": false,
  "batchMaxSeeds": 5000,
  "languageCode": "en",
  "locationCode": "2840"
}
```

**Response**:
```json
{
  "success": true,
  "message": "DataForSEO K4K ingestion job triggered",
  "job_run_id": "uuid",
  "pid": 12345,
  "config": { ... }
}
```

### GET `/api/jobs/dataforseo/status`

**Authentication**: Admin only

**Response**:
```json
{
  "status": "ok",
  "health": {
    "overall": "healthy",
    "has_pending_seeds": true,
    "latest_run_status": "completed",
    "last_ingestion": "2025-01-10T12:00:00Z"
  },
  "job_runs": {
    "recent": [...],
    "latest": { ... }
  },
  "seeds": {
    "total": 1000,
    "enabled": 950,
    "pending": 500,
    "processed": 450
  },
  "staging": {
    "total_responses": 250,
    "pending": 0,
    "completed": 245,
    "failed": 5
  },
  "keywords": {
    "total": 50000,
    "from_dataforseo": 12500,
    "coverage_percentage": "25.00",
    "last_ingested_at": "2025-01-10T12:00:00Z"
  }
}
```

---

## Best Practices

### 1. Start Small
- Begin with 100-500 high-priority seeds
- Monitor costs and results
- Scale gradually

### 2. Use Priority Levels
- 10: Core business keywords (high conversion)
- 9: Related opportunities (good volume)
- 8: Long-tail exploration (niche)

### 3. Regular Maintenance
- Review failed seeds weekly
- Prune low-value seeds monthly
- Monitor keyword freshness

### 4. Cost Control
- Set `BATCH_MAX_SEEDS` limits
- Use `DRY_RUN=true` for testing
- Monitor DataForSEO usage in dashboard

### 5. Data Quality
- Validate normalized keywords
- Check for spam/junk terms
- Review competition and CPC metrics

---

## Support

**Documentation**:
- [DataForSEO K4K API Docs](https://docs.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/)
- [LexyHub DataForSEO Ingestion Docs](/docs/dataforseo-k4k-ingestion.md)
- [Runbook](/docs/dataforseo-k4k-runbook.md)

**Troubleshooting**:
- Check GitHub Actions logs
- Review `job_runs` table
- Monitor Sentry for errors

**Cost Tracking**:
- [DataForSEO Dashboard](https://app.dataforseo.com/api-dashboard)
- Set billing alerts
- Review monthly usage

---

## Changelog

**v1.0.0** - Initial production-ready release
- Complete K4K ingestion pipeline
- Bootstrap seed data
- API endpoints for monitoring
- Comprehensive documentation
