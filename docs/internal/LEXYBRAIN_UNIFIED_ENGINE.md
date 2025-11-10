# LexyBrain Unified Orchestration Engine

This document describes the unified LexyBrain engine introduced in migration `0045_lexybrain_unified_engine.sql`. The goal is to ensure that every AI-powered surface inside LexyHub uses the same deterministic orchestration workflow and central storage.

## High-level architecture

1. **Single orchestration entrypoint** – `/api/lexybrain` now accepts capability-driven requests instead of ad-hoc prompts.
2. **Deterministic context first** – data comes from `public.keywords`, the `keyword_metrics_*` family, `keyword_predictions`, and risk tables before any LLM call is made.
3. **Unified retrieval** – factual context is retrieved from the `ai_corpus` table using Reciprocal Rank Fusion via the `ai_corpus_rrf_search` helper.
4. **Prompt governance** – all system and capability instructions live in the `ai_prompts` table with per-key activation flags.
5. **Snapshots & audit** – generated insights are persisted to `keyword_insight_snapshots` with references back to every deterministic data point and corpus chunk that informed the answer.

## Request flow

1. Client sends a request to `/api/lexybrain` specifying `capability`, `keywordIds`, and optional query context.
2. The route authenticates the user, validates the payload, and forwards the call to `runLexyBrainOrchestration`.
3. The orchestrator:
   - Loads deterministic metrics and predictions for the provided keywords.
   - Retrieves relevant `ai_corpus` chunks filtered by marketplace/language and fused with RRF.
   - Builds a structured prompt using the active system + capability instructions from `ai_prompts`.
   - Calls `generateLexyBrainJson` (Llama via Hugging Face) to obtain validated JSON output.
   - Persists the final insight and references in `keyword_insight_snapshots`.
4. The API returns the structured insight, deterministic context, references, and model metadata.

## Tables introduced

| Table | Purpose |
| --- | --- |
| `ai_prompts` | Stores all active LexyBrain prompts (system, capability, template) with versionable keys and metadata. |
| `ai_corpus` | Unified factual corpus used for retrieval across every capability. Includes pgvector embeddings and lexical index. |
| `keyword_metrics_weekly` | Weekly deterministic aggregates per keyword. |
| `keyword_predictions` | Deterministic forecast payloads per keyword/marketplace. |
| `risk_rules` & `risk_events` | Canonical risk definitions and observed events that must anchor alert explanations. |
| `keyword_insight_snapshots` | Immutable audit log of generated insights, metrics used, and references. |
| `user_activity` | Deterministic behavioural telemetry for orchestration eligibility and analytics. |

## Prompt management

- `ai_prompts` replaces the legacy `lexybrain_prompt_configs` table as the source of truth.
- Admin tooling should read/write the new table so that prompt changes propagate without redeploys.
- Only one active row per `key` is enforced via a partial unique index, making versioning simple (`keyword_insights_v2`, etc.).

## Retrieval helper

The `ai_corpus_rrf_search` SQL function accepts both lexical queries and deterministic embeddings. It fuses lexical and vector ranks with a configurable `k` parameter and returns the final ranked set of chunks (default 12). Each chunk carries the provenance scope, metadata, and the fused score so that the orchestrator can surface references alongside deterministic metrics.

## Error handling

- If deterministic inputs are missing (`keywordIds` unknown, metrics absent), the orchestrator raises a "No reliable data" error before calling the model.
- Missing Supabase credentials result in a `lexybrain_unavailable` response.
- Each major failure path is logged with structured metadata to `logger` for future observability work.

## Next steps

- Update admin/backoffice tooling to manage `ai_prompts` entries directly.
- Migrate existing automations and workflows to call `/api/lexybrain` using capability payloads.
- Incrementally populate `ai_corpus` with validated factual chunks sourced from ingestion jobs and past snapshots.
