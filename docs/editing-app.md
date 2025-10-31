# Etsy Editing App Guide

The Etsy editing suite unifies listing intelligence, competitor benchmarking, and tag optimization into a single workflow that
runs entirely inside the Lexy app shell. This document explains how to set up the data dependencies, wire the UI into the app
layout, and operate each feature confidently.

## 1. Prerequisites

1. **Supabase project** – Run the migrations in `supabase/migrations/0011_editing_suite.sql` after deploying all earlier
   migrations. The script seeds schema for quality audits, competitor snapshots, the tag catalog, and tag optimizer history.
2. **Environment variables** – No new secrets are required beyond the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `OPENAI_API_KEY` variables already described in `docs/environment-setup.md`.
3. **Analytics** – The routes emit events via `@vercel/analytics`. Ensure analytics is enabled in the Vercel project or remove the
   calls in environments where analytics is not configured.

## 2. Layout integration

The suite lives under `/editing` inside the authenticated `(app)` layout and is available from the primary sidebar. The layout is
composed of:

- `src/app/(app)/editing/layout.tsx` – wraps each tool with a hero summary and shared navigation tabs provided by
  `EditingNav`.
- `src/components/editing/EditingNav.tsx` – a client component that tracks the current path using `usePathname` and renders
  contextual navigation for overview, listing intelligence, competitor analysis, and the tag optimizer.
- `src/components/layout/AppShell.tsx` – updated to include an **Editing** entry with a pencil icon so users can reach the suite
  from anywhere in the product.

All new styling lives in `src/app/globals.css` under the `.editing-*` classnames so the suite inherits the same look-and-feel as
the dashboard while remaining self-contained.

## 3. Listing Intelligence

### API endpoint

- **Route:** `POST /api/listings/intelligence`
- **Purpose:** Score a listing for completeness, sentiment, readability, tone, intent, and keyword density. The route optionally
  pulls an existing listing from Supabase when `listingId` is provided.
- **Implementation details:**
  - Imports `analyzeListing` from `src/lib/listings/intelligence.ts`.
  - When a `listingId` is supplied the route fetches `listings` and `listing_tags` rows, normalises materials, categories, and
    review metadata from the `extras` JSON column, and builds a `ListingInput` object for the analyzer.
  - Saves each run to `public.listing_quality_audits`, capturing raw inputs, weighted scores, detected gaps, and quick fix
    suggestions.
  - Emits the `listing.intelligence.run` analytics event with the quality score and missing attribute count.

### UI workflow

- **Component:** `ListingIntelligenceForm` renders a form card with fields for title, description, tags, materials, categories,
  price, reviews, rating, and sales volume.
- **Behavior:** Form data is sent to the API endpoint and the response is summarised in four panels (score breakdown, keyword
  density leaders, missing attributes, and quick fixes). The UI relies on `.analysis-*` classes for layout.
- **Output:** Quick fixes and keyword density results are surfaced prominently so editors can update copy immediately.

### Analyzer internals

`src/lib/listings/intelligence.ts` includes a deterministic scoring model:

- Tokenization and keyword density extraction with stopword filtering.
- Flesch reading ease converted into a 0–1 readability score.
- Lightweight sentiment and tone heuristics backed by curated positive/negative word sets.
- Intent classification via keyword matching (gift, home, fashion, craft, fallback to unknown).
- Completeness detection using material, dimension, category, and description length checks.
- Quality score composition that weights completeness, sentiment, readability, and keyword coverage, with penalties for missing
  attributes.

## 4. Competitor Analysis

### API endpoint

- **Route:** `POST /api/insights/competitors`
- **Purpose:** Accepts a keyword or shop name and a collection of competitor listing snapshots, returning ranked listings and
  aggregated insights.
- **Implementation details:**
  - Calls `analyzeCompetitors` from `src/lib/insights/competitors.ts`, which computes numeric summaries, common phrases, adjective
    clusters, tag overlap, and a narrative summary.
  - Persists every run to `public.competitor_snapshots` and `public.competitor_snapshot_listings` for historical analytics.
  - Emits the `competitor.analysis.run` analytics event with query and strong listing counts.

### UI workflow

- **Component:** `CompetitorAnalysisForm` supports dynamic competitor entry. Editors can add/remove listings, providing title,
  price, reviews, rating, estimated sales, tags, and image count for each.
- **Presentation:** Results show market summary KPIs, shared phrases, common adjectives, tag overlap, and a narrative paragraph to
  guide strategic copy updates.

### Insight internals

`src/lib/insights/competitors.ts` includes helpers to:

- Calculate quartiles and averages for prices, review counts, and ratings.
- Rank listings using a composite score derived from reviews, ratings, sales volume, and image count.
- Extract bigram phrases appearing in multiple listings to surface copy patterns.
- Flag strong (high review count & rating) and weak competitors, powering the saturation chart.

## 5. Tag Optimizer

### API endpoint

- **Route:**
  - `POST /api/tags/health` – Evaluates a tag set against the internal catalog, optionally persisting diagnostics for a given
    listing ID.
  - `GET /api/tags/health?listingId=...` – Fetches the most recent per-tag diagnostics stored in Supabase.
- **Implementation details:**
  - When a listing ID is provided, the route pulls source tags from `listing_tags` and catalog data from the new `tag_catalog`
    table.
  - Uses `evaluateTagHealth` from `src/lib/tags/optimizer.ts` to compute health scores, duplicates, low-volume tags, and
    recommendations.
  - Stores diagnostics in `public.listing_tag_health` and run summaries in `public.tag_optimizer_runs`.
  - Emits the `tag.optimizer.run` analytics event.

### UI workflow

- **Component:** `TagOptimizerForm` collects listing tags (optionally referencing a listing ID). Results summarise the overall
  health score, duplicates, low-volume tags, and detailed diagnostics with inline substitution suggestions.

### Catalog internals

`src/lib/tags/optimizer.ts`:

- Builds an in-memory index of the tag catalog to detect duplicates quickly.
- Scores tags using weighted search volume, trend direction, and competition signals.
- Generates replacement candidates from related tags that materially raise the score.
- Suggests high-performing additions when duplicates or gaps exist.

## 6. Data model overview

| Table | Purpose |
| --- | --- |
| `listing_quality_audits` | Stores listing scorecards and quick fixes generated by the Listing Intelligence analyzer. |
| `competitor_snapshots` | Records aggregate insights for each competitor query or shop name. |
| `competitor_snapshot_listings` | Keeps the raw listing facts that power each competitor snapshot. |
| `tag_catalog` | Houses Lexy’s internal tag metadata including search demand and related terms. |
| `listing_tag_health` | Latest diagnostics per tag for any listing scored by the optimizer. |
| `tag_optimizer_runs` | History of optimizer runs with duplicates, low-volume tags, and recommended actions. |

## 7. Operating tips

- **Seeding the catalog:** Populate `tag_catalog` with records from your keyword intelligence pipeline (volume, trend, competition,
  related tags). The tag optimizer behaves best when `related_tags` contains 3–5 high quality alternatives per entry.
- **Batch scoring:** To automate audits, call the API endpoints from a scheduled job with `listingId` references. All three APIs
  are idempotent—rerunning a score simply inserts another audit row while keeping existing history intact.
- **UI smoke tests:** After deploying, run `npm run build` to ensure the Next.js bundle contains the new pages, and spot-check the
  suite from the `/editing` sidebar entry.
- **Analytics:** Use the emitted analytics events to monitor adoption—each route reports counts to Vercel Analytics so product
  teams can observe usage patterns.

## 8. Troubleshooting

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| `Tag catalog unavailable` error | The `tag_catalog` table is empty or Supabase connection failed. | Ensure the migration ran and seed catalog rows before hitting the endpoint. |
| `Listing not found` when providing `listingId` | ID missing or user lacks permissions. | Confirm the ID exists in the `listings` table and the API caller includes the required auth headers. |
| Missing quick fixes in UI | The analyzer only produces fixes when gaps are detected. | Verify the input listing includes enough detail—short descriptions or minimal tags trigger actionable fixes. |

With the editing suite live, editors can cycle between copy improvements, competitor benchmarking, and tag experimentation without
leaving the Lexy hub. Keep the tag catalog and listing data fresh for the strongest insights.
