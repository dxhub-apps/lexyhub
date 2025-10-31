# Etsy Integration Guide

LexyHub's Sprint 4 milestone introduces end-to-end Etsy connectivity. This guide explains how to configure the integration, trigger data syncs, and use the Market Twin simulator that now leverages Etsy listings.

## 1. Prerequisites
- Etsy developer application with OAuth credentials
- Supabase project seeded with migrations up to `0004_billing_and_api.sql`
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

## 5. Billing Automation
- Stripe webhooks (`/api/billing/webhook`) validate signatures before recording invoice and subscription updates.
- Subscriptions sync plan and quota metadata into `billing_subscriptions`, `user_profiles`, and `plan_overrides`.
- The profile workspace (`/profile`) fetches data from `/api/billing/subscription` to render plan controls and billing history.

## 6. Local Development Tips
- Without live Etsy credentials the client helpers fall back to deterministic demo payloads so flows stay testable.
- Use `npm run lint`, `npm run test`, and `npm run build` to validate the full Sprint 4 surface.
- For repeated manual syncs, supply a specific `userId` to `/api/jobs/etsy-sync?userId=<uuid>` to scope the run during development.

With these pieces configured, Etsy sellers can authenticate, keep their catalog up to date, and simulate go-to-market adjustments entirely inside LexyHub.
