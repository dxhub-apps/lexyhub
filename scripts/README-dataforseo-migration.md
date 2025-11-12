# DataForSEO Column Migration

This migration moves DataForSEO metrics from the `extras` JSONB column into dedicated columns for better performance and queryability.

## What Changed

### Database Schema (keywords table)
**New columns added:**
- `search_volume` (integer) - Raw search volume from DataForSEO
- `cpc` (numeric) - Cost per click in USD
- `dataforseo_competition` (numeric) - Competition score (0-1 scale)
- `monthly_trend` (jsonb) - Monthly search trend data

**New indexes:**
- `keywords_search_volume_idx` - For sorting/filtering by volume
- `keywords_cpc_idx` - For sorting/filtering by CPC
- `keywords_dataforseo_competition_idx` - For filtering by competition
- `keywords_monthly_trend_idx` - GIN index for JSONB queries
- `keywords_market_volume_idx` - Composite index for market + volume queries

### Database Function
**Updated:** `lexy_upsert_keyword()`
- Now extracts DataForSEO metrics from `extras` parameter
- Populates the new columns automatically on insert/update

### Application Code
**Updated files:**
- `/home/user/lexyhub/src/app/api/keywords/search/route.ts` - Reads from new columns
- `/home/user/lexyhub/src/app/(app)/search/page.tsx` - No changes needed (same interface)
- `/home/user/lexyhub/src/lib/jobs/corpus-ingestion.ts` - Reads from new columns
- `/home/user/lexyhub/jobs/dataforseo-k4k/supabase.ts` - No changes needed (passes via extras)

## How to Apply

### Option 1: Using psql (Recommended)
```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"

# Run the migration script
psql $DATABASE_URL -f scripts/apply-dataforseo-migration.sql
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `scripts/apply-dataforseo-migration.sql`
4. Click "Run"

### Option 3: Using Supabase CLI
```bash
# Make sure migrations are in supabase/migrations/
# Run all pending migrations
npx supabase db push
```

## Migration Steps (Manual)

If you prefer to run migrations individually:

### Step 1: Truncate keywords table (DESTRUCTIVE!)
```sql
TRUNCATE TABLE public.keywords CASCADE;
```

### Step 2: Apply column additions
```bash
psql $DATABASE_URL -f supabase/migrations/0061_add_dataforseo_columns.sql
```

### Step 3: Update function
```bash
psql $DATABASE_URL -f supabase/migrations/0062_update_lexy_upsert_keyword_with_dataforseo_columns.sql
```

## Verification

After running the migration:

### 1. Verify schema changes
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'keywords'
AND column_name IN ('search_volume', 'cpc', 'dataforseo_competition', 'monthly_trend');
```

Expected output:
```
       column_name        |     data_type
--------------------------+-------------------
 search_volume            | integer
 cpc                      | numeric
 dataforseo_competition   | numeric
 monthly_trend            | jsonb
```

### 2. Check indexes
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'keywords'
AND indexname LIKE 'keywords_%volume%';
```

### 3. Verify function
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'lexy_upsert_keyword';
```

## Testing

### 1. Run DataForSEO ingestion
```bash
# Trigger the DataForSEO K4K job
# This will populate keywords with new data
npm run job:dataforseo-k4k
```

### 2. Verify data populated
```sql
SELECT term, search_volume, cpc, dataforseo_competition,
       jsonb_array_length(monthly_trend) as trend_count
FROM public.keywords
WHERE search_volume IS NOT NULL
LIMIT 10;
```

### 3. Test frontend
1. Navigate to `/search` page
2. Search for a keyword (e.g., "bracelet for bf")
3. Verify that Volume, Competition, and Trend display actual values (not "—" or "0%")

### 4. Test LexyBrain corpus
```bash
# Run corpus ingestion
npm run job:corpus-ingest-metrics
```

Then query a keyword through LexyBrain and verify it includes DataForSEO metrics in its context.

## Rollback

If you need to rollback:

```sql
-- Drop the new columns
ALTER TABLE public.keywords
  DROP COLUMN IF EXISTS monthly_trend,
  DROP COLUMN IF EXISTS dataforseo_competition,
  DROP COLUMN IF EXISTS cpc,
  DROP COLUMN IF EXISTS search_volume;

-- Drop indexes
DROP INDEX IF EXISTS public.keywords_market_volume_idx;
DROP INDEX IF EXISTS public.keywords_monthly_trend_idx;
DROP INDEX IF EXISTS public.keywords_dataforseo_competition_idx;
DROP INDEX IF EXISTS public.keywords_cpc_idx;
DROP INDEX IF EXISTS public.keywords_search_volume_idx;

-- Revert function (restore from backup or previous migration)
```

## Benefits

✅ **Performance**: No more JSON parsing on every query
✅ **Queryable**: Can filter/sort by search_volume in SQL
✅ **Indexable**: B-tree indexes for fast lookups
✅ **Type safe**: PostgreSQL enforces data types
✅ **Cleaner code**: Direct column access vs extraction functions
✅ **Better analytics**: Easy to run aggregations on metrics

## Notes

- The `extras` column is kept for backward compatibility and additional metadata
- The migration is designed to be non-destructive for future data (uses `IF NOT EXISTS`)
- New keywords inserted via DataForSEO will automatically populate all columns
- Frontend code uses the same interface (transparent change)
