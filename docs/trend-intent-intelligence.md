# Trend & Intent Intelligence

Sprint 5 introduces LexyHub's cross-network radar, intent graph, clustering automation, and partner API foundations.

## Trend Radar
- Sources Google Trends, Pinterest boards, and Reddit discussions. API calls fall back to deterministic stubs when keys are
  absent.
- `/api/jobs/trend-aggregation` aggregates signals into `trend_series` and writes momentum back into `keywords.trend_momentum`.
- `/api/insights/trends` powers the new radar UI (`TrendRadar` component) with velocity, expected growth, and provenance.

## Intent Graph
- `/api/jobs/intent-classify` stores GPT-backed intent, persona, and funnel stage metadata in `keywords.extras.classification`.
- `buildIntentGraphLayout` computes a Force-style layout, consumed by `/api/insights/intent-graph` and rendered via the
  `IntentGraph` component.
- Fallback heuristics ensure classifications even when OpenAI is unavailable.
- When Supabase credentials are missing or empty results are returned, `/api/insights/intent-graph` now serves a deterministic
  synthetic dataset from `src/data/synthetic/intent-graph.json` so the UI remains available in local and preview environments.

## Concept Cluster Automation
- `/api/jobs/rebuild-clusters` retrieves embeddings, clusters keywords via a lightweight k-means, and labels clusters with GPT.
- Deterministic IDs keep `concept_clusters` stable between runs while `extras.audit` records prompt/response traces.

## Partner API Foundations
- `/api/v1/keywords` authenticates with Supabase `api_keys` (or static fallbacks), enforces per-minute quotas, and logs usage.
- Helpers in `src/lib/api/partner-auth.ts` share hashing, rate-limiting, and request logging across endpoints.

## UI Enhancements
- `TrendRadar` and `IntentGraph` surface the new data within `/insights`, alongside existing Visual Tag AI and watchlist copy.
- Global styles add responsive radar/graph treatments and badges indicating source freshness.

Refer to this document when updating Sprint 5 deliverables or extending partner and intelligence features.
