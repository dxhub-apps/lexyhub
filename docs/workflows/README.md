# GitHub Workflows Documentation

This document provides detailed information about all GitHub workflows in the LexHub application. These workflows automate keyword collection, enrichment, processing, classification, and quality assurance.

## Table of Contents

1. [Core Background Jobs](#core-background-jobs)
   - [Background Jobs](#background-jobs)
   - [Demand Trend Scoring](#demand-trend-scoring)
2. [Keyword Collection & Data Ingestion](#keyword-collection--data-ingestion)
   - [Etsy Keyword Suggestions](#etsy-keyword-suggestions)
   - [Etsy Scraper](#etsy-scraper)
   - [Etsy Best Sellers](#etsy-best-sellers)
   - [Keyword SERP Sampler](#keyword-serp-sampler)
   - [Reddit Discovery](#reddit-discovery)
3. [Quality & Security](#quality--security)
   - [PR Quality Checks](#pr-quality-checks)
   - [Security Scan](#security-scan)
4. [Infrastructure & Release](#infrastructure--release)
   - [Release Management](#release-management)
   - [Supabase Migrations](#supabase-migrations)
   - [Supabase Run One](#supabase-run-one)

---

## Core Background Jobs

### Background Jobs

**File:** `.github/workflows/background-jobs.yml`

**Purpose:** Orchestrates core background jobs that process and enrich keyword data through AI-powered analysis, trend aggregation, clustering, and embeddings.

**Schedule:**
- Daily at 3:30 AM UTC
- Manual trigger via `workflow_dispatch`

**Jobs:**
1. **trend-aggregation** - Aggregates trend signals and calculates keyword momentum
2. **intent-classify** - Classifies keyword intent using AI (purchase stage, persona, confidence)
3. **rebuild-clusters** - Rebuilds concept clusters from keyword embeddings
4. **embed-missing** - Generates embeddings for keywords that don't have them
5. **keyword-telemetry** (optional) - Tracks keyword usage telemetry if enabled

**Required Secrets:**
- `LEXYHUB_APP_URL` - Base URL of the application (e.g., `https://lexyhub.app`)
- `LEXYHUB_SERVICE_TOKEN` - Service authentication token (optional if API allows unauthenticated)
- `ENABLE_KEYWORD_TELEMETRY_JOB` - Set to "true" to enable telemetry job

**How It Works:**
1. Validates that `LEXYHUB_APP_URL` is configured
2. Iterates through each job endpoint
3. Makes POST request to `/api/jobs/{endpoint}`
4. Logs results and uploads artifacts
5. Fails if any job returns non-2xx status code

**Artifacts:**
- `background-job-logs/` - Contains response JSON and HTTP status for each job

**Timeout:** 20 minutes

---

### Demand Trend Scoring

**File:** `.github/workflows/demand-trend.yml`

**Purpose:** Ingests keyword metrics and calculates demand trend scores based on search volume, competition, and momentum.

**Schedule:**
- Daily at 5:55 AM UTC
- Manual trigger via `workflow_dispatch`

**Environment:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `OPENAI_API_KEY` - OpenAI API key for AI-powered analysis
- `COUNTRY` - Target country (default: "global")
- `LOOKBACK_DAYS` - Number of days to analyze (default: "7")

**Script:** `jobs/ingest_metrics_and_score.ts`

**How It Works:**
1. Fetches keyword data from the past N days
2. Calculates trend scores based on:
   - Search volume changes
   - Competition levels
   - Momentum indicators
3. Updates keyword records with new scores
4. Uses AI to enhance scoring with contextual analysis

**Timeout:** 30 minutes

---

## Keyword Collection & Data Ingestion

### Etsy Keyword Suggestions

**File:** `.github/workflows/etsy-keyword-suggestions.yml`

**Purpose:** Collects keyword suggestions from Etsy's autocomplete API to discover trending and related search terms.

**Schedule:**
- Daily at 8:30 AM UTC
- Manual trigger with custom parameters

**Inputs (Manual Trigger):**
- `queries` - Comma-separated seed queries (default: "handmade gifts,personalized jewelry")
- `limit` - Number of suggestions per query, 1-100 (default: 25)

**Environment:**
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database service key
- `ETSY_QUERIES` - Seed queries to expand
- `ETSY_SUGGESTION_LIMIT` - Max suggestions per query

**Script:** `scripts/etsy-keyword-scraper.mjs`

**How It Works:**
1. Takes seed keywords
2. Queries Etsy's autocomplete/suggestion API
3. Collects related keyword suggestions
4. Stores unique keywords in database
5. Marks keywords for further processing

**Use Case:** Discover long-tail keywords and trending search terms in the Etsy marketplace.

---

### Etsy Scraper

**File:** `.github/workflows/etsy-scraper.yml`

**Purpose:** Fetches active Etsy listings using the Etsy OpenAPI v3 to analyze tags, pricing, and listing metadata.

**Schedule:**
- Daily at 9:00 AM UTC
- Manual trigger with custom parameters

**Inputs (Manual Trigger):**
- `query` - Search keywords (default: "handmade gifts")
- `limit` - Max listings to fetch, 1-100 (default: 25)
- `sort_on` - Sort field: score, created, price (default: "score")
- `sort_order` - Sort direction: up/down (default: "down")
- `include_description` - Include descriptions: true/false (default: false)

**Required Secrets:**
- `ETSY_API_KEY` - Etsy OpenAPI v3 API key

**Script:** `scripts/etsy-scraper.mjs`

**How It Works:**
1. Calls Etsy OpenAPI v3 `/listings/active` endpoint
2. Fetches listing metadata (title, tags, price, shop info, views, quantity)
3. Optionally includes descriptions
4. Normalizes response format
5. Saves to `data/etsy/*.json`

**Artifacts:**
- `etsy-listings/` - JSON files with listing data
- Retention: 7 days

**Use Case:** Collect real marketplace data for keyword analysis, tag extraction, and competitor research.

---

### Etsy Best Sellers

**File:** `.github/workflows/etsy-best-sellers.yml`

**Purpose:** Scrapes Etsy best-selling listings using Playwright to analyze successful products and their tags.

**Schedule:**
- Daily at 9:00 AM UTC
- Manual trigger with custom parameters

**Inputs (Manual Trigger):**
- `category` - Etsy category URL or slug (optional)
- `limit` - Number of listings to capture, max 20 (optional)
- `headless` - Run browser in headless mode: true/false (optional)

**Environment:**
- `ETSY_COOKIE` - Etsy session cookie to avoid CAPTCHAs

**Script:** `scripts/etsy-best-sellers.mjs`

**How It Works:**
1. Launches Playwright Chromium browser
2. Navigates to Etsy best sellers page
3. Extracts listing data, tags, titles, prices
4. Handles pagination if limit > page size
5. Saves structured data to JSON

**Artifacts:**
- `etsy-best-sellers/` - JSON files with best seller data
- Retention: 7 days

**Timeout:** 30 minutes

**Use Case:** Identify successful products and high-performing tags/keywords in specific categories.

---

### Keyword SERP Sampler

**File:** `.github/workflows/keyword-serp-sampler.yml`

**Purpose:** Samples Search Engine Results Pages (SERPs) from Etsy to analyze keyword competition, coverage, and tag usage.

**Schedule:**
- Daily at 5:15 AM UTC
- Manual trigger via `workflow_dispatch`

**Environment:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `ETSY_COOKIE` - Etsy session cookie
- `SERP_SAMPLE_LIMIT` - Max keywords to sample (default: 12)

**Script:** `jobs/keyword-serp-sampler.ts`

**How It Works:**
1. Fetches candidate keywords from database (flagged for sampling)
2. For each keyword:
   - Launches Playwright browser
   - Navigates to Etsy search results
   - Extracts total results count
   - Captures listing positions, titles, tags
   - Detects CAPTCHA and retries if needed
3. Calculates derived metrics:
   - **Competition** - Normalized competition score based on result count
   - **Coverage** - Percentage of tracked listings in results
   - **Tag Reuse** - Measure of tag overlap across results
4. Stores samples in `keyword_serp_samples` table

**Timeout:** 45 minutes

**Validation:** Checks for required environment variables on startup

**Use Case:** Track keyword difficulty, analyze SERP composition, and monitor tag strategies over time.

---

### Reddit Discovery

**File:** `.github/workflows/reddit-discovery.yml`

**Purpose:** Discovers keywords from Reddit discussions in relevant subreddits (e.g., r/EtsySellers, r/PrintOnDemand).

**Schedule:**
- Every 3 hours (cron: `17 */3 * * *`)
- Manual trigger with custom parameters

**Inputs (Manual Trigger):**
- `mode` - Run mode: "accounts" or "anon" (default: "accounts")
- `subreddits` - Subreddits to search, one per line (optional)
- `queries` - Search queries, one per line (optional)
- `config_path` - Path to config YAML (default: "config/reddit.yml")

**Required Secrets:**
- `SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Database service key
- `REDDIT_CLIENT_ID` - Reddit app client ID
- `REDDIT_CLIENT_SECRET` - Reddit app client secret
- `REDDIT_ACCESS_TOKEN` - Reddit access token (for anon mode or fallback)

**Script:** `scripts/reddit-keyword-discovery.mjs`

**How It Works:**
1. Authenticates with Reddit API
2. Fetches posts and comments from specified subreddits
3. Optionally searches for specific queries
4. Extracts keywords from titles and high-engagement comments
5. Filters and normalizes keywords
6. Stores discovered keywords in database

**Retry Logic:** Up to 4 attempts with exponential backoff (5s, 10s, 15s, 20s)

**Timeout:** 30 minutes

**Use Case:** Discover trending topics, pain points, and search terms from community discussions.

---

## Quality & Security

### PR Quality Checks

**File:** `.github/workflows/pr-checks.yml`

**Purpose:** Comprehensive quality gates for pull requests ensuring code quality, type safety, test coverage, and security.

**Triggers:**
- Pull request opened, synchronized, or reopened
- Concurrent runs cancelled for same PR

**Jobs:**

#### 1. Build & Type Check
- Installs dependencies with `npm ci`
- Runs TypeScript type checking (`npm run typecheck`)
- Builds Next.js application (`npm run build`)
- Uploads build artifacts for other jobs

#### 2. Lint & Format Check
- Runs ESLint (`npm run lint`)
- Checks code formatting with Prettier (if configured)
- Ensures code style consistency

#### 3. Unit & Integration Tests
- Runs Vitest test suite with coverage
- Checks coverage thresholds:
  - Lines: 40%
  - Functions: 35%
  - Branches: 30%
- Uploads coverage reports (7-day retention)

#### 4. E2E Smoke Tests
- Installs Playwright Chromium
- Runs critical end-to-end tests (`tests/e2e/smoke.spec.ts`)
- Uploads Playwright report on failure
- Timeout: 10 minutes

#### 5. Security Vulnerability Scan
- Runs `npm audit` for dependency vulnerabilities
- Allows high-level vulnerabilities (continue-on-error)
- Uploads audit results (7-day retention)

#### 6. Bundle Size Analysis
- Downloads build artifacts
- Analyzes static asset sizes
- Reports largest JavaScript bundles
- Comments bundle size report on PR

#### 7. Quality Gate Summary
- Aggregates all check results
- Fails if any critical gate fails (build, lint, test, e2e)
- Security and bundle size are informational

**Concurrency:** Cancels in-progress runs for the same PR

**Use Case:** Ensure every PR meets quality standards before merge.

---

### Security Scan

**File:** `.github/workflows/security-scan.yml`

**Purpose:** Comprehensive security scanning including dependency vulnerabilities, SAST, secret detection, and code analysis.

**Schedule:**
- Daily at 2:00 AM UTC
- On push to main branch
- Manual trigger via `workflow_dispatch`

**Permissions:**
- `contents: read`
- `security-events: write`
- `actions: read`

**Jobs:**

#### 1. Dependency Scan
- Runs `npm audit` with JSON output
- Checks for HIGH and CRITICAL vulnerabilities
- **Fails if** high or critical vulnerabilities found
- Uploads audit results (30-day retention)

#### 2. SAST Scan (Static Application Security Testing)
- Uses Semgrep with security rulesets:
  - `p/security-audit`
  - `p/nodejs`
  - `p/typescript`
  - `p/react`
  - `p/nextjs`
- Generates SARIF report
- Uploads to GitHub Security tab

#### 3. Secret Scan
- Uses TruffleHog OSS
- Scans full git history
- Detects accidentally committed secrets
- Only reports verified secrets (`--only-verified`)

#### 4. CodeQL Analysis
- Languages: JavaScript, TypeScript
- Queries: `security-extended`, `security-and-quality`
- Deep code analysis for vulnerabilities
- Uploads findings to Security tab
- Timeout: 30 minutes

#### 5. Security Summary
- Aggregates all scan results
- Generates GitHub Step Summary
- Shows pass/fail status for each check

**Use Case:** Continuous security monitoring and vulnerability detection.

---

## Infrastructure & Release

### Release Management

**File:** `.github/workflows/release.yml`

**Purpose:** Automated release creation with version bumping, changelog generation, and GitHub releases.

**Triggers:**
- Push to `main` branch (excludes docs, markdown changes)
- Manual trigger with release type selection

**Inputs (Manual Trigger):**
- `release_type` - Version bump type: patch, minor, major

**Permissions:**
- `contents: write` (for creating releases and tags)

**Jobs:**

#### 1. Check if Release Needed
- Analyzes latest commit message
- Checks for conventional commit patterns: `feat:`, `fix:`, `perf:`, `refactor:`
- Outputs whether release should be created
- Gets current version from `package.json`

#### 2. Generate Changelog
- **Runs if:** releasable commit or manual trigger
- Determines new version based on bump type
- Version bump logic:
  - `major`: X.0.0
  - `minor`: X.Y.0
  - `patch`: X.Y.Z
- Generates changelog from commits since last tag
- Uses format: `- Commit message (hash)`
- Creates changelog artifact

#### 3. Create GitHub Release
- **Runs if:** releasable commit or manual trigger
- Updates `package.json` and `package-lock.json` versions
- Commits version bump with `chore: bump version to X.Y.Z`
- Creates git tag `vX.Y.Z`
- Pushes commit and tag
- Creates GitHub Release with changelog

#### 4. Deployment Notification
- Logs release information
- Notes that Vercel auto-deploys from main
- Provides dashboard link

**Use Case:** Streamline release process with automated versioning and changelog generation.

---

### Supabase Migrations

**File:** `.github/workflows/supabase-migrations.yml`

**Purpose:** Automatically applies database migrations when Supabase schema changes are pushed.

**Triggers:**
- Push to any branch with changes in:
  - `supabase/**`
  - `.github/workflows/supabase-migrations.yml`
- Pull requests with same path changes

**Environment:**
- `SUPABASE_DB_URL` - Direct PostgreSQL connection URL
- `GIT_SHA` - Commit SHA
- `ACTOR` - GitHub actor who triggered the workflow
- `WORKFLOW` - Workflow name for tracking

**How It Works:**
1. **Setup:** Installs Supabase CLI and PostgreSQL client
2. **Clear Statements:** Runs `DEALLOCATE ALL;` to clear prepared statements
3. **Ensure Directory:** Creates `supabase/migrations` if missing
4. **Lint:** Validates migration files with `supabase db lint`
5. **Apply Migrations:** Runs `supabase db push --db-url "$SUPABASE_DB_URL"`
6. **Record Result:** Logs migration run to `schema_migrations_ci` table
   - Records: git SHA, actor, workflow, status, message
7. **Fail on Error:** Exits with error if migrations failed

**Migration Tracking Table:**
```sql
schema_migrations_ci (
  git_sha TEXT,
  actor TEXT,
  workflow TEXT,
  status TEXT,    -- 'success' or 'failure'
  message TEXT
)
```

**Use Case:** Ensure database schema stays in sync across environments with automated migration application.

---

### Supabase Run One

**File:** `.github/workflows/supabase-run-one.yml`

**Purpose:** Manually execute a single Supabase migration file for targeted schema changes or fixes.

**Trigger:** Manual only (`workflow_dispatch`)

**Inputs:**
- `migration_file` - **Required** - Path to SQL file (e.g., `supabase/migrations/20251030121000_add_users.sql`)
- `database_url` - Optional database URL override (defaults to `SUPABASE_DB_URL` secret)

**Environment:**
- `SUPABASE_DB_URL` - Default database URL (can be overridden by input)

**How It Works:**
1. Checks if specified migration file exists
2. Fails if file not found
3. Executes migration using Supabase CLI:
   ```bash
   supabase db execute --file "$FILE" --db-url "$SUPABASE_DB_URL"
   ```
4. Reports success or failure

**Use Cases:**
- Apply hotfix migrations
- Re-run failed migrations
- Apply migrations to specific environments
- Test migrations before automatic deployment

**Safety:** Does not track execution in `schema_migrations_ci` table to allow re-runs.

---

## Workflow Dependencies

### Secrets Required

| Secret | Used By | Purpose |
|--------|---------|---------|
| `SUPABASE_URL` | Multiple | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_URL` | keyword-serp-sampler | Public Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Multiple | Database admin access |
| `SUPABASE_DB_URL` | supabase-* | Direct PostgreSQL connection |
| `LEXYHUB_APP_URL` | background-jobs | Application base URL |
| `LEXYHUB_SERVICE_TOKEN` | background-jobs | Service authentication |
| `ETSY_API_KEY` | etsy-scraper | Etsy OpenAPI key |
| `ETSY_COOKIE` | etsy-best-sellers, keyword-serp-sampler | Bypass CAPTCHAs |
| `OPENAI_API_KEY` | demand-trend | AI-powered analysis |
| `REDDIT_CLIENT_ID` | reddit-discovery | Reddit app credentials |
| `REDDIT_CLIENT_SECRET` | reddit-discovery | Reddit app credentials |
| `REDDIT_ACCESS_TOKEN` | reddit-discovery | Reddit API access |
| `ENABLE_KEYWORD_TELEMETRY_JOB` | background-jobs | Enable telemetry (optional) |

### Job API Endpoints

All endpoints are called by `background-jobs.yml` via POST requests to `/api/jobs/{endpoint}`:

| Endpoint | File | Purpose |
|----------|------|---------|
| `trend-aggregation` | `src/app/api/jobs/trend-aggregation/route.ts` | Aggregate trend signals |
| `intent-classify` | `src/app/api/jobs/intent-classify/route.ts` | Classify keyword intent |
| `rebuild-clusters` | `src/app/api/jobs/rebuild-clusters/route.ts` | Rebuild concept clusters |
| `embed-missing` | `src/app/api/jobs/embed-missing/route.ts` | Generate embeddings |
| `keyword-telemetry` | `src/app/api/jobs/keyword-telemetry/route.ts` | Track telemetry (optional) |

### Script Files

| Script | Workflow | Language |
|--------|----------|----------|
| `scripts/etsy-keyword-scraper.mjs` | etsy-keyword-suggestions | JavaScript (ESM) |
| `scripts/etsy-scraper.mjs` | etsy-scraper | JavaScript (ESM) |
| `scripts/etsy-best-sellers.mjs` | etsy-best-sellers | JavaScript (ESM) |
| `scripts/reddit-keyword-discovery.mjs` | reddit-discovery | JavaScript (ESM) |
| `jobs/keyword-serp-sampler.ts` | keyword-serp-sampler | TypeScript |
| `jobs/ingest_metrics_and_score.ts` | demand-trend | TypeScript |

---

## Workflow Execution Times

Typical daily schedule (UTC):

- **02:00** - Security Scan
- **03:30** - Background Jobs (trend, intent, clusters, embeddings)
- **05:15** - Keyword SERP Sampler
- **05:55** - Demand Trend Scoring
- **08:30** - Etsy Keyword Suggestions
- **09:00** - Etsy Scraper, Etsy Best Sellers
- **Every 3h** - Reddit Discovery (00:17, 03:17, 06:17, etc.)

---

## Monitoring & Debugging

### Viewing Workflow Runs

1. Navigate to **Actions** tab in GitHub
2. Select workflow from left sidebar
3. View run history and status

### Downloading Artifacts

1. Click on completed workflow run
2. Scroll to **Artifacts** section
3. Download logs, reports, or data files

### Manual Triggers

Most workflows support manual execution:
1. Go to **Actions** → Select workflow
2. Click **Run workflow** button
3. Fill in optional parameters
4. Click **Run workflow**

### Common Issues

**CAPTCHA Errors (Etsy workflows):**
- Ensure `ETSY_COOKIE` secret is set and fresh
- Cookies expire periodically, update as needed

**Database Connection Errors:**
- Verify `SUPABASE_DB_URL` format: `postgresql://user:pass@host:port/db`
- Check Supabase project is not paused

**API Rate Limits:**
- Reddit: 60 requests per minute (monitor retry logic)
- Etsy OpenAPI: 10,000 requests per day
- OpenAI: Depends on account tier

**Timeout Issues:**
- Adjust `timeout-minutes` in workflow if needed
- Default timeouts range from 10-45 minutes

---

## Best Practices

1. **Monitor Daily:** Check workflow runs in Actions tab
2. **Review Artifacts:** Download and analyze logs for failures
3. **Update Secrets:** Rotate cookies and tokens regularly
4. **Adjust Schedules:** Modify cron schedules to avoid rate limits
5. **Test Manually:** Use workflow_dispatch to test before schedule changes
6. **Track Metrics:** Monitor keyword database growth and quality
7. **Security First:** Review security scan results regularly

---

## Future Enhancements

Potential workflow improvements:

- **Slack/Discord Notifications:** Add webhook notifications for failures
- **Retry Logic:** Implement automatic retries for transient failures
- **Cost Monitoring:** Track API usage and costs
- **Performance Metrics:** Measure workflow execution times
- **Data Quality Checks:** Validate collected data before storage
- **Deduplication:** Prevent duplicate keyword collection

---

## Contributing

When modifying workflows:

1. Test changes on a feature branch
2. Validate YAML syntax locally
3. Test manual triggers before merging
4. Update this documentation
5. Consider impact on rate limits and quotas

---

**Last Updated:** 2025-11-05
**Total Workflows:** 12
**Total Jobs:** 25+
