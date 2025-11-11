# Keyword Search "No Reliable Data" Fix
**Date:** 2025-11-11
**Issue:** Keywords exist in both `public.keywords` and `public.ai_corpus` but search returns "No reliable data"

## Problem Summary

Users were experiencing "No reliable data for this query in LexyHub at the moment" errors even when:
1. The keyword exists in `public.keywords` table
2. The keyword data exists in `public.ai_corpus` table
3. The corpus records are active (`is_active = true`)
4. The embeddings are properly generated

## Root Cause Analysis

### The Issue: Overly Restrictive Threshold

The RAG (Retrieval-Augmented Generation) endpoint and LexyBrain orchestrator were enforcing a **minimum of 5 sources** before allowing any response. This threshold was too high for several reasons:

1. **Early-stage keywords** - New keywords might only have 1-3 corpus entries (metrics data)
2. **Niche markets** - Less popular marketplaces have less supporting data
3. **Limited corpus** - If only metrics ingestion has been run, there might be < 5 sources
4. **Better to provide partial data** than no data at all

### Code Locations

**File:** `src/app/api/lexybrain/rag/route.ts`
- **Line 184 (BEFORE):** `const insufficientContext = rankedSources.length < 5;`
- **Line 186 (AFTER):** `const insufficientContext = rankedSources.length < 1;`

**File:** `src/lib/lexybrain/orchestrator.ts`
- **Lines 616-629:** Check for empty corpus (unchanged - still requires at least 1 source)
- **Lines 631-643 (NEW):** Added warning log for limited context (1-4 sources)

## Changes Made

### 1. Lowered RAG Endpoint Threshold (route.ts)

**BEFORE:**
```typescript
const insufficientContext = rankedSources.length < 5;

if (insufficientContext) {
  // Return "No reliable data" error
  // This triggered even with 1-4 valid sources!
}
```

**AFTER:**
```typescript
// Lower threshold from 5 to 1 to allow partial data responses
// If we have at least 1 source, we can provide some context
const insufficientContext = rankedSources.length < 1;

if (insufficientContext) {
  // Only return error if we have ZERO sources
}

// Log warning if we have limited context (1-4 sources)
if (rankedSources.length < 5) {
  logger.warn({
    type: "rag_limited_context",
    user_id: userId,
    thread_id: thread.id,
    sources_count: rankedSources.length,
  }, "Limited corpus data available - proceeding with partial context");
}
```

### 2. Added Observability for Orchestrator (orchestrator.ts)

**ADDED:**
```typescript
// Log warning if we have limited corpus context
if (corpus.length < 5) {
  logger.warn({
    type: "lexybrain_limited_context",
    capability: request.capability,
    user_id: request.userId,
    keyword_ids: keywordIds.length,
    corpus_count: corpus.length,
  }, "Limited corpus data available - proceeding with partial context");
}
```

This provides visibility into when LexyBrain is operating with limited data, making it easier to identify keywords that need more corpus enrichment.

### 3. Created Diagnostic Script (NEW)

**File:** `jobs/diagnose-keyword-search.ts`

A comprehensive diagnostic tool to identify why a keyword search might fail. It checks:

1. **Keyword existence** in `public.keywords`
2. **Corpus records** in `public.ai_corpus`
3. **Active status** (`is_active = true`)
4. **Embeddings** (not NULL)
5. **RRF search results** (simulates actual search)
6. **Source count** (checks if threshold is met)

**Usage:**
```bash
npm run jobs:diagnose-keyword-search "your keyword term"
```

**Example output:**
```
================================================================================
KEYWORD SEARCH DIAGNOSTIC
================================================================================

Search term: "handmade leather wallet"

Step 1: Checking public.keywords table...
✅ Found 1 matching keyword(s):
   - ID: abc-123
     Term: "handmade leather wallet"
     Market: etsy
     Source: dataforseo
     Demand Index: 85.23
     Competition Score: 45.67
     Has DataForSEO data: Yes

Step 2: Checking public.ai_corpus table...
✅ Found 2 matching ai_corpus record(s):
   - ID: corpus-1
     Source Type: keyword_metrics
     Owner Scope: global
     Marketplace: etsy
     Is Active: true
     Has Embedding: Yes
     Chunk Preview: Keyword: "handmade leather wallet". Marketplace: etsy...

✅ Active records: 2/2
✅ Records with embeddings: 2/2

Step 3: Testing ai_corpus_rrf_search function...
✅ Generated embedding for query (dimension: 384)
✅ RRF search returned 2 result(s)

Top 2 results:
   1. Combined Score: 0.0328
      Source Type: keyword_metrics
      Lexical Rank: 1
      Vector Rank: 1
      Chunk: Keyword: "handmade leather wallet". Marketplace: etsy. Current Metrics...

❌ INSUFFICIENT CONTEXT: Only 2 result(s) found
✅ DIAGNOSIS: The search returns results but FEWER than 5
   This triggers the 'No reliable data' error (threshold: 5 sources)

   Root cause: Not enough related content in ai_corpus
   ACTION: Ingest more data into ai_corpus:
     1. Metrics: npm run jobs:ingest-metrics-to-corpus
     2. Predictions: npm run jobs:ingest-predictions-to-corpus
     3. Risks: npm run jobs:ingest-risks-to-corpus
     4. Docs: npm run jobs:ingest-docs-to-corpus

   ALTERNATIVE: Lower the threshold in route.ts (line 184)
     Change: const insufficientContext = rankedSources.length < 5;
     To:     const insufficientContext = rankedSources.length < 1;
```

### 4. Updated package.json Scripts

**Added:**
```json
{
  "scripts": {
    "jobs:diagnose-keyword-search": "tsx jobs/diagnose-keyword-search.ts"
  }
}
```

## Impact Analysis

### Before Fix

| Scenario | Sources Found | Behavior |
|----------|---------------|----------|
| No data | 0 | ❌ "No reliable data" |
| Minimal data | 1-4 | ❌ "No reliable data" (FALSE NEGATIVE) |
| Sufficient data | 5+ | ✅ Returns results |

### After Fix

| Scenario | Sources Found | Behavior |
|----------|---------------|----------|
| No data | 0 | ❌ "No reliable data" |
| Minimal data | 1-4 | ✅ Returns results (with warning logged) |
| Sufficient data | 5+ | ✅ Returns results |

## Testing

### Manual Testing Steps

1. **Test with keyword that has limited corpus data:**
   ```bash
   npm run jobs:diagnose-keyword-search "your keyword"
   ```

2. **Expected behavior:**
   - If 0 sources: Still returns "No reliable data" ✅
   - If 1-4 sources: NOW returns data ✅ (was broken before)
   - If 5+ sources: Returns data as before ✅

3. **Check logs for observability:**
   ```bash
   # Look for "rag_limited_context" or "lexybrain_limited_context" logs
   grep "limited_context" logs/app.log
   ```

### Automated Testing

**Test case 1: Zero sources**
```typescript
// Should still return "No reliable data"
const result = await ragEndpoint({ query: "nonexistent keyword" });
expect(result.answer).toBe("No reliable data for this query in LexyHub at the moment.");
```

**Test case 2: One source (NEW - should work now)**
```typescript
// Should return data (was broken before)
const result = await ragEndpoint({ query: "keyword with 1 source" });
expect(result.answer).not.toBe("No reliable data for this query in LexyHub at the moment.");
expect(result.sources.length).toBe(1);
```

**Test case 3: Five+ sources**
```typescript
// Should work as before
const result = await ragEndpoint({ query: "popular keyword" });
expect(result.sources.length).toBeGreaterThanOrEqual(5);
```

## Monitoring & Observability

### New Log Events

1. **`rag_limited_context`** (WARN)
   - Triggered when 1-4 sources found
   - Includes: `user_id`, `thread_id`, `sources_count`
   - Action: Consider enriching corpus for these queries

2. **`lexybrain_limited_context`** (WARN)
   - Triggered when orchestrator has < 5 corpus chunks
   - Includes: `capability`, `user_id`, `keyword_ids`, `corpus_count`
   - Action: Run corpus ingestion jobs

### Queries for Monitoring

**Find keywords with limited context:**
```sql
-- Keywords that trigger limited context warnings
SELECT
  k.term,
  k.market,
  COUNT(c.id) as corpus_count
FROM keywords k
LEFT JOIN ai_corpus c ON c.source_ref->>'keyword_id' = k.id::text
WHERE c.is_active = true
GROUP BY k.id, k.term, k.market
HAVING COUNT(c.id) BETWEEN 1 AND 4
ORDER BY corpus_count ASC;
```

**Find keywords with no corpus data:**
```sql
-- Keywords that would trigger "No reliable data"
SELECT
  k.id,
  k.term,
  k.market,
  k.created_at
FROM keywords k
LEFT JOIN ai_corpus c ON c.source_ref->>'keyword_id' = k.id::text AND c.is_active = true
WHERE c.id IS NULL
ORDER BY k.created_at DESC
LIMIT 100;
```

## Recommendations

### Immediate Actions

1. ✅ **Deploy the fix** - Already implemented
2. ⏳ **Run diagnostic** on reported keywords to verify fix
3. ⏳ **Monitor logs** for `limited_context` warnings

### Short-term (This Week)

1. **Enrich corpus for limited-context keywords**
   ```bash
   # Run all ingestion jobs
   npm run jobs:ingest-metrics-to-corpus
   npm run jobs:ingest-predictions-to-corpus
   npm run jobs:ingest-risks-to-corpus
   npm run jobs:ingest-docs-to-corpus
   ```

2. **Set up alerting** for high frequency of limited context warnings

3. **Create dashboard** showing:
   - Keywords by corpus count (0, 1-4, 5-10, 10+)
   - Trend of "No reliable data" errors over time
   - Success rate of keyword searches

### Long-term (This Month)

1. **Implement automatic corpus enrichment**
   - When a keyword is searched, trigger background corpus ingestion
   - Proactively enrich popular keywords

2. **Add corpus health check**
   - Run nightly job to identify keywords with < 5 corpus sources
   - Automatically trigger ingestion for these keywords

3. **Improve ingestion coverage**
   - Ensure all keywords have at least:
     - 1x metrics data
     - 1x prediction data
     - 1x risk data
     - 2x related docs
   - Target: Every keyword should have 5+ sources

4. **Consider dynamic thresholds**
   - Adjust threshold based on keyword age
   - New keywords: threshold = 1
   - Mature keywords (>30 days): threshold = 5

## Related Issues

### Previously Fixed Issues

1. **DataForSEO Metrics Pipeline** (2025-11-11)
   - Fixed metrics not being populated from DataForSEO API data
   - Related: `docs/internal/DATAFORSEO_METRICS_CORPUS_FIX_2025_11_11.md`

2. **AI Corpus Embedding Fix** (2025-11-10)
   - Fixed embedding serialization issue
   - Related: `docs/internal/AI_CORPUS_EMBEDDING_FIX_2025_11_10.md`

3. **Corpus Empty Hard-Stop** (2025-11-10)
   - Implemented hard-stop to prevent hallucination
   - Related: `supabase/migrations/0052_hard_stop_empty_corpus.sql`

## Files Modified

- `src/app/api/lexybrain/rag/route.ts` (lines 184-255)
- `src/lib/lexybrain/orchestrator.ts` (lines 616-643)
- `jobs/diagnose-keyword-search.ts` (NEW)
- `package.json` (line 24)
- `docs/internal/KEYWORD_SEARCH_FIX_2025_11_11.md` (NEW - this file)

## References

### Documentation
- [LexyBrain RAG Audit 2025](./LEXYBRAIN_RAG_AUDIT_2025.md)
- [AI Corpus Quick Reference](./AI_CORPUS_QUICK_REFERENCE.md)
- [DataForSEO Metrics Fix](./DATAFORSEO_METRICS_CORPUS_FIX_2025_11_11.md)

### Code
- RAG endpoint: `src/app/api/lexybrain/rag/route.ts`
- Orchestrator: `src/lib/lexybrain/orchestrator.ts`
- Retrieval: `src/lib/rag/retrieval.ts`
- RRF search: `supabase/migrations/0045_lexybrain_unified_engine.sql`

## Deployment Checklist

- [x] Code changes implemented
- [x] Diagnostic script created
- [x] Documentation updated
- [ ] Unit tests updated (if applicable)
- [ ] Integration tests passing
- [ ] Code review completed
- [ ] Deployed to staging
- [ ] Tested in staging
- [ ] Deployed to production
- [ ] Monitoring enabled
- [ ] Announced to team

## Approval & Sign-off

**Issue ID:** Keyword search returns "No reliable data" despite data existing
**Fixed by:** Claude Code
**Date:** 2025-11-11
**Status:** ✅ Fix complete, ready for review and testing

---

**END OF DOCUMENT**
