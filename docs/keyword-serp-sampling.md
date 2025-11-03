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

## Surfacing SERP samples in the product

- The keyword search API (`/api/keywords/search`) now enriches every result with provenance labels, source display names, sample counts, and the most recent SERP capture timestamp. When available, the API sources data from the `public.keyword_insights` view before falling back to the legacy `public.keywords` table.
- Keyword rows in the intelligence workspace surface provenance text, sample recency, and a new **View details** action. Source chips reflect the filters selected in the sidebar as well as any additional datasets returned by the API.
- The keyword detail modal calls `/api/keywords/{keywordId}/serp` to retrieve the latest captured SERP listings, derived metrics, and Etsy listing links. The endpoint groups samples by capture timestamp, joins listing metadata, and exposes a concise JSON payload for UI rendering. Listing examples are deduplicated and rendered as their own section alongside the per-sample metadata for quick Etsy navigation.
- Shared response contracts now live in `src/types/keyword-serp.ts` so both the API layer and the React modal hydrate from the same TypeScript definitions.

The detail view provides additional compliance context while keeping the existing Tag Optimizer workflow intact. If a keyword lacks SERP samples the modal explains how to connect a source with lineage visibility.
