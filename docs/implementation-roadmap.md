# LexyHub Full Build Roadmap

This document describes the end-to-end delivery roadmap for LexyHub, including sprint slicing, implementation tasks, database migrations, background automation, and operational guidance. It is the canonical reference for engineering, data, design, and product contributors.

---

## 1. Delivery Strategy Overview
- **Product Scope:** AI-first cross-market commerce intelligence platform across synthetic data, Amazon, Etsy, Google, Pinterest, Reddit.
- **Tech Stack:** Next.js App Router on Vercel, Supabase Postgres with pgvector, Supabase Auth + JWT, OpenAI APIs, optional CLIP/BLIP-2 models, Supabase storage.
- **Release Cadence:** Six macro stages aligned with six execution sprints (3-weeks each). Every sprint ends with a demonstrable increment deployed to staging.

### Sprint Themes vs. Release Stages
| Sprint | Release Stage Alignment | Primary Outcomes |
| ------ | ---------------------- | ---------------- |
| Sprint 0 | Foundations Pre-work | Project scaffolding, environment wiring, base migrations, CI/CD, telemetry. |
| Sprint 1 | Stage 1 — AI Synthetic Alpha | Synthetic dataset ingest, embeddings pipeline, keyword intelligence MVP. |
| Sprint 2 | Stage 1 Expansion | Tag Optimization AI, AI summaries, launch-ready dashboards. |
| Sprint 3 | Stage 2 — Amazon Beta | Amazon ingestion, mixed-source analytics, quotas & plan gates. |
| Sprint 4 | Stage 3 — Etsy Integration | Etsy auth, shop sync, AI Market Twin. |
| Sprint 5 | Stage 4 & 5 — Trend Expansion & Ontology prep | Trend Radar, Intent Graph, clustering automation, partner API groundwork. |
| Sprint 6 | Stage 6 — Golden Source enablement | Canonical ontology, external API packaging, compliance audits, production hardening. |

> **Tracking:** Use the master checklist in Section 8 to monitor progress. Each task references the responsible sprint and artifacts to produce.

---

## 2. Sprint Backlogs & Detailed Tasks
Each sprint lists epics, cross-functional tasks, acceptance criteria, and instrumentation requirements. Tasks include both engineering and AI/data steps to ensure no dependency is missed.

### Sprint 0 — Foundational Systems Ready
**Objectives:** Ready-to-build baseline with environments, migrations, CI/CD, and telemetry wired.

- **S0-E1 Infrastructure & Access**
  - [ ] Provision Supabase project, enable `pgvector`, configure `supabase/config.toml`.
  - [ ] Generate Supabase service role & anon keys; store in Vercel project & GitHub secrets.
  - [ ] Configure Vercel project with environment secrets (OpenAI keys, Supabase URL).
  - [ ] Setup `supabase/.env.example` with placeholders.
- **S0-E2 Codebase Scaffolding**
  - [ ] Install base dependencies: `@supabase/supabase-js`, `ai`, `zod`, `@tanstack/react-table`, `@vercel/analytics`.
  - [ ] Configure ESLint/Prettier (align with Next.js defaults) and Husky pre-commit.
  - [ ] Add base app shell (Topbar, Sidebar tokens, placeholder routes).
- **S0-E3 Observability & CI/CD**
  - [ ] GitHub Actions: lint, typecheck, test, build, deploy preview.
  - [ ] Add Supabase migration CI (using `supabase db lint`).
  - [ ] Wire Logflare/analytics events from Next.js API routes.
- **Exit Criteria:** Baseline Next.js app deploys to staging, CI green, migrations apply cleanly, environment documentation published.

### Sprint 1 — Synthetic Intelligence Core
**Objectives:** Synthetic keyword dataset ingestion, embeddings, keyword intelligence search with AI summary.

- **S1-E1 Synthetic Dataset Loader**
  - [ ] Build CLI importer (`src/lib/synthetic/import.ts`) to load open taxonomies into `keyword_seeds`, `keywords`, `embeddings`.
  - [ ] Implement cleaning utilities (lowercase, dedupe, normalization).
  - [ ] Store provenance (`source='synthetic'`, `method='synthetic-ai'`).
- **S1-E2 Embedding Pipeline**
  - [ ] Implement `src/lib/ai/embeddings.ts` with caching by `term_hash` and OpenAI call.
  - [ ] Background job (Vercel Cron) to embed missing terms hourly.
  - [ ] Unit tests covering caching and API failure handling.
- **S1-E3 Keyword Intelligence API**
  - [ ] Create API route `/api/keywords/search` (Next.js route handler) returning ranked results.
  - [ ] Integrate pgvector similarity search for neighbors.
  - [ ] Add AI explanation call to GPT for top cluster summary.
- **S1-E4 UI Delivery**
  - [ ] Build Keywords page table (columns: term, source, scores, add-to-watchlist).
  - [ ] Add AI Insights side panel with summary and `trend_series` sparkline placeholder.
  - [ ] Include compliance info (source, freshness, method).
- **Exit Criteria:** Synthetic dataset searchable with AI explanations, embeddings stored, UI demonstrates insights with explainability.

### Sprint 2 — AI Enhancement & Watchlists
**Objectives:** Tag optimization AI, watchlists, plan gating, and improved analytics surfaces.

- **S2-E1 Tag Optimization AI**
  - [ ] API `/api/ai/tag-optimizer` storing outputs in `ai_predictions` / `ai_suggestions` table.
  - [ ] GPT prompt library with trace metadata.
  - [ ] UI modal for tag suggestion results with reasoning.
- **S2-E2 Watchlists & Quotas**
  - [ ] `watchlists` table & service to add keywords/listings within limits.
  - [ ] Middleware enforcing daily query and suggestion quotas based on plan + momentum multiplier.
  - [ ] Dashboard card summarizing usage vs quota.
- **S2-E3 Visual Tag AI**
  - [ ] File upload to Supabase storage bucket (`assets/listings`).
  - [ ] Local caption generation via BLIP-2 (Edge function or serverless worker) with fallback.
  - [ ] GPT tag extraction, storing confidences in `extras` JSON.
- **S2-E4 UX Polish**
  - [ ] Toast system per design tokens.
  - [ ] Responsive sidebar collapse with tooltips.
- **Exit Criteria:** Users can optimize tags, maintain watchlists, and stay within plan limits; AI flows are explainable and logged.

### Sprint 3 — Amazon Data Integration
**Objectives:** Add Amazon provider, unify multi-source analytics, enforce provenance.

- **S3-E1 Provider Framework**
  - [ ] Implement `KeywordSourceProvider` interface in `src/lib/providers/base.ts`.
  - [ ] Build provider registry & scheduler orchestrating background refresh.
- **S3-E2 Amazon Provider**
  - [ ] Integrate Suggest + PA-API, respecting rate limits.
  - [ ] Map Amazon data into standard keyword schema with provenance metadata.
  - [ ] Unit tests with recorded fixtures.
- **S3-E3 Mixed Source Analytics**
  - [ ] Update keyword search to filter by plan tier, sources.
  - [ ] Introduce demand/competition composite scoring across sources.
  - [ ] Display source badges and tooltips in UI.
- **S3-E4 Compliance & Auditing**
  - [ ] Logging of API calls with token usage.
  - [ ] Data lineage component in UI (“Data Info” panel).
- **Exit Criteria:** Amazon data seamlessly augments synthetic base, compliance instrumentation active, quotas enforced.

### Sprint 4 — Etsy Integration & Market Twin
**Objectives:** Connect Etsy shops, sync listings, deliver AI Market Twin simulator.

- **S4-E1 Etsy OAuth & Data Sync**
  - [ ] Implement OAuth flow via Next.js route `/api/auth/etsy`.
  - [ ] Sync listings into `listings`, `listing_tags`, `listing_stats` tables.
  - [ ] Schedule 6h refresh job with delta updates.
- **S4-E2 AI Market Twin**
  - [ ] Build simulator service comparing baseline vs hypothetical listing.
  - [ ] Compute semantic gap via embeddings, trend correlation delta, predicted visibility.
  - [ ] GPT explanation generator with confidence score.
  - [ ] UI wizard to run scenarios and persist history.
- **S4-E3 Billing Integration**
  - [ ] Stripe subscription sync with `user_profiles` plan state.
  - [ ] Webhooks updating quotas and momentum multipliers.
- **Exit Criteria:** Etsy sellers can connect, run Market Twin simulations, and manage billing through LexyHub.

### Sprint 5 — Trend & Intent Intelligence
**Objectives:** Trend Radar, Intent Graph, clustering automation, groundwork for partner API.

- **S5-E1 Trend Radar**
  - [ ] Ingest Google Trends, Pinterest board metrics, Reddit topic stats (stubs if API pending).
  - [ ] Daily trend aggregation job writing to `trend_series` with `trend_momentum` and `expected_growth_30d`.
  - [ ] UI trend radar visualization with color-coded velocities.
- **S5-E2 Intent Graph**
  - [ ] GPT-driven classification pipeline storing intents in `extras.classification`.
  - [ ] Graph layout service using Force Atlas or d3-force, served to client.
  - [ ] UI graph with legend, filters, and tooltip explanation.
- **S5-E3 Cluster Automation**
  - [ ] Cron job to rebuild `concept_clusters` using pgvector + GPT labeling.
  - [ ] Audit trail storing GPT prompts/responses.
- **S5-E4 Partner API Foundations**
  - [ ] Build `/api/v1/keywords` endpoints with API keys.
  - [ ] Rate limiting and usage tracking per partner.
- **Exit Criteria:** Trend and intent visualizations live, automated clustering running, external API ready for beta partners.

### Sprint 6 — Golden Source Hardening
**Objectives:** Ontology stabilization, external API release readiness, compliance and security audits.

- **S6-E1 Commerce Ontology**
  - [ ] Define canonical Lexy IDs for concepts, map to source terms.
  - [ ] Versioning strategy documented, stored in `concept_clusters` + `ontology_nodes` tables.
- **S6-E2 API & Documentation**
  - [ ] Publish developer docs (OpenAPI, usage examples).
  - [ ] Implement API usage dashboards and alerts.
- **S6-E3 Reliability & Compliance**
  - [ ] Load testing, chaos drills, SLO definition.
  - [ ] Security review, penetration test fixes.
  - [ ] Final compliance evidence package.
- **Exit Criteria:** Golden source ready with canonical ontology, audited platform, external API supported by docs & monitoring.

---

## 3. Cross-Cutting Workstreams
These activities span multiple sprints and must be kept current.

- **Data Governance:** Maintain provenance metadata, implement GDPR/CCPA delete flows, data retention policies.
- **AI Cost Control:** Token usage dashboards, per-plan rate limiters, caching strategy updates.
- **Design System:** Maintain tokenized theme, document components in Storybook, ensure accessible contrast ratios.
- **Testing:** Unit, integration, e2e (Playwright) suites; include AI mock services for deterministic tests.
- **Analytics:** Funnel tracking (search -> watchlist -> simulation -> subscription), event naming conventions.

---

## 4. Database Migration Plan
Supabase migrations live under `supabase/migrations` and execute sequentially. Apply using `supabase db reset` locally and GitHub Action in CI.

| File | Purpose |
| ---- | ------- |
| `0001_init_core_tables.sql` | Core keyword, embedding, cluster, trend, AI prediction, seed, user profile tables. |
| `0002_watchlists_and_usage.sql` | Watchlists, usage tracking, quotas, audit logs. |
| `0003_marketplace_entities.sql` | Listings, listing tags/stats, provider metadata, ontology scaffolding. |
| `0004_billing_and_api.sql` | Billing (Stripe) integration tables, API keys, request logs. |

Each migration uses `create table if not exists` and `comment on` for documentation. Additional migrations must follow numeric sequence and include down-migration statements when feasible.

---

## 5. Feature Implementation Instructions
Detailed instructions on delivering each major feature. Follow sprint alignment but reference this section for step-by-step execution.

### 5.1 Keyword Intelligence
1. Implement server action wrapping SQL query with pgvector similarity join against `embeddings`.
2. Rank results using weighted formula: `0.4*demand_index + 0.3*(1-competition_score) + 0.3*trend_momentum`.
3. Fetch cluster context via `concept_clusters.members` to provide neighbor information.
4. Invoke GPT for summary with prompt template storing `model`, `prompt_hash` in `ai_predictions`.
5. Surface UI via React table with filter controls and `Add to Watchlist` action wired to API.

### 5.2 Tag Optimization AI
1. Accept listing payload (title, tags, description) from client; validate with Zod.
2. Build prompt referencing Etsy best practices and compliance guardrails.
3. Call GPT (`gpt-4o-mini`) with caching keyed by listing hash + inputs.
4. Store suggestion, reasoning, tokens consumed in `ai_predictions` (`scenario_input`, `extras` fields).
5. Display modal with rewritten title, comma-separated tags, reasoning bullet list, and `Data Info` panel showing provenance.

### 5.3 Visual Tag AI
1. Upload image to Supabase storage; generate signed URL.
2. Run caption model (BLIP-2) in Edge function; persist raw caption with `method='vision-ai'`.
3. Pass caption to GPT with prompt instructing safe, inclusive language and short tags.
4. Save results to `ai_predictions` with `extras.confidence_scores`.
5. Show UI modal with image preview, tags, copy-to-clipboard, and usage quota cost.

### 5.4 AI Market Twin™
1. Compute embeddings for baseline & hypothetical listings; derive cosine similarity difference.
2. Calculate trend correlation using `trend_series` history.
3. Estimate predicted visibility: `base_visibility * (1 + semantic_delta*alpha + trend_delta*beta - competition_gamma)` (store coefficients in config table).
4. Log run to `ai_predictions` with `scenario_input` capturing old/new details.
5. Provide GPT explanation summarizing drivers, referencing provenance IDs; display results with charts.

### 5.5 Intent Graph™
1. Batch keywords nightly; send to GPT classification prompt with categories: Gift, Home aesthetic, Self-expression, Utility, Seasonal.
2. Store classification in `extras.classification.intent` with confidence.
3. Build service to transform clusters into graph nodes (size = demand, color = trend velocity).
4. Render client graph via d3, allow filtering by intent and source.
5. Provide panel summarizing top opportunities per intent with AI explanation.

### 5.6 Trend Radar
1. Normalize external time-series data into `trend_series` (per source).
2. Compute `trend_momentum` using slope of last 7 data points; compute `expected_growth_30d` using exponential smoothing.
3. Run GPT to produce narrative explanation stored in `ai_predictions` with `model='gpt-4o-mini'`.
4. Visualize as radar chart + timeline with ability to drill into sources.

### 5.7 AI Competitor Insight
1. Allow input of two shops (post-Etsy integration) to fetch listing vectors.
2. Compare cluster coverage, compute “white-space opportunity” by identifying clusters high in demand but low in competitor presence.
3. Summarize using GPT and provide actionable suggestions.

### 5.8 Plan Gates & Usage Enforcement
1. Implement middleware retrieving `user_profiles` plan & momentum to compute allowances.
2. Track per-user usage in `usage_events` table with daily aggregation.
3. Enforce quotas at API level; return descriptive error with upgrade CTA.

### 5.9 Background Jobs
1. Configure Vercel Cron or Supabase scheduled functions for each job (embedding sync, synthetic refresh, etc.).
2. Ensure each job logs tokens, runtime, records touched into `job_runs` table.
3. Add alerts for job failures via Slack webhook.

### 5.10 Compliance & Explainability
1. Populate provenance metadata on every insert/update (source, freshness_ts, method, model, provenance_id).
2. Implement UI component `DataInfoPanel` showing this metadata for each insight.
3. Maintain audit logs for API calls and AI completions (`ai_usage_events`).

---

## 6. Testing & Quality Gates
- **Unit Tests:** Run `npm test` covering utilities, providers, and AI prompt formatters.
- **Integration Tests:** Playwright flows for search, watchlist management, tag optimization, and Market Twin.
- **Data Tests:** SQL assertions verifying referential integrity (`NOT NULL`, FK constraints) executed via Supabase CLI.
- **Performance:** Lighthouse run for core pages, load testing for API endpoints, vector search benchmark.
- **Compliance Tests:** Validate API quota enforcement, deletion requests, provenance display.

---

## 7. Documentation & Communication Plan
- Publish architecture, AI pipeline, synthetic base, sources, plans, ethics docs as described in Section 12 of scope.
- Maintain changelog per sprint in `/docs/changelog.md`.
- Provide weekly Loom demos summarizing sprint progress.
- Update master checklist as tasks complete; include owner initials and completion date.

---

## 8. Master Implementation Checklist
Use this checklist to track progress across all sprints. Each item maps to tasks above and should be updated as work completes.

### Foundations
- [ ] Supabase project configured with pgvector
- [ ] Environment secrets managed in Vercel & GitHub
- [ ] CI/CD pipeline (lint, typecheck, test, build) running
- [ ] Base Next.js shell deployed to staging
- [ ] Observability stack wired (analytics + logging)

### Synthetic Alpha
- [ ] Synthetic dataset imported & normalized
- [ ] Embedding pipeline live with caching
- [ ] Keyword search API + AI summary operational
- [ ] Keywords UI with explainability panel

### AI Enhancements
- [ ] Tag Optimization AI service + UI modal shipped
- [ ] Watchlists with quota enforcement available
- [ ] Visual Tag AI with image captioning functional
- [ ] Toast & responsive navigation polished

### Amazon Beta
- [ ] Provider framework abstracted and tested
- [ ] Amazon provider ingesting suggest & PA-API data
- [ ] Multi-source analytics scoring live
- [ ] Data lineage panel visible in UI

### Etsy Integration & Market Twin
- [ ] Etsy OAuth and listing sync operational
- [ ] AI Market Twin simulator delivering predictions
- [ ] Stripe billing and plan updates integrated

### Trend & Intent Intelligence
- [ ] Trend Radar ingest + visualization complete
- [ ] Intent Graph classification + UI live
- [ ] Automated clustering with GPT labels running
- [ ] Partner API endpoints available

### Golden Source Hardening
- [ ] Canonical ontology with Lexy IDs defined
- [ ] Developer API docs & dashboards published
- [ ] Reliability, security, compliance audits passed

### Background Jobs & Governance
- [ ] Scheduled jobs implemented with monitoring
- [ ] AI cost dashboard tracking usage
- [ ] GDPR/CCPA delete flow validated

---

## 9. Dependency Map & Sequencing Notes
- Synthetic data foundation precedes any external provider ingestion.
- pgvector must be enabled before embeddings pipeline or clustering tasks begin.
- Plan gating depends on watchlists, usage events, and billing integration to be fully functional.
- Trend radar relies on multi-source ingestion; ensure stubs return deterministic data until APIs approved.
- Ontology work requires stable clusters and classification outputs (sprint 5 dependency).

---

## 10. Risk Register & Mitigations
- **API Rate Limits:** Cache responses, schedule ingestion during off-peak hours, maintain manual refresh controls.
- **AI Cost Overruns:** Implement strict caching, monitor token spend dashboards, enforce quotas per plan.
- **Data Compliance:** Store provenance and display in UI; run regular audits.
- **Model Drift:** Schedule reviews of GPT prompts and classification accuracy; maintain prompt versioning.
- **Scalability:** Consider migrating embeddings to Pinecone/Qdrant if Supabase vector performance degrades beyond thresholds.

---

## 11. How to Update This Roadmap
- Update sprint checklists weekly.
- Document new migrations in Section 4.
- Record deviations in `/docs/changelog.md` referencing sprint and reason.
- Ensure all changes are peer-reviewed and cross-linked in Notion/Jira.

