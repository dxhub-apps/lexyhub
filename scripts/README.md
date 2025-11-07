# LexyHub Database Scripts

This directory contains utility scripts for managing and troubleshooting the LexyHub database.

## LexyBrain Error Fixes

### Quick Fix Script

**File**: `fix-lexybrain-errors.sql`

This script fixes the three most common LexyBrain errors:

1. **"column ai_usage_events.ts does not exist"** - Creates/fixes the ai_usage_events table with correct schema
2. **"Failed to lookup plan entitlements"** - Ensures admin plan exists with unlimited quotas
3. **Missing LexyBrain columns** - Adds ai_calls_per_month, briefs_per_month, sims_per_month to plan_entitlements

#### Usage

```bash
# Using psql directly
psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql

# Using Supabase CLI
supabase db execute -f scripts/fix-lexybrain-errors.sql
```

#### What it does

- Creates `ai_usage_events` table with correct schema including `ts` column
- Backs up existing data if table exists with wrong schema
- Adds missing LexyBrain columns to `plan_entitlements` table
- Seeds/updates admin plan with unlimited quotas (-1 = unlimited)
- Creates necessary indexes and RLS policies

### Verification Script

**File**: `verify-lexybrain-db.sql`

This script checks if migration 0037 has been properly applied and diagnoses database issues.

#### Usage

```bash
# Using psql
psql $DATABASE_URL < scripts/verify-lexybrain-db.sql

# Using Supabase CLI
supabase db execute -f scripts/verify-lexybrain-db.sql
```

#### What it checks

1. ✓ ai_usage_events table exists with ts column
2. ✓ ai_insights cache table exists
3. ✓ ai_failures logging table exists
4. ✓ plan_entitlements has LexyBrain columns
5. ✓ admin plan entitlements exist
6. Shows current plan entitlements

## Troubleshooting LexyBrain Errors

### Error 1: "column ai_usage_events.ts does not exist"

**Root Cause**: Migration 0037 hasn't been applied to the database.

**Solution Options**:

1. **Recommended**: Run the full migration
   ```bash
   supabase db push
   ```

2. **Alternative**: Apply only migration 0037
   ```bash
   psql $DATABASE_URL < supabase/migrations/0037_lexybrain_core_tables.sql
   ```

3. **Quick Fix**: Run the fix script
   ```bash
   psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
   ```

### Error 2: "401 Unauthorized" from RunPod

**Root Cause**: Missing or invalid `LEXYBRAIN_KEY` environment variable.

**Solution**:

1. Get your RunPod API key from: https://www.runpod.io/console/user/settings

2. Set environment variables in your deployment:
   ```bash
   LEXYBRAIN_ENABLE=true
   LEXYBRAIN_MODEL_URL=https://api.runpod.ai/v2/your-endpoint-id/run
   LEXYBRAIN_KEY=runpod_your_api_key_here
   LEXYBRAIN_MODEL_VERSION=llama-3-8b-instruct
   ```

3. **For Vercel**:
   - Go to Project Settings → Environment Variables
   - Add the variables above
   - Redeploy your application

4. **For local development**:
   - Copy `.env.example` to `.env.local`
   - Fill in your RunPod credentials
   - Restart your dev server

**Test your API key**:
```bash
curl https://api.runpod.ai/v2/your-endpoint-id/run \
  -H "Authorization: Bearer $LEXYBRAIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "Hello"}}'
```

### Error 3: "Failed to lookup plan entitlements, using defaults"

**Root Cause**: Admin plan not seeded in `plan_entitlements` table.

**Solution**:

1. **Recommended**: Run the full migration (includes plan seeding)
   ```bash
   supabase db push
   ```

2. **Quick Fix**: Run the fix script
   ```bash
   psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
   ```

3. **Manual SQL**:
   ```sql
   INSERT INTO plan_entitlements (
     plan_code,
     searches_per_month,
     ai_opportunities_per_month,
     niches_max,
     ai_calls_per_month,
     briefs_per_month,
     sims_per_month,
     extension_boost
   ) VALUES (
     'admin', -1, -1, -1, -1, -1, -1, '{}'::jsonb
   )
   ON CONFLICT (plan_code) DO UPDATE SET
     ai_calls_per_month = -1,
     briefs_per_month = -1,
     sims_per_month = -1;
   ```

## Complete Fix Checklist

If you're experiencing all three errors, follow this checklist:

- [ ] Run verification script to diagnose issues
  ```bash
  psql $DATABASE_URL < scripts/verify-lexybrain-db.sql
  ```

- [ ] Apply database fixes
  ```bash
  # Option 1: Full migration (recommended)
  supabase db push

  # Option 2: Quick fix script
  psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
  ```

- [ ] Set environment variables in production
  - `LEXYBRAIN_ENABLE=true`
  - `LEXYBRAIN_MODEL_URL=<your-runpod-endpoint>`
  - `LEXYBRAIN_KEY=<your-runpod-api-key>`
  - `LEXYBRAIN_MODEL_VERSION=llama-3-8b-instruct`

- [ ] Verify environment variables are set
  ```bash
  # For Vercel
  vercel env ls

  # For local
  cat .env.local | grep LEXYBRAIN
  ```

- [ ] Restart your application

- [ ] Test LexyBrain functionality
  - Generate a market brief
  - Check logs for errors
  - Verify usage events are being recorded

## Getting Help

If you continue to experience issues after following these steps:

1. Check the full setup guide: `docs/lexybrain/setup-guide.md`
2. Review technical documentation: `docs/lexybrain/technical.md`
3. Check logs for specific error messages
4. Verify database schema matches migration 0037

## Related Files

- Full migration: `supabase/migrations/0037_lexybrain_core_tables.sql`
- Environment template: `.env.example`
- Setup guide: `docs/lexybrain/setup-guide.md`
- Technical docs: `docs/lexybrain/technical.md`
