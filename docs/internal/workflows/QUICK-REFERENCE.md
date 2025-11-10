# Workflows Quick Reference

Quick lookup guide for all GitHub workflows.

## Daily Schedule (UTC)

```
02:00  ┃ Security Scan
03:30  ┃ Background Jobs (AI processing)
05:15  ┃ Keyword SERP Sampler
05:55  ┃ Demand Trend Scoring
08:30  ┃ Etsy Keyword Suggestions
09:00  ┃ Etsy Scraper + Best Sellers
Every 3h┃ Reddit Discovery (00:17, 03:17, 06:17...)
```

## Quick Lookup by Category

### 🤖 Background Processing
| Workflow | Runs | Purpose |
|----------|------|---------|
| **background-jobs** | 03:30 UTC daily | AI-powered keyword enrichment |
| **demand-trend** | 05:55 UTC daily | Calculate keyword trend scores |

### 📊 Data Collection
| Workflow | Runs | Purpose |
|----------|------|---------|
| **etsy-keyword-suggestions** | 08:30 UTC daily | Etsy autocomplete keywords |
| **etsy-scraper** | 09:00 UTC daily | Etsy listing data (API) |
| **etsy-best-sellers** | 09:00 UTC daily | Best seller analysis (Playwright) |
| **keyword-serp-sampler** | 05:15 UTC daily | SERP competition analysis |
| **reddit-discovery** | Every 3 hours | Reddit keyword discovery |

### ✅ Quality Assurance
| Workflow | Runs | Purpose |
|----------|------|---------|
| **pr-checks** | On PR | Build, lint, test, e2e, bundle size |
| **security-scan** | 02:00 UTC daily | Security vulnerabilities |

### 🚀 Infrastructure
| Workflow | Runs | Purpose |
|----------|------|---------|
| **release** | On main push | Automated releases |
| **supabase-migrations** | On DB changes | Auto-apply migrations |
| **supabase-run-one** | Manual only | Run single migration |

---

## Common Operations

### Manually Trigger a Workflow

```bash
# Via GitHub UI
Actions → Select Workflow → Run workflow → Fill inputs → Run

# Via gh CLI
gh workflow run background-jobs.yml
gh workflow run etsy-scraper.yml -f query="handmade jewelry" -f limit=50
```

### Check Workflow Status

```bash
# List recent runs
gh run list --workflow=background-jobs.yml --limit 5

# View run details
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

### View Logs

```bash
# Stream logs for latest run
gh run view --log

# View specific job logs
gh run view <run-id> --log --job <job-id>
```

---

## Critical Secrets Checklist

### Database & Backend
- [ ] `SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_DB_URL`
- [ ] `LEXYHUB_APP_URL`
- [ ] `LEXYHUB_SERVICE_TOKEN` (optional)

### External APIs
- [ ] `ETSY_API_KEY` (for OpenAPI v3)
- [ ] `ETSY_COOKIE` (for scraping)
- [ ] `OPENAI_API_KEY` (for AI analysis)
- [ ] `REDDIT_CLIENT_ID`
- [ ] `REDDIT_CLIENT_SECRET`
- [ ] `REDDIT_ACCESS_TOKEN`

### Optional Flags
- [ ] `ENABLE_KEYWORD_TELEMETRY_JOB` (set to "true")
- [ ] `SERP_SAMPLE_LIMIT` (default: 12)

---

## Troubleshooting Quick Fixes

### ❌ CAPTCHA Errors (Etsy workflows)

**Problem:** Etsy shows CAPTCHA challenges
```
Error: Encountered captcha while loading https://www.etsy.com/search?q=...
```

**Solution:**
1. Update `ETSY_COOKIE` secret with fresh cookie
2. Get cookie from browser DevTools → Application → Cookies
3. Format as Set-Cookie header string
4. Re-run workflow

---

### ❌ Database Connection Failed

**Problem:** Cannot connect to Supabase
```
Error: Supabase client is not configured
```

**Solution:**
1. Verify `SUPABASE_URL` secret is set
2. Check `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Ensure Supabase project is not paused
4. Test connection with:
   ```bash
   curl https://YOUR_PROJECT.supabase.co/rest/v1/ \
     -H "apikey: YOUR_ANON_KEY"
   ```

---

### ❌ API Rate Limit Exceeded

**Problem:** Too many requests to external API
```
Error: 429 Too Many Requests
```

**Solution:**
- **Reddit:** Wait 1 minute (60 req/min limit)
- **Etsy OpenAPI:** Check daily quota (10k req/day)
- **OpenAI:** Upgrade tier or reduce frequency
- Adjust workflow schedule to spread requests

---

### ❌ Workflow Timeout

**Problem:** Workflow exceeds timeout
```
Error: The job running on runner has exceeded the maximum execution time
```

**Solution:**
1. Increase `timeout-minutes` in workflow
2. Reduce batch sizes (e.g., `SERP_SAMPLE_LIMIT`)
3. Optimize script performance
4. Split into multiple smaller jobs

---

### ❌ Migration Failed

**Problem:** Database migration error
```
Error: supabase db push failed
```

**Solution:**
1. Check migration SQL syntax
2. Review migration order (filenames should be chronological)
3. Check for conflicts with existing schema
4. Run single migration with `supabase-run-one.yml`
5. Review `schema_migrations_ci` table for history

---

## Performance Tips

### Optimize API Usage

1. **Batch Requests:** Process keywords in batches
2. **Cache Results:** Avoid re-fetching unchanged data
3. **Rate Limit:** Add delays between requests
4. **Parallel Processing:** Use concurrent jobs when possible

### Reduce Workflow Runtime

1. **npm ci:** Cache dependencies (workflows already do this)
2. **Playwright:** Only install needed browsers (`--with-deps chromium`)
3. **Artifacts:** Clean up old artifacts regularly
4. **Conditional Jobs:** Skip unnecessary steps

### Monitor Costs

- **GitHub Actions:** 2,000 minutes/month free (public repos unlimited)
- **OpenAI API:** Monitor token usage
- **Etsy API:** Track daily request count
- **Supabase:** Check database size and bandwidth

---

## Workflow Dependencies

```
┌─────────────────────────────────────┐
│   Data Collection Workflows         │
├─────────────────────────────────────┤
│ • etsy-keyword-suggestions          │
│ • etsy-scraper                      │
│ • etsy-best-sellers                 │
│ • reddit-discovery                  │
│ • keyword-serp-sampler              │
└──────────────┬──────────────────────┘
               │ Store keywords in DB
               ▼
┌─────────────────────────────────────┐
│   Enrichment Workflows              │
├─────────────────────────────────────┤
│ • background-jobs                   │
│   ├─ embed-missing (embeddings)     │
│   ├─ intent-classify (AI intent)    │
│   ├─ rebuild-clusters (grouping)    │
│   └─ trend-aggregation (momentum)   │
│ • demand-trend (scoring)            │
└──────────────┬──────────────────────┘
               │ Enrich keyword data
               ▼
┌─────────────────────────────────────┐
│   Application Uses Enriched Data    │
├─────────────────────────────────────┤
│ • Keyword search & filtering        │
│ • Trend analysis                    │
│ • Concept clustering                │
│ • Intent-based recommendations      │
└─────────────────────────────────────┘
```

---

## Emergency Contacts

### If Workflows Are Failing

1. **Check Status Page:**
   - https://www.githubstatus.com/
   - https://status.supabase.com/

2. **Review Recent Changes:**
   ```bash
   git log --oneline .github/workflows/ -10
   ```

3. **Disable Problematic Workflow:**
   - Go to Actions → Select workflow → Disable workflow
   - Fix issue, then re-enable

4. **Roll Back Changes:**
   ```bash
   git revert <commit-sha>
   git push
   ```

---

## Maintenance Schedule

### Weekly
- [ ] Review failed workflow runs
- [ ] Check artifact storage usage
- [ ] Monitor API quota consumption

### Monthly
- [ ] Rotate `ETSY_COOKIE` secret
- [ ] Review and clean old workflow runs
- [ ] Update workflow documentation
- [ ] Analyze keyword collection quality

### Quarterly
- [ ] Review workflow schedules for optimization
- [ ] Update dependencies in workflows
- [ ] Assess API costs and usage patterns
- [ ] Archive old keyword data

---

## Useful Commands

### Workflow Management

```bash
# List all workflows
gh workflow list

# View workflow details
gh workflow view background-jobs.yml

# Enable/disable workflow
gh workflow enable background-jobs.yml
gh workflow disable background-jobs.yml

# Trigger workflow
gh workflow run background-jobs.yml

# View latest runs
gh run list --limit 10
```

### Debugging

```bash
# View run summary
gh run view <run-id>

# View logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed

# Download artifacts
gh run download <run-id> -D ./artifacts
```

### Secrets Management

```bash
# List secrets
gh secret list

# Set secret
gh secret set ETSY_COOKIE

# Delete secret
gh secret delete OLD_SECRET
```

---

**Quick Reference Version:** 1.0
**Last Updated:** 2025-11-05
**For Detailed Docs:** See [README.md](./README.md)
