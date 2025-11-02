# Keyword SERP Sampling

LexyHub now captures Etsy search result snapshots with Playwright to enrich keyword coverage and competition metrics.

## Workflow overview

1. The scheduled GitHub Action [`Keyword SERP Sampling`](../.github/workflows/keyword-serp-sampler.yml) runs daily at 05:15 UTC.
2. The action installs project dependencies, downloads the Chromium browser bundle, and executes `npm run jobs:keyword-serp-sampler`.
3. The sampler connects to Supabase with the service role key, looks up candidate keywords via the `keyword_serp_sampling_candidates` helper, and only considers rows where `allow_search_sampling` is `true`.
4. For each keyword, Playwright navigates to `https://www.etsy.com/search?q=<term>`, captures visible listing IDs, result counts, and seller-provided tags, and calculates derived metrics (competition, coverage, and tag reuse ratios).
5. Snapshots are written to `public.keyword_serp_samples` with the raw listing data, derived metrics, and a summary blob that includes a hashed HTML snippet for diagnostics.

## Configuration

| Variable | Source | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub secret | Supabase instance URL used by the service client. |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub secret | Service role key with insert access to `keyword_serp_samples`. |
| `ETSY_COOKIE` | GitHub secret | Optional `Set-Cookie` header string used to seed DataDome cookies and minimize captchas. |
| `SERP_SAMPLE_LIMIT` | GitHub environment/variable | Maximum keywords processed per run (default `12`). |

Update `keywords.allow_search_sampling` to opt specific terms into the sampling pipeline. The sampler respects watchlist activity and recency through the `keyword_serp_sampling_candidates` function so that monitored keywords receive priority.

For ad-hoc runs, invoke `npm run jobs:keyword-serp-sampler -- --keyword-id=<uuid>` after exporting the Supabase credentials and (optionally) `ETSY_COOKIE`.
