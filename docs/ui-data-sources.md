# LexyHub UI Data Source Reference

This guide maps every interactive surface in the LexyHub web app to the Supabase tables, storage buckets, and supporting APIs that power it. Use it when tracing data lineage, onboarding new contributors, or verifying that new schema changes feed the correct UI widgets.

## App shell (global navigation)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Topbar user menu | The menu bootstraps with the Supabase session but hydrates avatar, name, and email by fetching `/api/profile` for the authenticated user ID when the component mounts.【F:src/components/layout/UserMenu.tsx†L137-L207】 | `user_profiles` (profile settings JSON keyed by `user_id`).【F:src/app/api/profile/route.ts†L36-L82】 |

## Dashboard (`/dashboard`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Plan overview & quota KPI cards | The dashboard requests `/api/usage/summary` on mount to hydrate plan context, daily consumption, and limit metadata before rendering the cards and plan rows.【F:src/app/(app)/dashboard/page.tsx†L122-L207】 | `usage_events` (24h aggregate), `user_profiles`, `plan_overrides` (limit overrides) via the plan resolver used by the API.【F:src/app/api/usage/summary/route.ts†L10-L41】【F:src/lib/usage/quotas.ts†L67-L151】 |
| Area status table | `/api/dashboard/metrics` is fetched during the same effect cycle and converted into the table rows that surface provider, marketplace, watchlist, and job health.【F:src/app/(app)/dashboard/page.tsx†L122-L150】【F:src/app/(app)/dashboard/page.tsx†L327-L363】 | `data_providers`, `marketplace_accounts`, `watchlists`, `job_runs` (latest execution per job).【F:src/app/api/dashboard/metrics/route.ts†L31-L155】 |
| Quick actions sidecard | Static call-to-action buttons; no backing data access beyond the dashboard layout render.【F:src/app/(app)/dashboard/page.tsx†L364-L375】 | — |

## Keywords (`/keywords`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Search form & results table | Submitting the search form calls `/api/keywords/search`, which loads the allowed keyword rows, ranks them with embeddings, and returns the enriched payload consumed by the table and sparkline summarizers. The page waits for user input before issuing the first request so no default query executes on mount.【F:src/app/(app)/keywords/page.tsx†L91-L347】【F:src/app/api/keywords/search/route.ts†L99-L158】【F:src/app/api/keywords/search/route.ts†L217-L244】 | `keywords` (primary search corpus), `embeddings` (cached vectors for ranking).【F:src/app/api/keywords/search/route.ts†L99-L158】【F:src/lib/ai/embeddings.ts†L48-L117】 |
| Keyword insight callouts (summary ribbon) | After ranking, the API builds or retrieves a cached insight summary keyed by query, plan, and sources; the client displays that metadata alongside compliance notes.【F:src/app/api/keywords/search/route.ts†L315-L365】【F:src/app/(app)/keywords/page.tsx†L211-L242】 | `keyword_insights_cache` (stores generated summaries for reuse).【F:src/lib/keywords/insights-cache.ts†L5-L117】 |
| “Add to watchlist” row action | Clicking the action posts to `/api/watchlists/add`, which ensures the destination list exists, enforces quotas, and inserts the linkage before recording usage; the UI reloads counts afterwards.【F:src/app/(app)/keywords/page.tsx†L140-L164】【F:src/app/api/watchlists/add/route.ts†L9-L56】 | `watchlists`, `watchlist_items`, `keywords`, `listings` (denormalized joins), and `usage_events` (quota tracking).【F:src/lib/watchlists/service.ts†L30-L260】 |
| Tag Optimizer drawer | The optimizer posts to `/api/ai/tag-optimizer`, which optionally calls OpenAI, persists results, and records consumption; responses populate the drawer UI.【F:src/app/(app)/keywords/page.tsx†L166-L199】【F:src/app/api/ai/tag-optimizer/route.ts†L133-L230】 | `ai_predictions`, `ai_suggestions`, `usage_events` (AI quota), with optional OpenAI augmentation.【F:src/app/api/ai/tag-optimizer/route.ts†L133-L230】 |

Keyword search now normalizes cached embedding payloads retrieved from Supabase before scoring to guard against malformed JSON arrays or typed-array responses. This prevents runtime errors in production environments where the driver returns serialized vectors and ensures `/api/keywords/search` always receives numeric inputs for similarity calculations.【F:src/lib/ai/embeddings.ts†L27-L75】【F:src/lib/ai/embeddings.ts†L92-L120】

## Watchlists (`/watchlists`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Welcome summary & card list | The page fetches `/api/watchlists`, normalizes the nested payload, and uses it to render the friendly hero summary plus each watchlist card.【F:src/app/(app)/watchlists/page.tsx†L31-L263】 | `watchlists`, `watchlist_items`, `keywords`, `listings` (for joined metadata).【F:src/lib/watchlists/service.ts†L92-L149】 |
| Watchlist item tables | Each card renders the `watchlist_items` array returned from the API, including links to listing URLs when present and the humanized source label.【F:src/app/(app)/watchlists/page.tsx†L150-L220】 | Same as above (`watchlists`, `watchlist_items`, `keywords`, `listings`).【F:src/lib/watchlists/service.ts†L92-L149】 |
| Remove item action | Triggering “Remove” sends `DELETE /api/watchlists/items/:id`, which validates ownership before deleting the row.【F:src/app/(app)/watchlists/page.tsx†L90-L114】【F:src/app/api/watchlists/items/[id]/route.ts†L9-L32】 | `watchlist_items` (with inner join to `watchlists` for user scoping).【F:src/lib/watchlists/service.ts†L151-L185】 |

## Insights (`/insights`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Trend Radar visualization | The client hits `/api/insights/trends`; when the `trend_series` table has data it is grouped into momentum summaries, otherwise a synthetic aggregator supplies fallback points.【F:src/components/insights/TrendRadar.tsx†L48-L189】【F:src/app/api/insights/trends/route.ts†L18-L112】 | `trend_series` (primary time series). Fallback aggregation draws from synthetic source loaders without touching Supabase tables.【F:src/lib/trends/index.ts†L20-L69】 |
| Intent Graph canvas | `/api/insights/intent-graph` pulls the newest keyword rows and projects classification extras into a force layout that feeds the SVG graph.【F:src/components/insights/IntentGraph.tsx†L36-L200】【F:src/app/api/insights/intent-graph/route.ts†L68-L105】 | `keywords` (classification metadata in `extras` JSON). Synthetic JSON is used only if the table is empty or unavailable.【F:src/app/api/insights/intent-graph/route.ts†L68-L105】 |
| Visual Tag AI card | Uploading an asset posts to `/api/ai/visual-tag`, which stores the file in Supabase storage, logs the upload, generates tags (AI + deterministic), persists the suggestion, and records usage before returning the caption/tags shown in the UI.【F:src/app/(app)/insights/page.tsx†L52-L125】【F:src/app/api/ai/visual-tag/route.ts†L73-L313】 | `asset_uploads` (storage audit), `assets` storage bucket, `ai_predictions`, `ai_suggestions`, `usage_events` (AI quota).【F:src/app/api/ai/visual-tag/route.ts†L73-L314】 |
| Watchlist momentum notes | Descriptive copy only; no dynamic data binding.【F:src/app/(app)/insights/page.tsx†L126-L157】 | — |

## Market Twin (`/market-twin`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Listing selector | On mount the page calls `/api/listings` for the default user, mapping each listing plus tags/stats into dropdown options.【F:src/app/(app)/market-twin/page.tsx†L80-L125】 | `listings`, `marketplace_accounts`, `listing_tags`, `listing_stats` (latest metrics per listing).【F:src/app/api/listings/route.ts†L26-L111】 |
| Simulation form submission | POST `/api/market-twin` runs the simulator, which fetches baseline listing details, related keyword trends, embeddings, and persists the prediction before returning the result cards.【F:src/app/(app)/market-twin/page.tsx†L132-L189】【F:src/app/api/market-twin/route.ts†L46-L130】【F:src/lib/market-twin/simulator.ts†L49-L245】 | `listings`, `listing_tags`, `listing_stats`, `keywords` (trend momentum lookup), `embeddings`, `ai_predictions` (simulation history).【F:src/lib/market-twin/simulator.ts†L49-L245】【F:src/app/api/market-twin/route.ts†L18-L130】 |
| Simulation history list | `/api/market-twin` `GET` returns the most recent prediction rows, which render in the history panel.【F:src/app/(app)/market-twin/page.tsx†L80-L109】【F:src/app/api/market-twin/route.ts†L18-L44】 | `ai_predictions` (stored scenario inputs, scores, and explanations).【F:src/app/api/market-twin/route.ts†L18-L44】 |

## Editing (`/editing`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Overview cards | Static copy describing each editing capability; no data access required.【F:src/app/(app)/editing/page.tsx†L1-L33】 | — |
| Listing intelligence form | Submitting the form posts to `/api/listings/intelligence`, which optionally fetches the selected listing, analyzes it, persists a row in `listing_quality_audits`, and returns the scorecard consumed by the UI.【F:src/app/(app)/editing/listing-intelligence/page.tsx†L1-L8】【F:src/components/editing/ListingIntelligenceForm.tsx†L32-L193】【F:src/app/api/listings/intelligence/route.ts†L1-L126】 | `listings`, `listing_tags`, `listing_quality_audits`. |
| Competitor analysis form | Runs `/api/insights/competitors`, storing a snapshot and returning the benchmark payload rendered into market KPIs, shared phrases, adjectives, tag overlap, and narrative sections.【F:src/app/(app)/editing/competitor-analysis/page.tsx†L1-L8】【F:src/components/editing/CompetitorAnalysisForm.tsx†L20-L195】【F:src/app/api/insights/competitors/route.ts†L1-L63】 | `competitor_snapshots`, `competitor_snapshot_listings`. |
| Tag optimizer form | Calls `/api/tags/health` to evaluate the provided tags against the catalog, updates Supabase with diagnostics when a listing ID is supplied, and renders the returned health metrics, duplicates, and recommendations.【F:src/app/(app)/editing/tag-optimizer/page.tsx†L1-L8】【F:src/components/editing/TagOptimizerForm.tsx†L16-L136】【F:src/app/api/tags/health/route.ts†L1-L98】 | `tag_catalog`, `listing_tag_health`, `tag_optimizer_runs`, `listing_tags`. |

## Profile & Billing (`/profile`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Profile preferences form | The page loads `/api/profile` to populate form fields and uses the same endpoint via `PATCH` to persist updates to the Supabase profile settings JSON.【F:src/app/(app)/profile/page.tsx†L69-L200】 | `user_profiles` (plan, momentum, settings payload).【F:src/app/api/profile/route.ts†L20-L138】 |
| Billing preferences form | `/api/billing/subscription` delivers subscription status, invoices, and stored payment label; submitting the form issues a `PATCH` that updates subscription flags and profile settings, then reloads the view.【F:src/app/(app)/profile/page.tsx†L91-L227】 | `billing_subscriptions`, `billing_invoice_events`, `user_profiles` (plan & stored payment label).【F:src/app/api/billing/subscription/route.ts†L13-L115】 |
| Invoice history table | The response invoices are normalized into the UI table showing billing periods, totals, and statuses.【F:src/app/(app)/profile/page.tsx†L113-L137】 | `billing_invoice_events` (per-invoice data).【F:src/app/api/billing/subscription/route.ts†L33-L47】 |
| Cancel plan button | Reuses the billing `PATCH` endpoint to flip `autoRenew` off and refresh state after confirmation.【F:src/app/(app)/profile/page.tsx†L203-L227】 | `billing_subscriptions` (cancellation flag).【F:src/app/api/billing/subscription/route.ts†L77-L97】 |

## Status (`/status`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Environment variable grid | `generateStatusReport` compiles environment variable status from a curated definition list that the page renders directly.【F:src/app/(app)/status/page.tsx†L1-L116】【F:src/lib/status.ts†L60-L120】 | Environment variables (no database access). |
| API & service status lists | The status report checks database connectivity and verifies required API handlers, producing the arrays rendered under “API surface” and “Service integrations.”【F:src/app/(app)/status/page.tsx†L118-L196】【F:src/lib/status.ts†L122-L200】 | `keywords` (lightweight `SELECT` in the database health probe).【F:src/lib/status.ts†L122-L153】 |
| Worker status list | Additional checks load the job trigger modules to validate handler availability before the page renders the worker list.【F:src/app/(app)/status/page.tsx†L198-L224】【F:src/lib/status.ts†L187-L200】 | Module introspection only; no persistent tables beyond the shared database probe above. |

## Admin Backoffice (`/admin/backoffice`)

| UI element | How data is loaded | Supabase tables / stores |
| --- | --- | --- |
| Health metric cards | `/api/admin/backoffice/overview` requires admin headers and returns the most recent operational metrics that populate the KPI grid.【F:src/app/(app)/admin/backoffice/page.tsx†L25-L80】【F:src/app/api/admin/backoffice/overview/route.ts†L1-L24】 | `system_health_metrics` (KPI values).【F:src/lib/backoffice/status.ts†L1-L62】 |
| Risk posture summary | The same response includes counts derived from the risk register list, rendered as the posture bullets.【F:src/app/(app)/admin/backoffice/page.tsx†L81-L113】【F:src/app/api/admin/backoffice/overview/route.ts†L12-L21】 | `risk_register_entries` (per-entry status, used to compute totals).【F:src/lib/risk/service.ts†L204-L340】 |
| Crawler status table | Overview data also enumerates crawler records for the table of sync jobs.【F:src/app/(app)/admin/backoffice/page.tsx†L114-L160】 | `crawler_statuses` (latest crawler runs).【F:src/lib/backoffice/status.ts†L88-L123】 |

## Static surfaces

| Page | Notes |
| --- | --- |
| Settings (`/settings`) | Contains documentation links and environment guidance only—no dynamic data access.【F:src/app/(app)/settings/page.tsx†L1-L23】 |
| Docs (`/docs`) | In-app help content is pre-authored Markdown rendered directly without database dependencies.【F:src/app/(app)/docs/page.tsx†L1-L200】 |

