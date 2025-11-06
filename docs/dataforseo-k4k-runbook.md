# DataForSEO K4K Ingestion Runbook

## Quick Reference

### Emergency Contacts
- **DataForSEO Support**: support@dataforseo.com
- **Supabase Status**: https://status.supabase.com

### Key Metrics (Normal Operation)
- **Runtime**: 10-20 minutes (5,000 seeds)
- **Success Rate**: >95% tasks completed
- **Invalid Keywords**: <5% skipped
- **Cost per Run**: $0.20-$0.50 USD

### Common Commands

```bash
# Check last run summary
gh run list --workflow=dataforseo-k4k-ingestion.yml --limit 1

# View logs
gh run view <run-id> --log

# Manual trigger (dry run)
gh workflow run dataforseo-k4k-ingestion.yml -f dry_run=true

# Check seed count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM keyword_seeds WHERE enabled = true;"
```

---

## Operational Procedures

### 1. Starting a Manual Run

**When to use**: Testing, backfilling, or out-of-schedule runs

**Steps**:
1. Navigate to GitHub Actions → **DataForSEO K4K Ingestion**
2. Click **Run workflow**
3. Configure parameters:
   ```yaml
   batch_max_seeds: 1000      # Start small
   dry_run: true              # Preview first
   log_level: debug           # Verbose output
   ```
4. Click **Run workflow**
5. Monitor progress in real-time

**Expected duration**: 5-15 minutes

---

### 2. Analyzing Run Results

#### Via GitHub Actions UI
1. Go to **Actions** → Select completed run
2. Expand **Run DataForSEO K4K ingestion** step
3. Search for `RUN_SUMMARY`

#### Via Logs (JSON)
```bash
# Download logs
gh run view <run-id> --log > run.log

# Extract summary
grep 'RUN_SUMMARY' run.log | jq '.'
```

#### Key Metrics to Check

| Metric | Expected | Action if Abnormal |
|--------|----------|-------------------|
| `tasksCompleted / tasksPosted` | >95% | Check `tasksFailed` logs |
| `rowsSkippedInvalid / (rowsUpdated + rowsInserted)` | <5% | Review normalization rules |
| `durationMs` | <1200000ms (20min) | Check `POLL_TIMEOUT_MS` |
| `estimatedCostUsd` | ~$0.30 (5k seeds) | Verify `BATCH_MAX_SEEDS` |

---

### 3. Monitoring Costs

#### Track DataForSEO Balance

**API Method** (Recommended):
```bash
curl -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
  https://api.dataforseo.com/v3/appendix/user_data
```

**Web Portal**:
1. Login to [DataForSEO](https://app.dataforseo.com)
2. Navigate to **Billing** → **Balance**

#### Cost Alerts

Set up alerts when balance drops below threshold:

```sql
-- Query total spend per day
SELECT
  DATE(ingested_at) as date,
  COUNT(*) as tasks,
  COUNT(*) * 0.0012 as estimated_cost_usd
FROM raw_sources
WHERE provider = 'dataforseo'
  AND source_type = 'google_ads_keywords_for_keywords_standard'
  AND ingested_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(ingested_at)
ORDER BY date DESC;
```

---

### 4. Adding New Seed Keywords

**Prerequisites**:
- Seeds must have `enabled = true`
- Provide `language_code` and `location_code` (or use defaults)

**Method 1: SQL Insert**
```sql
INSERT INTO keyword_seeds (term, market, enabled, language_code, location_code, priority)
VALUES
  ('organic coffee', 'google', true, 'en', '2840', 10),
  ('yoga mats', 'google', true, 'en', '2840', 8),
  ('vegan recipes', 'google', true, 'en', '2840', 5);
```

**Method 2: CSV Import**
```bash
# Prepare CSV
cat > seeds.csv << EOF
term,market,enabled,language_code,location_code,priority
sustainable fashion,google,true,en,2840,10
minimalist decor,google,true,en,2840,8
EOF

# Import
psql $DATABASE_URL -c "\COPY keyword_seeds(term,market,enabled,language_code,location_code,priority) FROM 'seeds.csv' CSV HEADER"
```

**Verification**:
```sql
SELECT COUNT(*) FROM keyword_seeds WHERE enabled = true;
```

---

### 5. Pausing/Resuming Ingestion

#### Disable All Seeds
```sql
UPDATE keyword_seeds SET enabled = false;
```

#### Enable Specific Market
```sql
UPDATE keyword_seeds
SET enabled = true
WHERE market = 'google'
  AND language_code = 'en';
```

#### Disable Scheduled Runs
Comment out the cron schedule in `.github/workflows/dataforseo-k4k-ingestion.yml`:

```yaml
on:
  # schedule:
  #   - cron: "0 3 * * *"
  workflow_dispatch:
    ...
```

---

### 6. Database Health Checks

#### Check Index Usage
```sql
SELECT
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename = 'keywords'
ORDER BY idx_scan DESC;
```

#### Check Duplicate Keywords
```sql
SELECT
  term_normalized,
  market,
  source,
  COUNT(*) as count
FROM keywords
GROUP BY term_normalized, market, source
HAVING COUNT(*) > 1;
```

#### Identify Stale Seeds (never processed)
```sql
SELECT
  id,
  term,
  enabled,
  last_run_at,
  created_at
FROM keyword_seeds
WHERE enabled = true
  AND last_run_at IS NULL
  AND created_at < NOW() - INTERVAL '7 days'
ORDER BY priority DESC;
```

---

## Troubleshooting

### Issue: Job Fails with "Invalid Credentials"

**Symptoms**:
```
DataForSEO API error 401: Unauthorized
```

**Root Cause**: Wrong `DATAFORSEO_LOGIN` or `DATAFORSEO_PASSWORD`

**Resolution**:
1. Verify credentials at https://app.dataforseo.com
2. Update GitHub Secrets:
   - **Settings** → **Secrets and variables** → **Actions**
   - Update `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`
3. Re-run workflow

**Test locally**:
```bash
curl -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
  https://api.dataforseo.com/v3/appendix/user_data
```

---

### Issue: High Invalid Keyword Rate (>10% skipped)

**Symptoms**:
```json
{
  "rowsSkippedInvalid": 5234,
  "rowsUpdated": 20000
}
```

**Root Cause**: DataForSEO returning low-quality suggestions

**Diagnosis**:
```sql
-- Check raw payloads
SELECT
  source_key,
  payload->'result'->0->'keyword' as sample_keyword
FROM raw_sources
WHERE provider = 'dataforseo'
  AND status = 'completed'
ORDER BY ingested_at DESC
LIMIT 10;
```

**Resolution**:
1. Review normalization rules in `jobs/dataforseo-k4k/normalize.ts`
2. Consider adjusting `K4K_INCLUDE_ADULT` or `K4K_SEARCH_PARTNERS`
3. Filter seed keywords with stricter criteria

---

### Issue: Tasks Timing Out

**Symptoms**:
```
[TaskPoller] Timeout exceeded with 23 tasks still pending
```

**Root Cause**: DataForSEO processing delay or network issues

**Resolution**:

**Short-term**: Increase timeout
```bash
# Update GitHub workflow or local env
POLL_TIMEOUT_MS=1800000  # 30 minutes
```

**Long-term**: Reduce batch size
```bash
BATCH_MAX_SEEDS=2500
```

**Verify DataForSEO status**:
```bash
curl https://status.dataforseo.com/
```

---

### Issue: Duplicate Keywords in Database

**Symptoms**:
```sql
SELECT COUNT(*), COUNT(DISTINCT (term_normalized, market, source))
FROM keywords;
-- Returns different counts
```

**Root Cause**: Race condition or migration issue

**Diagnosis**:
```sql
SELECT term_normalized, market, source, COUNT(*)
FROM keywords
GROUP BY term_normalized, market, source
HAVING COUNT(*) > 1;
```

**Resolution**:
```sql
-- Remove duplicates, keep latest
DELETE FROM keywords
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY term_normalized, market, source
        ORDER BY updated_at DESC
      ) AS rn
    FROM keywords
  ) sub
  WHERE rn > 1
);
```

---

### Issue: Supabase Connection Timeout

**Symptoms**:
```
Error: Connection timeout to database
```

**Root Cause**: Network issues or connection pool exhaustion

**Resolution**:

1. **Check Supabase status**: https://status.supabase.com
2. **Verify connection string**:
   ```bash
   psql "$SUPABASE_URL/postgres" -c "SELECT 1;"
   ```
3. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename IN ('keyword_seeds', 'raw_sources', 'keywords');
   ```
4. **Service role should bypass RLS** - verify `SUPABASE_SERVICE_ROLE_KEY`

---

### Issue: High Costs

**Symptoms**: DataForSEO balance depleting faster than expected

**Diagnosis**:
```sql
-- Count tasks per day
SELECT
  DATE(ingested_at) as date,
  COUNT(*) as task_count,
  COUNT(*) * 0.0012 as cost_usd
FROM raw_sources
WHERE provider = 'dataforseo'
  AND ingested_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(ingested_at)
ORDER BY date DESC;
```

**Resolution**:
1. **Reduce frequency**: Change cron to weekly
   ```yaml
   cron: "0 3 * * 0"  # Sundays only
   ```
2. **Lower batch size**:
   ```yaml
   env:
     BATCH_MAX_SEEDS: 1000
   ```
3. **Filter seeds by priority**:
   ```sql
   UPDATE keyword_seeds
   SET enabled = false
   WHERE priority < 5;
   ```

---

### Issue: No Seeds Processed

**Symptoms**:
```
[INFO] No enabled keyword seeds found, exiting
```

**Root Cause**: All seeds disabled or none exist

**Diagnosis**:
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE enabled) as enabled,
  COUNT(*) FILTER (WHERE NOT enabled) as disabled
FROM keyword_seeds;
```

**Resolution**:
```sql
-- Enable high-priority seeds
UPDATE keyword_seeds
SET enabled = true
WHERE priority >= 8;
```

---

## Recovery Procedures

### Scenario: Partial Run Failure (Exit Code 2)

**What happened**: Some tasks completed, others failed/timed out

**Impact**: Partial data ingested

**Recovery Steps**:
1. Review failed task IDs from logs:
   ```bash
   grep 'Task failed' run.log
   ```
2. Check `raw_sources` for failed tasks:
   ```sql
   SELECT source_key, error, metadata
   FROM raw_sources
   WHERE status = 'failed'
     AND provider = 'dataforseo'
   ORDER BY ingested_at DESC
   LIMIT 10;
   ```
3. **Option A**: Re-run entire batch (safe, idempotent)
   ```bash
   gh workflow run dataforseo-k4k-ingestion.yml
   ```
4. **Option B**: Manually retry failed tasks (advanced)
   ```bash
   # Fetch specific task result
   curl -u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" \
     https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/task_get/<task-id>
   ```

---

### Scenario: Database Corruption

**What happened**: Migration failed or manual edit broke schema

**Impact**: Job cannot read/write

**Recovery Steps**:
1. **Backup current state**:
   ```bash
   pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
   ```
2. **Check migration status**:
   ```sql
   SELECT * FROM schema_migrations
   ORDER BY version DESC
   LIMIT 5;
   ```
3. **Re-run migration**:
   ```bash
   # Using Supabase CLI
   supabase db push
   ```
4. **Verify tables**:
   ```sql
   \d keyword_seeds
   \d raw_sources
   \d keywords
   ```

---

### Scenario: DataForSEO API Downtime

**What happened**: All API calls failing with 5xx errors

**Impact**: Job cannot post tasks

**Recovery Steps**:
1. **Check DataForSEO status**: https://status.dataforseo.com
2. **Wait for resolution** (retry logic handles transient failures)
3. **If prolonged**:
   - Disable scheduled runs
   - Set up alert for status page changes
4. **After recovery**:
   - Re-enable scheduled runs
   - Run manual backfill if needed

---

## Monitoring & Alerts

### Recommended Alerts

#### Alert: Job Failure
**Condition**: Exit code ≠ 0 for 2 consecutive runs
**Action**: Check logs, verify credentials, review DataForSEO status

#### Alert: High Skip Rate
**Condition**: `rowsSkippedInvalid / totalRows > 0.10`
**Action**: Review normalization rules, inspect raw payloads

#### Alert: Cost Spike
**Condition**: Daily cost > $1.00 USD
**Action**: Check `BATCH_MAX_SEEDS`, verify scheduled runs

#### Alert: Long Runtime
**Condition**: Duration > 30 minutes
**Action**: Increase `POLL_TIMEOUT_MS`, reduce `BATCH_MAX_SEEDS`

### Metrics to Track

```sql
-- Daily ingestion stats
CREATE OR REPLACE VIEW dataforseo_daily_stats AS
SELECT
  DATE(ingested_at) as date,
  COUNT(*) as tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) * 0.0012 as estimated_cost_usd
FROM raw_sources
WHERE provider = 'dataforseo'
  AND source_type = 'google_ads_keywords_for_keywords_standard'
GROUP BY DATE(ingested_at)
ORDER BY date DESC;
```

---

## Maintenance Schedule

### Daily
- ✅ Review GitHub Actions run status
- ✅ Check for alerts

### Weekly
- ✅ Review `RUN_SUMMARY` metrics
- ✅ Verify cost vs budget
- ✅ Check seed count trends

### Monthly
- ✅ Vacuum/analyze tables
- ✅ Archive old `raw_sources` (optional)
- ✅ Review normalization skip rate
- ✅ Update documentation

### Quarterly
- ✅ Audit seed keyword quality
- ✅ Review DataForSEO pricing changes
- ✅ Optimize task batching strategy

---

## Escalation Path

| Issue Severity | Response Time | Escalation |
|---------------|---------------|------------|
| **P0**: Production down | Immediate | DevOps Lead |
| **P1**: Job failing consistently | 2 hours | Engineering Team |
| **P2**: Degraded performance | 1 day | Product Owner |
| **P3**: Minor issues | 1 week | Backlog |

---

## Reference

### Useful SQL Queries

**Count keywords by source**:
```sql
SELECT source, COUNT(*) as count
FROM keywords
GROUP BY source
ORDER BY count DESC;
```

**Recent raw sources**:
```sql
SELECT
  source_key,
  status,
  metadata->>'received_items_count' as items,
  ingested_at
FROM raw_sources
WHERE provider = 'dataforseo'
ORDER BY ingested_at DESC
LIMIT 20;
```

**Seeds by priority**:
```sql
SELECT priority, COUNT(*) as count, COUNT(*) FILTER (WHERE enabled) as enabled
FROM keyword_seeds
GROUP BY priority
ORDER BY priority DESC;
```

### Key Files

| File | Purpose |
|------|---------|
| `jobs/dataforseo-k4k/index.ts` | Main job entry |
| `jobs/dataforseo-k4k/config.ts` | Configuration |
| `.github/workflows/dataforseo-k4k-ingestion.yml` | CI/CD |
| `supabase/migrations/0036_dataforseo_k4k_support.sql` | Schema |

---

**Last Updated**: 2025-11-06
**Version**: 1.0.0
**Owner**: LexyHub Engineering Team
