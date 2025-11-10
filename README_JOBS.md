# Background Jobs - Quick Reference

This directory contains scripts for manually triggering background jobs.

## For Windows Users (PowerShell)

### Quick Start

```powershell
# 1. Set your credentials (one time)
$env:SUPABASE_SERVICE_KEY = "your-service-role-key-here"
$env:BASE_URL = "https://your-app.com"  # Optional

# 2. Run jobs
.\run-jobs.ps1                          # Runs all corpus jobs
.\run-jobs.ps1 -Job corpus-metrics      # Runs specific job
```

### All Available Jobs

| Job | Description |
|-----|-------------|
| `corpus-all` | Run all AI corpus ingestion jobs (default) |
| `corpus-metrics` | Ingest keyword metrics to AI corpus |
| `corpus-predictions` | Ingest predictions to AI corpus |
| `corpus-risks` | Ingest risk rules and events to AI corpus |
| `social-metrics` | Aggregate social signals |
| `ingest-metrics` | Collect keyword metrics |
| `intent-classify` | Classify keyword intents |
| `rebuild-clusters` | Rebuild semantic clusters |
| `embed-missing` | Generate missing embeddings |
| `trend-aggregation` | Aggregate trend data |
| `keyword-telemetry` | Collapse keyword events |
| `dataforseo` | Trigger DataForSEO ingestion |

### Examples

```powershell
# Run with environment variables
$env:SUPABASE_SERVICE_KEY = "eyJhbGc..."
.\run-jobs.ps1 -Job corpus-all

# Run with inline parameters
.\run-jobs.ps1 -Job corpus-risks `
  -BaseUrl "https://lexyhub.com" `
  -ServiceKey "eyJhbGc..."

# Get help
Get-Help .\run-jobs.ps1 -Full
Get-Help .\run-jobs.ps1 -Examples
```

## For Linux/Mac Users (Bash)

### Quick Start

```bash
# 1. Set your credentials
export SUPABASE_SERVICE_KEY="your-service-role-key"
export BASE_URL="https://your-app.com"

# 2. Run individual jobs
curl -X POST "$BASE_URL/api/jobs/ingest-corpus/all" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

See `MANUAL_JOB_EXECUTION.md` for detailed curl examples and all endpoints.

## Recommended Order for Full Refresh

1. **Data Collection** (if needed)
   ```powershell
   .\run-jobs.ps1 -Job dataforseo
   ```

2. **Metrics Processing**
   ```powershell
   .\run-jobs.ps1 -Job ingest-metrics
   .\run-jobs.ps1 -Job social-metrics
   ```

3. **Analytics**
   ```powershell
   .\run-jobs.ps1 -Job trend-aggregation
   .\run-jobs.ps1 -Job intent-classify
   .\run-jobs.ps1 -Job rebuild-clusters
   ```

4. **AI Embeddings**
   ```powershell
   .\run-jobs.ps1 -Job embed-missing
   ```

5. **Corpus Ingestion** (for LexyBrain)
   ```powershell
   .\run-jobs.ps1 -Job corpus-all
   ```

## Troubleshooting

### "Unauthorized" error

Your service key is incorrect or missing. Check:
- Environment variable is set: `$env:SUPABASE_SERVICE_KEY`
- Key has correct format (starts with `eyJhbGc...`)
- No extra spaces or quotes

### "Missing Supabase URL configuration" error

The environment variable `NEXT_PUBLIC_SUPABASE_URL` is not set on the server.
Contact your admin to configure this in the deployment environment.

### Job returns success with 0 processed

This is normal if:
- No data meets the criteria (e.g., no recent updates)
- Data was already processed
- Filters exclude all data

## Files

- `run-jobs.ps1` - PowerShell script for Windows
- `MANUAL_JOB_EXECUTION.md` - Complete guide with curl examples
- `README_JOBS.md` - This file (quick reference)

## Documentation

For complete documentation including:
- All API endpoints
- Response formats
- Shell script examples
- Advanced usage

See: `MANUAL_JOB_EXECUTION.md`
