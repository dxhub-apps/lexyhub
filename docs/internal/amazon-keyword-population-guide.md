# Amazon Keyword Population Guide

This guide walks through the simplest end-to-end path for turning on live Amazon keyword data inside Lexy. Follow the steps in order and you will go from empty keyword slots to real suggestions and metrics pulled straight from Amazon.

## 1. Prep your Supabase project
1. Create a Supabase project (or reuse your staging project) and run the core migration in `supabase/migrations/0001_init_core_tables.sql` so the `keyword_seeds` and `keywords` tables exist. 【F:supabase/migrations/0001_init_core_tables.sql†L1-L79】
2. Generate a service role key and store it securely; the ingestion job will use it for inserts and updates.
3. Confirm you have at least one seed row per marketplace you want to hydrate. Each seed should have `term`, `market`, `priority`, and `status='ready'` so the provider picks it up automatically. 【F:supabase/migrations/0001_init_core_tables.sql†L8-L23】

## 2. Collect Amazon API credentials
1. Sign up for the Amazon Product Advertising API (PA-API) and grab your **Access Key**, **Secret Key**, and **Associate Tag**.
2. Note the target marketplace IDs (for example `ATVPDKIKX0DER` for US, `A1F83G8C2ARO7P` for UK) because both the suggest and metrics calls need them.
3. Store the credentials and marketplace IDs as environment variables (for example in `.env.local` or your secrets manager) so they can be injected into the ingestion runtime.

## 3. Build a simple suggest fetcher
1. Create a function that matches the `AmazonSuggestFetcher` signature in `src/lib/providers/amazon.ts`. 【F:src/lib/providers/amazon.ts†L41-L53】
2. Call Amazon's public completion endpoint: `https://completion.amazon.com/api/2017/suggestions?limit=20&marketplaceId=<ID>&prefix=<seed>&alias=aps`.
3. Map each response item to `{ keyword, score, type }` so the provider can dedupe and rank the ideas. 【F:src/lib/providers/amazon.ts†L88-L134】【F:src/lib/providers/amazon.ts†L222-L264】
4. Return the normalized suggestions and the estimated token cost (set `tokens` to `0` if you do not track usage yet).

## 4. Build a metrics fetcher backed by PA-API
1. Implement an `AmazonMetricsFetcher` that batches the deduped terms and calls the PA-API `SearchItems` endpoint with the same marketplace ID. 【F:src/lib/providers/amazon.ts†L55-L65】【F:src/lib/providers/amazon.ts†L267-L320】
2. For each keyword, calculate:
   - `searchVolume`: approximate demand (for example, use the total results count or a custom scoring formula).
   - `conversionRate`: proxy from top ASIN review counts or best-seller rank.
   - `competition`: inverse of average star rating or number of sponsored listings.
   - `growthRate`: compare recent price or availability signals week over week.
   - `asinSamples`: pick a handful of top ASINs with title and price so analysts can audit the data.
3. Return the metrics in the shape the provider expects so it can compute demand, competition, engagement, and opportunity scores out of the box. 【F:src/lib/providers/amazon.ts†L271-L320】

## 5. Wire the provider into your ingestion worker
1. Instantiate the provider with `createAmazonProvider({ market: "us", dependencies: { suggestFetcher, metricsFetcher } })`. 【F:src/lib/providers/amazon.ts†L156-L200】【F:src/lib/providers/amazon.ts†L321-L360】
2. Pass a Supabase client plus a logger into `provider.refresh({ supabase, logger })` (or use the helper that already wraps providers in your job runner).
3. Set `seedLimit`, `maxKeywords`, or `refreshIntervalMs` if you want to throttle the workload while testing.

## 6. Queue real seeds
1. Insert or import the first batch of Amazon seeds using the synthetic importer (`pnpm tsx src/lib/synthetic/import.ts --market us --source amazon --file data/amazon-seeds.csv`) or manual SQL.
2. Flip the `status` column to `ready` for any seed you want the provider to query on the next run. Seeds stay in the queue and will get a `last_run_at` timestamp after each refresh. 【F:src/lib/providers/amazon.ts†L206-L259】【F:src/lib/providers/amazon.ts†L321-L339】

## 7. Run the enrichment job end to end
1. Start your worker (for example `pnpm tsx scripts/run-provider.ts amazon`) so it can call `refresh`.
2. Watch the logs—the provider emits an `api-call` log entry for every suggest and PA-API request so you can trace volume. 【F:src/lib/providers/amazon.ts†L233-L264】【F:src/lib/providers/amazon.ts†L276-L320】
3. When the run finishes you should see `status: "success"` plus counts for keywords processed, upserted, and metrics returned. 【F:src/lib/providers/amazon.ts†L323-L360】

## 8. Verify the data in the app
1. Open the dashboard and filter by the Amazon marketplace to confirm the new keywords appear with demand, competition, engagement, and opportunity values populated.
2. Spot-check the `extras.amazon.metrics` payload in Supabase to confirm the raw values match your calculations. 【F:src/lib/providers/amazon.ts†L135-L155】【F:src/lib/providers/amazon.ts†L271-L320】
3. Schedule the worker on a cron (for example every 6 hours) so keywords stay fresh; the provider already updates `next_run_at` for you. 【F:src/lib/providers/amazon.ts†L321-L360】

You now have an end-to-end loop that turns Amazon seeds into live keywords with metrics in Lexy. Extend the metrics fetcher as your data science toolkit grows, but the plumbing above is enough to ship the first live version.
