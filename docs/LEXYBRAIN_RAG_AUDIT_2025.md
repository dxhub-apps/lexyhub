# LexyBrain RAG Implementation Audit - 2025

**Audit Date**: 2025-11-09
**Branch**: `claude/audit-lexybrain-rag-implementation-011CUxQvyfyMMixnf6tqz38X`
**Auditor**: Senior Engineering Agent (Autonomous)

---

## Executive Summary

### Implementation Status: **NOT READY**

The LexyHub codebase contains a **well-designed unified LexyBrain orchestration foundation** (migration 0045, orchestrator.ts with 664 lines), but **critical implementation gaps** prevent it from being production-ready as a single, deterministic RAG system.

**Key Finding**: Multiple code paths bypass the orchestrator and call LLMs directly, creating inconsistencies, duplicate business logic, and technical debt.

---

## Audit Scope

Verification of FULL unified LexyBrain RAG implementation with focus on:

- **A.** Single LexyBrain orchestration layer
- **B.** `public.keywords` as golden source
- **C.** Deterministic keyword intelligence
- **D.** Unified RAG (ai_corpus) and retrieval
- **E.** Ask LexyBrain + keyword insights unification
- **F.** Admin/backoffice prompt management
- **G.** GitHub workflows and automations
- **H.** Cleanup and dead code
- **I.** Keyword-first product focus

---

## Detailed Findings

### ✅ Section A: Single LexyBrain Orchestration Layer (PARTIAL PASS)

**Status**: Foundation exists but **not enforced**

**What Works**:
- ✅ `/src/lib/lexybrain/orchestrator.ts` (664 lines) - well-structured main orchestrator
- ✅ `/src/app/api/lexybrain/route.ts` - unified POST endpoint with 8 capabilities
- ✅ Orchestrator loads deterministic data from Postgres first
- ✅ Performs retrieval from vector index (`ai_corpus`)
- ✅ Builds prompts from structured data + retrieved chunks
- ✅ Calls configured model via shared HF client using single model ID

**What's Broken**:
- ❌ **7+ endpoints bypass orchestration and call LLMs directly**:
  1. `/api/lexybrain/rag/route.ts:224` - Uses `lexybrainGenerate()` directly
  2. `/api/lexybrain/generate/route.ts:196` - Legacy caching endpoint with direct `generateLexyBrainJson()`
  3. `/api/ext/lexybrain/quick-insight/route.ts` - Extension endpoint bypasses orchestrator
  4. `/api/jobs/intent-classify/route.ts:75` - Calls `classifyKeywordIntent()` directly
  5. `/api/jobs/rebuild-clusters` - AI labeling bypasses orchestrator
  6. `/api/ai/visual-tag` - Image analysis calls HuggingFace directly
  7. `/api/ai/tag-optimizer` - Tag suggestions bypass orchestrator

**Impact**: Different features produce inconsistent results because they use different prompts, retrieval logic, and models.

---

### ✅ Section B: `public.keywords` as Golden Source (PASS)

**Status**: ✅ **PASS**

**Evidence**:
- ✅ `public.keywords` exists (migration 0022)
- ✅ All keyword-centric features reference `keyword_id` from this table
- ✅ Orchestrator reads from `public.keywords` (orchestrator.ts:190)
- ✅ Keyword search reads from `public.keywords` (keywords/search/route.ts)
- ✅ No parallel or conflicting keyword tables as primary sources

**Files Verified**:
- `supabase/migrations/0022_keywords_golden_source.sql`
- `src/lib/lexybrain/orchestrator.ts:184-203`
- `src/app/api/keywords/search/route.ts`

---

### ✅ Section C: Deterministic Keyword Intelligence (PASS)

**Status**: ✅ **PASS**

**Evidence**:
- ✅ Deterministic metrics tables exist and are used:
  - `keyword_metrics_daily` (migration 0021)
  - `keyword_metrics_weekly` (migration 0045:302)
  - `keyword_predictions` (migration 0045:315)
  - `risk_rules` (migration 0045:327)
  - `risk_events` (migration 0045:340)
- ✅ Orchestrator uses these metrics directly (orchestrator.ts:205-312)
- ✅ Prompts include "Use only provided data/context" (migration 0045:97)
- ✅ System prompt forbids guessing: "Never fabricate metrics" (migration 0045:97)

**Prompt Constraints Verified**:
```sql
-- From ai_prompts seed data (migration 0045:97)
'You are LexyBrain, the single intelligence layer for LexyHub.
Use only provided deterministic metrics, retrieved corpus facts, and approved policies.
If the context is insufficient, respond with "No reliable data" and explain which inputs are missing.
Never fabricate metrics, listings, or external data.'
```

---

### ⚠️ Section D: Unified RAG (ai_corpus) and Retrieval (PARTIAL PASS)

**Status**: Foundation exists but **RAG endpoint bypasses it**

**What Works**:
- ✅ Single main corpus table `public.ai_corpus` (migration 0045:144)
- ✅ Schema includes: owner_scope, source_type, source_ref, marketplace, chunk, embedding, metadata
- ✅ RRF retrieval function `ai_corpus_rrf_search()` (migration 0045:204) - combines lexical + vector search
- ✅ Orchestrator uses RRF retrieval (orchestrator.ts:331)

**What's Broken**:
- ❌ **Ask LexyBrain RAG endpoint uses separate retrieval logic**:
  - `/api/lexybrain/rag/route.ts:158` - Custom `fetchFullContext()`
  - `/api/lexybrain/rag/route.ts:170` - Custom `rerank()` function
  - Does NOT use `ai_corpus_rrf_search()` RPC
- ❌ Legacy `keyword_embeddings` table still exists (migration 0037:208) - **UNUSED**
- ❌ Unused RPCs: `search_keywords_by_embedding()`, `similar_keywords()`

**Impact**: Ask LexyBrain chat and keyword insights can return different context for the same question.

---

### ❌ Section E: Ask LexyBrain + Keyword Insights Unification (FAIL)

**Status**: ❌ **FAIL** - Separate code paths

**Evidence**:
- ❌ Ask LexyBrain (`/api/lexybrain/rag`) does NOT use orchestrator
- ❌ Uses separate prompt builder: `/lib/rag/prompt-builder.ts`
- ❌ Uses separate retrieval: `/lib/rag/retrieval.ts`
- ❌ Uses separate capability detection: `/lib/rag/capability-detector.ts`
- ✅ Keyword insights (`/api/lexybrain`) uses orchestrator correctly

**Code Evidence**:
```typescript
// /api/lexybrain/rag/route.ts:224
const response = await lexybrainGenerate({
  prompt,
  max_tokens: requestData.options?.maxTokens || 1024,
  temperature: requestData.options?.temperature || 0.7,
});
// ^ Direct LLM call, bypasses orchestrator
```

**Impact**: Asking about a keyword in chat vs running keyword insights produces **inconsistent numbers and narratives**.

---

### ⚠️ Section F: Admin/Backoffice Prompt Management (PARTIAL PASS)

**Status**: **Conflicting schemas**

**What Works**:
- ✅ Admin UI exists: `/admin/backoffice/lexybrain/page.tsx`
- ✅ CRUD operations for prompts
- ✅ Versioning/activation flags
- ✅ Restricted to authorized admins

**What's Broken**:
- ❌ **Two conflicting prompt tables exist**:
  1. `lexybrain_prompt_configs` (migration 0037:166) - **legacy**
  2. `ai_prompts` (migration 0045:65) - **current**
- ❌ Admin UI queries `lexybrain_prompt_configs` (configs/route.ts:533)
- ✅ Orchestrator reads from `ai_prompts` (orchestrator.ts:362)
- ❌ **Admin cannot manage prompts that orchestrator actually uses**

**Migration Path Required**:
```sql
-- Need migration to copy data from lexybrain_prompt_configs to ai_prompts
-- Then drop lexybrain_prompt_configs
-- Then update admin UI to query ai_prompts
```

---

### ❌ Section G: GitHub Workflows and Automations (FAIL)

**Status**: ❌ **FAIL** - Workflows bypass orchestration

**Evidence**:
- ❌ Intent classification job calls AI directly (jobs/intent-classify/route.ts:75)
- ❌ Cluster rebuild job calls AI directly for labeling
- ❌ No workflows consume LexyBrain via orchestration endpoint
- ✅ Background jobs workflow exists (.github/workflows/background-jobs.yml)

**Workflow Analysis**:
```yaml
# .github/workflows/background-jobs.yml
# Triggers: intent-classify, rebuild-clusters, embed-missing
# These call /api/jobs/* endpoints which bypass orchestrator
```

**Impact**: Automated enrichment uses different prompts/models than interactive features.

---

### ⚠️ Section H: Cleanup and Dead Code (PARTIAL PASS)

**Status**: Significant dead code identified

**Dead Code Inventory**:

**Test Endpoints** (DELETE):
- `/api/test-runpod/route.ts` - Tests old RunPod provider
- `/api/lexybrain/test-auth/route.ts` - Tests legacy load balancer
- `/api/debug/posthog/route.ts` - Debug endpoint

**Deprecated Provider Code** (REMOVE):
- `/lib/lexybrain/runpodClient.ts` - Only used by test endpoint
- RunPod provider throws error "deprecated, use HuggingFace"
- OpenAI provider "not yet implemented"

**Unused Database Tables** (DROP):
- `keyword_embeddings` - Replaced by ai_corpus (migration 0037:208)
- `api_usage_tracking` - Created but never queried
- `rag_feedback` - Created but not used
- `user_activity` - Never referenced (migration 0045:353)

**Unused RPC Functions** (DROP):
- `search_keywords_by_embedding()` - Replaced by ai_corpus_rrf_search
- `similar_keywords()` - Never called
- `cleanup_expired_ai_insights()` - No scheduled job

**Duplicate Migrations** (RESOLVE):
- 6 duplicate migration numbers: 0018, 0019, 0022, 0023, 0024, 0025
- Unresolved merge conflicts in migration history

---

### ✅ Section I: Keyword-First Product Focus (PASS)

**Status**: ✅ **PASS**

**Evidence**:
- ✅ Core features prioritize keyword discovery and insights
- ✅ Ask LexyBrain focused on explainable intelligence
- ⚠️ One off-scope feature: `/api/ai/visual-tag` (image analysis)
- ✅ No generic copywriter or SEO blog generator

**Recommendation**: Disable or deprecate `/api/ai/visual-tag` unless it supports keyword intelligence.

---

## Architecture Diagram (Current vs. Desired)

### Current State (Fragmented)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend / Extension                      │
└────┬────────────────────┬───────────────────┬───────────────┘
     │                    │                   │
     ▼                    ▼                   ▼
┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ /api/       │  │ /api/lexybrain/  │  │ /api/jobs/       │
│ lexybrain   │  │ rag              │  │ intent-classify  │
│ (Orch)      │  │ (Direct LLM)     │  │ (Direct LLM)     │
└─────┬───────┘  └────────┬─────────┘  └────────┬─────────┘
      │                   │                      │
      ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│              HuggingFace / LLM Providers                     │
│  (Multiple inconsistent prompts, retrieval strategies)      │
└─────────────────────────────────────────────────────────────┘
```

### Desired State (Unified)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend / Extension                      │
└────┬────────────────────┬───────────────────────────────────┘
     │                    │
     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/lexybrain (Orchestrator)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Capabilities: keyword_insights, market_brief,        │   │
│  │ ask_anything, intent_classification, cluster_labeling│   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Retrieval: ai_corpus_rrf_search (Lexical + Vector)  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Prompts: ai_prompts (Admin-managed, versioned)      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              HuggingFace (Single Provider)                   │
│              Model: LEXYBRAIN_MODEL_ID (env config)          │
└─────────────────────────────────────────────────────────────┘
```

---

## TODO List (Prioritized)

### 🔴 CRITICAL - Backend Unification

**A1. Route RAG through Orchestrator**
- [ ] Refactor `/api/lexybrain/rag/route.ts:224` to call orchestrator with capability `ask_anything`
- [ ] Remove custom `fetchFullContext()` and `rerank()` logic
- [ ] Use orchestrator's `retrieveCorpusContext()` for retrieval
- [ ] Verify RAG uses same prompts from `ai_prompts` table

**A2. Route Jobs through Orchestrator**
- [ ] Add capability `intent_classification` to orchestrator
- [ ] Add capability `cluster_labeling` to orchestrator
- [ ] Refactor `/api/jobs/intent-classify/route.ts:75` to call `/api/lexybrain` endpoint
- [ ] Refactor `/api/jobs/rebuild-clusters` to call `/api/lexybrain` endpoint
- [ ] Verify GitHub workflows call orchestrator, not direct LLM

**A3. Consolidate Prompt Management**
- [ ] Create migration to copy `lexybrain_prompt_configs` → `ai_prompts`
- [ ] Map types: `market_brief`, `radar`, `ad_insight`, `risk`, `global` → capability keys
- [ ] Update admin API `/api/admin/lexybrain/configs/route.ts` to query `ai_prompts`
- [ ] Verify admin UI can CRUD prompts that orchestrator uses
- [ ] Drop `lexybrain_prompt_configs` table

### 🟡 HIGH - Code Cleanup

**H1. Remove Dead Endpoints**
- [ ] Delete `/api/test-runpod/route.ts`
- [ ] Delete `/api/lexybrain/test-auth/route.ts`
- [ ] Delete `/api/debug/posthog/route.ts`

**H2. Remove Dead Provider Code**
- [ ] Remove `/lib/lexybrain/runpodClient.ts`
- [ ] Remove OpenAI provider stub from `/lib/lexybrain/providers/index.ts`

**H3. Drop Unused Database Objects**
- [ ] Drop table `keyword_embeddings`
- [ ] Drop table `user_activity`
- [ ] Drop table `rag_feedback` (if confirmed unused)
- [ ] Drop RPC `search_keywords_by_embedding()`
- [ ] Drop RPC `similar_keywords()`
- [ ] Drop RPC `cleanup_expired_ai_insights()`

**H4. Resolve Migration Conflicts**
- [ ] Review 6 duplicate migration numbers (0018, 0019, 0022, 0023, 0024, 0025)
- [ ] Create clean migration sequence
- [ ] Document resolution in migration changelog

### 🟢 MEDIUM - Features & Workflows

**G1. Update GitHub Workflows**
- [ ] Update `.github/workflows/background-jobs.yml` to call orchestrator
- [ ] Remove direct HuggingFace calls from workflow scripts
- [ ] Verify all scheduled jobs use `/api/lexybrain` endpoint

**I1. Deprecate Off-Scope Features**
- [ ] Evaluate `/api/ai/visual-tag` - deprecate or integrate with keyword intelligence
- [ ] Evaluate `/api/ai/tag-optimizer` - route through orchestrator or deprecate

**E1. Legacy Endpoint Migration**
- [ ] Mark `/api/lexybrain/generate` as deprecated (add warning header)
- [ ] Add redirect to `/api/lexybrain` with capability mapping
- [ ] Schedule removal for next major version

### 🔵 LOW - Documentation

**Docs Updates**
- [ ] Update `/docs/LEXYBRAIN_UNIFIED_ENGINE.md` with single orchestrator pattern
- [ ] Document all 8+ capabilities (keyword_insights, ask_anything, intent_classification, etc.)
- [ ] Document migration path from `lexybrain_prompt_configs` to `ai_prompts`
- [ ] Add troubleshooting guide for prompt management
- [ ] Create runbook for adding new orchestrator capabilities

---

## Risk Assessment

### High Risk Issues

1. **Inconsistent User Experience**
   - **Risk**: Same keyword produces different insights in chat vs. insights page
   - **Impact**: User confusion, trust erosion
   - **Mitigation**: Route all endpoints through orchestrator (A1, A2)

2. **Unmanageable Prompts**
   - **Risk**: Admins cannot update prompts that production uses
   - **Impact**: Cannot tune AI behavior, A/B testing impossible
   - **Mitigation**: Consolidate to `ai_prompts` table (A3)

3. **Duplicate Business Logic**
   - **Risk**: Bug fixes must be applied in 7+ places
   - **Impact**: Increased maintenance cost, inconsistent fixes
   - **Mitigation**: Enforce single orchestrator path (A1, A2)

### Medium Risk Issues

1. **Dead Code Pollution**
   - **Risk**: Developers confused by unused tables/functions
   - **Impact**: Slower development, potential security issues
   - **Mitigation**: Clean up dead code (H1-H4)

2. **Migration Conflicts**
   - **Risk**: Database schema inconsistencies across environments
   - **Impact**: Deployment failures, data integrity issues
   - **Mitigation**: Resolve duplicate migrations (H4)

---

## Recommendations

### Phase 1: Critical Path (Week 1-2)
1. Route RAG through orchestrator (A1)
2. Consolidate prompt management (A3)
3. Add orchestrator capabilities for jobs (A2)

### Phase 2: Cleanup (Week 3)
1. Remove dead endpoints and code (H1-H3)
2. Resolve migration conflicts (H4)
3. Update GitHub workflows (G1)

### Phase 3: Documentation (Week 4)
1. Update all documentation
2. Create runbooks
3. Train team on unified orchestrator pattern

---

## Conclusion

The LexyHub codebase has a **solid orchestration foundation** but suffers from **incomplete adoption**. The orchestrator (orchestrator.ts) is well-designed with:
- ✅ Deterministic metrics loading
- ✅ Unified RAG retrieval (RRF)
- ✅ Prompt management infrastructure
- ✅ Comprehensive logging and analytics

However, **7+ code paths bypass this infrastructure**, creating:
- ❌ Inconsistent user experience
- ❌ Duplicate business logic
- ❌ Unmanageable prompts
- ❌ Technical debt

**Effort Estimate**: 2-4 weeks to unify all code paths through orchestrator.

**ROI**: High - enables prompt management, A/B testing, and consistent UX across all LexyBrain features.

---

**Audit Completed**: 2025-11-09
**Next Review**: After TODO completion (estimated 4 weeks)
