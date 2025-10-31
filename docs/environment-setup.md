# LexyHub Environment Setup

This guide captures the baseline environment configuration for the LexyHub production deployment.

## Supabase
- Project reference: `lexyhub`
- Extensions: `pgvector` enabled via `supabase/config.toml`
- Local development variables are managed through `supabase/.env.example`.

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

Mirror these secrets in both Vercel project settings and GitHub Actions secrets. Supabase credentials are mandatory for API
responses—missing values surface as `503` errors rather than synthetic fallbacks. Optional trend provider keys remain
best-effort; without them the radar returns empty datasets.

## Tooling & Automation
- Husky pre-commit runs `npm run lint` and `npm run typecheck`.
- Prettier is configured at the repo root with `printWidth: 90` to encourage consistent formatting.
- CI pipeline executes lint, typecheck, test, build, and optional Vercel preview deployment jobs.
- Supabase migrations workflow now lints SQL via `supabase db lint` prior to applying changes.

## Observability
- Vercel Analytics is wired in `src/app/layout.tsx` and API telemetry uses `track` inside `src/app/apps/route.ts`.
- Additional providers (Logflare, etc.) can be layered onto the analytics hooks introduced here.
