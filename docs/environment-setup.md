# LexyHub Environment Setup

This guide captures the baseline environment configuration for the LexyHub production deployment.

## Supabase
- Project reference: `lexyhub`
- Extensions: `pgvector` enabled via `supabase/config.toml`
- Local development variables are managed through `supabase/.env.example`.
- Default embeddings leverage OpenAI's `text-embedding-3-large` model (3072 dimensions) so that inserts match the `vector(3072)`
  columns defined in `supabase/migrations/0001_init_core_tables.sql`. Override models only if you also update the underlying
  Supabase schema.

### Required Secrets
| Key | Description |
| --- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST URL used by the Next.js client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for browser access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key scoped to backend and CI usage. |
| `LEXYHUB_JWT_SECRET` | Secret used for signing internal JWTs. |
| `OPENAI_API_KEY` | API key for AI workflows. |
| `GOOGLE_TRENDS_API_KEY` | Optional key for live Google Trends ingest. |
| `PINTEREST_ACCESS_TOKEN` | Optional token unlocking Pinterest board metrics. |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | OAuth credentials for Reddit trend ingest. |
| `PARTNER_API_STATIC_KEYS` | Comma or newline separated `key:name:limit` entries for fixed partner keys. |
| `ETSY_CLIENT_ID` | Etsy OAuth client for seller sync. |
| `ETSY_CLIENT_SECRET` | Etsy OAuth secret for seller sync. |
| `ETSY_REDIRECT_URI` | OAuth redirect used during Etsy account linking. |
| `STRIPE_SECRET_KEY` | Stripe secret key for billing APIs. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret configured in the dashboard. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Server and browser DSNs for Sentry error monitoring. |
| `SENTRY_ENVIRONMENT` | Optional environment label shown on Sentry issues (defaults to `VERCEL_ENV`). |
| `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Transaction tracing sample rates (0-1) overriding defaults. |
| `SENTRY_PROFILES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE` | Profiling sample rates (0-1) overriding defaults. |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Optional CLI settings for uploading source maps during CI builds. |
| `SENTRY_AUTH_TOKEN` | Token that authorizes the Sentry CLI to upload artifacts in CI. |
| `POSTHOG_API_KEY` | Server-side PostHog key for API analytics. |
| `POSTHOG_HOST` | Optional PostHog host override (defaults to `https://app.posthog.com`). |
| `NEXT_PUBLIC_POSTHOG_KEY` | Browser key for PostHog usage analytics. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog host override for the browser bundle. |

Mirror these secrets in both Vercel project settings and GitHub Actions secrets. Supabase credentials are mandatory for API
responses—missing values surface as `503` errors rather than synthetic fallbacks. Optional trend provider keys remain
best-effort; without them the radar returns empty datasets.

> **Keyword tier column compatibility**
>
> Some Supabase environments store `public.keywords.tier` as a `text` column while others migrated to `smallint`. The API now
> automatically retries tier-filtered queries with numeric plan ranks (`0` = free, `1` = growth, `2` = scale) when Supabase
> reports an invalid text-to-smallint cast. Ensure migrations and seed data stay aligned with this expectation to avoid
> repeated fallbacks in logs.

## Tooling & Automation
- Husky pre-commit runs `npm run lint` and `npm run typecheck`.
- Prettier is configured at the repo root with `printWidth: 90` to encourage consistent formatting.
- CI pipeline executes lint, typecheck, test (with V8 coverage via `@vitest/coverage-v8`), build, and optional Vercel preview deployment jobs. The preview deployment gracefully skips when the `VERCEL_TOKEN` secret is not configured, allowing forks to run CI without configuration errors.
- Supabase migrations workflow now lints SQL via `supabase db lint` prior to applying changes.

## Observability
- Sentry bootstraps through `sentry.client.config.ts`, `sentry.server.config.ts`, and helpers in `src/lib/observability/sentry.ts`. Configure DSNs, environments, and sample rates to control alert volume per deployment.
- PostHog replaces Vercel Analytics. The browser mounts `LexyPosthogProvider` from `src/app/providers.tsx`, while API routes rely on `src/lib/analytics/posthog-server.ts` for event capture.
- Additional providers (Logflare, etc.) can be layered onto the analytics hooks introduced here.
