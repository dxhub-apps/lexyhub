# Manual Job Execution Guide

This guide provides instructions for running background jobs manually without access to the admin backend.

## Prerequisites

1. **Service Role Key**: You need the Supabase service role key
2. **Base URL**: Your application's base URL (production or local)
3. **Tool**: `curl` or any HTTP client (Postman, Insomnia, etc.)

## Environment Setup

```bash
# Set your environment variables
export SUPABASE_SERVICE_KEY="your-service-role-key-here"
export BASE_URL="https://your-app-url.com"  # or http://localhost:3000 for local
```

## AI Corpus Jobs

### 1. Ingest Metrics to Corpus

Populates ai_corpus from keyword_metrics tables.

```bash
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/metrics" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

**What it does:**
- Fetches keywords updated in the last 7 days
- Gathers daily and weekly metrics
- Creates semantic embeddings
- Stores in ai_corpus for LexyBrain queries

### 2. Ingest Predictions to Corpus

Ingests keyword predictions/forecasts into ai_corpus.

```bash
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/predictions" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

**What it does:**
- Fetches keyword predictions from last 30 days
- Creates forecast chunks with embeddings
- Stores in ai_corpus for trend predictions

### 3. Ingest Risks to Corpus

Ingests risk rules and events into ai_corpus.

```bash
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/risks" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

**What it does:**
- Ingests all risk rules
- Ingests recent risk events (last 30 days)
- Creates embeddings for risk context
- Enables LexyBrain to understand compliance issues

### 4. Ingest All to Corpus (Sequential)

Runs all three corpus ingestion jobs in sequence.

```bash
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/all" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

**What it does:**
- Runs metrics ingestion
- Then runs predictions ingestion
- Finally runs risks ingestion
- Returns combined results

## Other Background Jobs

### Social Metrics Aggregation

```bash
curl -X POST "$BASE_URL/api/jobs/social-metrics" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lookback_hours": 24}'
```

### Keyword Metrics Collection

```bash
curl -X POST "$BASE_URL/api/jobs/ingest-metrics" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Intent Classification

```bash
curl -X POST "$BASE_URL/api/jobs/intent-classify" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Rebuild Semantic Clusters

```bash
curl -X POST "$BASE_URL/api/jobs/rebuild-clusters" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Generate Embeddings

```bash
curl -X POST "$BASE_URL/api/jobs/embed-missing" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Trend Aggregation

```bash
curl -X POST "$BASE_URL/api/jobs/trend-aggregation" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### Keyword Telemetry

```bash
curl -X POST "$BASE_URL/api/jobs/keyword-telemetry" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

### DataForSEO Ingestion

```bash
curl -X POST "$BASE_URL/api/jobs/dataforseo/trigger" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

## Response Format

All jobs return a JSON response:

```json
{
  "success": true,
  "processed": 50,
  "successCount": 48,
  "errorCount": 2,
  "duration": 12345
}
```

## Troubleshooting

### 401 Unauthorized

- Check that your `SUPABASE_SERVICE_KEY` is correct
- Ensure the Authorization header is properly formatted

### 500 Internal Server Error

- Check application logs for detailed error messages
- Verify environment variables are set correctly
- Ensure database is accessible

### Empty Results

Some jobs may return success with 0 processed items if:
- No data meets the criteria (e.g., no recent updates)
- Data was already processed recently
- Filters exclude all available data

## Recommended Execution Order

For a complete data pipeline refresh:

1. **Data Collection** (if needed)
   ```bash
   curl -X POST "$BASE_URL/api/jobs/dataforseo/trigger" ...
   ```

2. **Metrics Processing**
   ```bash
   curl -X POST "$BASE_URL/api/jobs/ingest-metrics" ...
   curl -X POST "$BASE_URL/api/jobs/social-metrics" ...
   ```

3. **Analytics**
   ```bash
   curl -X POST "$BASE_URL/api/jobs/trend-aggregation" ...
   curl -X POST "$BASE_URL/api/jobs/intent-classify" ...
   curl -X POST "$BASE_URL/api/jobs/rebuild-clusters" ...
   ```

4. **AI Embeddings**
   ```bash
   curl -X POST "$BASE_URL/api/jobs/embed-missing" ...
   ```

5. **Corpus Ingestion** (for LexyBrain)
   ```bash
   curl -X POST "$BASE_URL/api/jobs/ingest-corpus/all" ...
   ```

## Shell Script Example

```bash
#!/bin/bash
# run-corpus-jobs.sh

set -e  # Exit on error

SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:?Service key required}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Running AI Corpus ingestion jobs..."

echo "1. Ingesting metrics..."
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/metrics" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "2. Ingesting predictions..."
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/predictions" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "3. Ingesting risks..."
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/risks" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "All corpus jobs completed!"
```

Make it executable and run:
```bash
chmod +x run-corpus-jobs.sh
./run-corpus-jobs.sh
```
