# Etsy Integration Guide

LexyHub's Sprint 4 milestone introduces end-to-end Etsy connectivity. This guide explains how to configure the integration, trigger data syncs, and use the Market Twin simulator that now leverages Etsy listings.

## 1. Prerequisites
- Etsy developer application with OAuth credentials
- Supabase project seeded with migrations up to `0011_editing_suite.sql`
- Environment variables set in both Next.js runtime and Supabase edge functions:
  - `ETSY_CLIENT_ID`
  - `ETSY_CLIENT_SECRET`
  - `ETSY_REDIRECT_URI`
  - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (for billing automation)
  - `OPENAI_API_KEY` (optional but recommended for Market Twin explanations)

## 2. OAuth Linking Flow
1. Invoke `GET /api/auth/etsy` with a `userId` query parameter to receive an authorization URL.
2. Redirect the user to Etsy. On return, the same endpoint exchanges the OAuth code, persists marketplace account metadata, and performs an initial full sync via `syncEtsyAccount`.
3. For manual token testing you can POST to `/api/auth/etsy` with a JSON body containing `userId`, `accessToken`, and optional `scopes`.
4. Linked accounts are stored in the `marketplace_accounts` table with `provider_id = 'etsy'`.

Stateful security:
- OAuth `state` tokens are stored in an HTTP-only cookie (`etsy_oauth_state`).
- The handler checks for mismatches and returns `400` without writing any data.

## 3. Data Synchronisation
- Listings, tags, and stats are upserted into Supabase via `syncEtsyAccount`.
- Incremental refreshes respect the `last_synced_at` cursor to avoid redundant writes.
- The cron-compatible endpoint `POST /api/jobs/etsy-sync` supports two modes:
  - Default incremental sync every six hours (currently manual-only while the public API is finalized)
  - Full reload with `?mode=full`
- Sync results are written to `provider_sync_states` for observability.

## 4. Market Twin Simulator
- The Market Twin API (`POST /api/market-twin`) runs a scenario against a baseline Etsy listing.
- Embeddings come from `getOrCreateEmbedding`, enabling cosine similarity scoring for semantic gap calculations.
- Trend deltas leverage existing keyword momentum stored in Supabase `keywords`.
- Simulation runs are persisted in `ai_predictions` with method `market-twin`.
- The React wizard at `/market-twin` uses `/api/listings` to surface the newest Etsy metrics, now ensuring the freshest stats per listing.

## 5. Editing Suite Intelligence
- The `/editing` workspace exposes three new tools fed by Etsy data:
  - **Listing intelligence** (`POST /api/listings/intelligence`) hydrates `listing_quality_audits` with quality, sentiment, keyword, and quick-fix insights for any synced or ad-hoc listing payload.
  - **Competitor analysis** (`POST /api/insights/competitors`) builds `competitor_snapshots` and `competitor_snapshot_listings` records so editors can benchmark pricing, tone, and saturation.
  - **Tag optimizer** (`POST /api/tags/health`) scores listing tags against the internal `tag_catalog`, storing diagnostics inside `listing_tag_health` and history in `tag_optimizer_runs`.
- Each endpoint surfaces analytics via Vercel (`listing.intelligence.run`, `competitor.analysis.run`, `tag.optimizer.run`) so adoption can be monitored without extra instrumentation.
- The navigation entry is wired through `AppShell`, and all pages are guarded by the authenticated `(app)` layout.

## 6. Billing Automation
- Stripe webhooks (`/api/billing/webhook`) validate signatures before recording invoice and subscription updates.
- Subscriptions sync plan and quota metadata into `billing_subscriptions`, `user_profiles`, and `plan_overrides`.
- The profile workspace (`/profile`) fetches data from `/api/billing/subscription` to render plan controls and billing history.

## 7. Local Development Tips
- Without live Etsy credentials the client helpers fall back to deterministic demo payloads so flows stay testable.
- Use `npm run lint`, `npm run test`, and `npm run build` to validate the full Sprint 4 surface.
- For repeated manual syncs, supply a specific `userId` to `/api/jobs/etsy-sync?userId=<uuid>` to scope the run during development.

With these pieces configured, Etsy sellers can authenticate, keep their catalog up to date, simulate go-to-market adjustments, and optimise listing content entirely inside LexyHub.

## 8. GitHub Scraper Workflow

In addition to the in-app synchronisation flows, the repository now ships with a dedicated GitHub Actions workflow that can pull fresh listing intelligence on demand or on a daily cadence. This is helpful when you need a lightweight export without invoking the full Supabase ETL pipeline.

### Required secrets

- `ETSY_API_KEY` &mdash; create an Etsy developer application and copy the **API Key** value. Store it as an Actions secret at the repository or organisation level.

### Running the workflow manually

1. Navigate to **Actions → Etsy Scraper** in GitHub.
2. Click **Run workflow** and provide the search parameters:
   - **Search keywords** defaults to `handmade gifts` and accepts any query Etsy supports.
   - **Maximum number of listings** accepts values between 1 and 100 (Etsy caps the per-page limit at 100).
   - **Field to sort on** uses Etsy's `sort_on` values such as `score`, `created`, or `price`.
   - **Sort direction** can be `up` (ascending) or `down` (descending).
   - Toggle **Include listing descriptions** to capture the full `description` text in the JSON payload.
3. Confirm. The workflow installs Node.js 20, runs `npm ci`, executes `npm run scrape:etsy`, and uploads the generated JSON as an artifact named `etsy-listings`.

### Scheduled runs

The workflow is also scheduled to execute every day at 09:00 UTC. Each run generates a timestamped JSON file under `data/etsy/` and publishes it as an artifact for seven days. Adjust the `cron` expression in `.github/workflows/etsy-scraper.yml` if you need a different cadence.

### Local verification

You can reproduce the workflow locally by exporting the same environment variables:

```bash
export ETSY_API_KEY=sk_live_your_key
export ETSY_QUERY="handmade candles"
npm run scrape:etsy
```

The script writes a JSON file containing the raw listing metadata plus a condensed summary for each item. Subsequent automation can ingest these files or push them into Supabase for deeper analysis.

## 9. Keyword suggestion harvesting (no official API required)

Many keyword discovery tasks only need Etsy's public autocomplete results. The repository now includes a dedicated Node script
and GitHub Action that capture those suggestions, persist them inside Supabase, and feed them into the unified `keywords` table
without relying on Etsy's official API.

### Script overview

- Entrypoint: `npm run scrape:etsy-keywords` (alias for `node scripts/etsy-keyword-scraper.mjs`).
- Environment inputs:
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) authenticate the inserts.
  - `ETSY_QUERIES` accepts a comma-separated list of seed searches. CLI arguments behave the same if you prefer `node scripts/etsy-keyword-scraper.mjs "handmade toys"`.
  - `ETSY_SUGGESTION_LIMIT` bounds the number of suggestions per query (1–100, defaults to 25).
- Behaviour:
  1. Calls the public `https://www.etsy.com/api/etsywill/autocomplete/suggestions` endpoint with realistic browser headers.
  2. Falls back to parsing any embedded JSON from the HTML challenge page.
  3. As a last resort, generates deterministic heuristics so scheduled runs never fail noisily.
  4. Stores every run in the new `etsy_keyword_scrapes` table (see migration `0012_etsy_keyword_scrapes.sql`).
  5. Upserts each suggestion into `keywords` with `source = 'etsy-suggest'` so downstream analytics can reuse the data.

The script logs a JSON summary at the end of every execution, making it easy to plug into observability dashboards.

### GitHub workflow

The workflow `.github/workflows/etsy-keyword-suggestions.yml` automates the scraper on a daily 08:30 UTC cadence and exposes a
manual **Run workflow** button. Provide a comma-separated `queries` list and optional `limit`; the Action takes care of Node.js
setup, dependency installation, and executing the script.

Required secrets:

- `SUPABASE_URL` — Supabase project URL (the same value used by Next.js).
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key with insert access to `etsy_keyword_scrapes` and `keywords`.

Optional overrides like `ETSY_QUERIES` or `ETSY_SUGGESTION_LIMIT` can be promoted to repository variables if you need different
defaults between environments.

### Manual local run

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="service-role-token"
export ETSY_QUERIES="custom mugs,ceramic bowls"
export ETSY_SUGGESTION_LIMIT=20
npm run scrape:etsy-keywords
```

The command prints the number of suggestions captured per query and the total keyword upserts performed. Inspect the
`etsy_keyword_scrapes` table to audit historical runs or replay downstream processing.

## 10. Provider abstraction and ingestion toggle

- To switch Etsy ingestion from HTML scraping to the official API, set `ETSY_DATA_SOURCE=API` and provide `ETSY_API_KEY`,
  `ETSY_API_SECRET`, and `ETSY_BASE_URL`. No other code changes are needed.
- Downstream services (keyword extraction, difficulty scoring, AI suggestions, and listing quality analysis) consume the
  `NormalizedEtsyListing` schema and do not depend on the original data source.
- If the API exposes richer fields—inventory, product variations, or shop-level metrics—map them into the `raw` payload on the
  normalized listing and expand the schema additively so existing consumers remain backward compatible.

## 11. Automated best-seller ingestion

- The listing intelligence API accepts `ingestionMode="best-sellers"` to pull the current best sellers category without a user-supplied URL.
- `ScrapeEtsyProvider.search` loads `https://www.etsy.com/market/top_sellers` with a throttled HTML request, extracts the
  top listing URLs directly from the markup and embedded JSON, and normalizes every match into the unified schema before
  caching.
- When a niche category returns `404`, the scraper automatically falls back to the global top seller hubs (including the
  legacy `best-selling-items` catalog) so
  ingestion can continue without manual intervention.
- Provide an authenticated browser cookie string through `ETSY_COOKIE` to prime the Playwright session when your environment
  is challenged by DataDome. Paste the contents of the browser's **Cookie** header (or one `Set-Cookie` line per row) and the
  script loads those cookies before navigation so existing sessions can be reused.
- The editing workspace now surfaces an **Analyze Etsy best seller** shortcut so editors can run the full keyword, difficulty,
  and AI suggestion pipelines using fresh category leaders with one click.
- A dedicated Playwright-driven script (`npm run scrape:etsy-best-sellers`) mirrors the best seller ingestion flow without
  touching the Supabase pipeline. The accompanying workflow `.github/workflows/etsy-best-sellers.yml` installs Chromium,
  executes the script on a 09:00 UTC cadence (or on demand via **Run workflow**), and publishes timestamped JSON captures under
  `data/etsy/best-sellers/` as short-lived build artifacts.
- In environments where Etsy's DataDome challenge blocks live scraping, the script now falls back to a deterministic fixture
  stored at `scripts/fixtures/etsy-best-sellers-fixture.json`. Set `ETSY_BEST_SELLERS_MODE=scrape` to disable the fallback or
  `ETSY_BEST_SELLERS_MODE=fixture` to skip launching Playwright entirely (handy for local dry runs and CI smoke tests).

## 12. Handling Etsy anti-bot responses

- Both `ScrapeEtsyProvider.getListingByUrl` and `ScrapeEtsyProvider.gatherBestSellerListingUrls` now warm up the session with a
  homepage visit, replay any `Set-Cookie` headers Etsy issues, and send a full browser header set (including `Accept-Encoding`,
  `Sec-CH-UA*`, `Accept-Language`, and `Sec-Fetch-*`). The referer rotation still moves through the homepage, listing slug
  search, and the best seller hub before escalating.
- When Etsy responds with a 403 or serves a bot-check captcha, the provider automatically retries with a Playwright-powered
  Chromium context that mimics a desktop visit. Successful fallbacks are logged so ingestion metrics show how often the
  headless browser was required.
- All anti-bot errors bubble up as retryable `BLOCKED` exceptions, giving the ingestion scheduler and editing UI a chance to
  back off gracefully instead of surfacing a generic failure to the user.
