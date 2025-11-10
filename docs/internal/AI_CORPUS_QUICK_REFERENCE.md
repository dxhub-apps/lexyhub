# AI Corpus Quick Reference Guide

## 🎯 Quick Facts

- **Table:** `public.ai_corpus`
- **Vector Column:** `embedding vector(384)`
- **Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimension:** 384 (fixed)
- **Index:** IVFFlat (vector_cosine_ops)
- **RPC Function:** `ai_corpus_rrf_search()` (Reciprocal Rank Fusion)

---

## 🚀 Quick Start

### 1. Test Embedding System
```bash
node --loader ts-node/esm jobs/test-corpus-embedding.ts
```

### 2. Populate Corpus (Run All Jobs)
```bash
# Metrics
BATCH_SIZE=50 LOOKBACK_DAYS=7 node --loader ts-node/esm jobs/ingest-metrics-to-corpus.ts

# Predictions
BATCH_SIZE=50 LOOKBACK_DAYS=30 node --loader ts-node/esm jobs/ingest-predictions-to-corpus.ts

# Risks
BATCH_SIZE=100 LOOKBACK_DAYS=30 node --loader ts-node/esm jobs/ingest-risks-to-corpus.ts

# Documentation
node --loader ts-node/esm jobs/ingest-docs-to-corpus.ts
```

### 3. Verify Population
```sql
-- Check total count
SELECT COUNT(*) FROM ai_corpus;

-- Check by source type
SELECT source_type, COUNT(*) FROM ai_corpus GROUP BY source_type;

-- Sample records
SELECT id, source_type, LEFT(chunk, 80) as preview FROM ai_corpus LIMIT 5;
```

---

## 📊 Source Types

| Source Type | Description | Origin |
|-------------|-------------|--------|
| `keyword_metrics` | Keyword performance metrics | `ingest-metrics-to-corpus.ts` |
| `keyword_prediction` | Forecast data | `ingest-predictions-to-corpus.ts` |
| `risk_rule` | Risk rule definitions | `ingest-risks-to-corpus.ts` |
| `risk_event` | Risk alert events | `ingest-risks-to-corpus.ts` |
| `doc` | Documentation chunks | `ingest-docs-to-corpus.ts` |
| `keyword_summary` | User-searched keywords | `user-driven-ingestion.ts` |

---

## 🔧 Common Operations

### Check Corpus Health
```sql
-- Total records
SELECT COUNT(*) as total FROM ai_corpus;

-- By source type
SELECT source_type, COUNT(*) as count
FROM ai_corpus
GROUP BY source_type
ORDER BY count DESC;

-- By owner scope
SELECT owner_scope, COUNT(*) as count
FROM ai_corpus
GROUP BY owner_scope;

-- Recent activity (last 24h)
SELECT source_type, COUNT(*) as count
FROM ai_corpus
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type;
```

### Test Vector Search
```sql
-- Test RRF search (requires a query embedding)
SELECT
  id,
  source_type,
  LEFT(chunk, 100) as preview,
  combined_score
FROM ai_corpus_rrf_search(
  p_query := 'handmade leather wallet',
  p_query_embedding := NULL,  -- Will use lexical only if NULL
  p_capability := 'test',
  p_marketplace := 'etsy',
  p_language := NULL,
  p_limit := 10
);
```

### Clear Corpus (Careful!)
```sql
-- Delete all records
TRUNCATE ai_corpus;

-- Delete by source type
DELETE FROM ai_corpus WHERE source_type = 'test';

-- Delete old records
DELETE FROM ai_corpus WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 🐛 Troubleshooting

### Issue: "expected 384 dimensions, not X"

**Cause:** Embedding has wrong dimension

**Fix:**
1. Check `createSemanticEmbedding()` returns 384-length array
2. Ensure no `JSON.stringify()` wrapping
3. Validate before insert:
   ```typescript
   if (embedding.length !== 384) {
     throw new Error(`Invalid dimension: ${embedding.length}`);
   }
   ```

### Issue: "No records in ai_corpus"

**Cause:** Ingestion jobs not run or failed

**Fix:**
1. Check job logs for errors
2. Verify env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`
3. Run test script: `node --loader ts-node/esm jobs/test-corpus-embedding.ts`
4. Run ingestion jobs manually

### Issue: "RAG returns no results"

**Cause:** Query embedding mismatch or empty corpus

**Fix:**
1. Ensure corpus is populated: `SELECT COUNT(*) FROM ai_corpus`
2. Check RAG uses `createSemanticEmbedding()` not `createDeterministicEmbedding()`
3. Test RRF function directly (see SQL above)
4. Check RLS policies (use service role key)

### Issue: "HuggingFace API errors"

**Cause:** Invalid/missing HF_TOKEN or rate limits

**Fix:**
1. Check `HF_TOKEN` env var is set
2. Use fallback: `createSemanticEmbedding(text, { fallbackToDeterministic: true })`
3. Rate limit: Add delays between batch calls
4. Check HuggingFace API status

---

## 📝 Code Patterns

### ✅ Correct Embedding Insertion
```typescript
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";

const embedding = await createSemanticEmbedding(text, {
  fallbackToDeterministic: true,
});

// Validate
if (embedding.length !== 384) {
  throw new Error(`Invalid dimension: ${embedding.length}`);
}

// Insert
await supabase.from("ai_corpus").insert({
  embedding: embedding,  // ✅ Pass array directly
  // ... other fields
});
```

### ❌ Wrong Patterns (DO NOT USE)
```typescript
// ❌ Don't stringify
embedding: JSON.stringify(embedding)

// ❌ Don't use deterministic for corpus
import { createDeterministicEmbedding } from "@/lib/ai/embeddings";
const embedding = createDeterministicEmbedding(text, 384);

// ❌ Don't skip validation
const embedding = await createSemanticEmbedding(text);
// ... directly insert without checking dimension
```

---

## 🔐 Environment Variables

### Required
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HF_TOKEN=hf_your_token_here
```

### Optional (Job Control)
```bash
BATCH_SIZE=50              # Records per job run
LOOKBACK_DAYS=7            # Days to look back for data
CHUNK_SIZE=500             # Tokens per doc chunk
OVERLAP=50                 # Token overlap for docs
DOCS_DIR=./docs            # Documentation directory
```

---

## 📈 Performance Tips

### Batch Processing
```typescript
// Good: Process in batches with delays
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await processBatch(batch);

  // Small delay to avoid rate limits
  if (i + BATCH_SIZE < items.length) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Parallel Ingestion
```bash
# Run multiple jobs in parallel (different terminals)
node --loader ts-node/esm jobs/ingest-metrics-to-corpus.ts &
node --loader ts-node/esm jobs/ingest-predictions-to-corpus.ts &
node --loader ts-node/esm jobs/ingest-risks-to-corpus.ts &
wait
```

### Index Maintenance
```sql
-- Analyze table for query planner
ANALYZE ai_corpus;

-- Reindex if needed (after large bulk insert)
REINDEX INDEX ai_corpus_embedding_idx;

-- Vacuum to reclaim space
VACUUM ANALYZE ai_corpus;
```

---

## 🎓 Key Concepts

### Reciprocal Rank Fusion (RRF)

Combines lexical (tsvector) and vector (embedding) search:

```
RRF Score = (1 / (k + lexical_rank)) + (1 / (k + vector_rank))
```

- `k = 60` (default)
- Higher score = better match
- Balances keyword matching with semantic similarity

### Owner Scopes

| Scope | Description | Visibility |
|-------|-------------|------------|
| `global` | Public/shared data | All users |
| `team` | Team-specific data | Team members only |
| `user` | User-specific data | Owner only |

### Embedding Fallback Strategy

1. Try HuggingFace API (semantic)
2. If 503 or network error → Deterministic (SHA256)
3. If no HF_TOKEN → Deterministic
4. Log warning when fallback used

---

## 📚 Related Documentation

- [Full Fix Documentation](./AI_CORPUS_EMBEDDING_FIX_2025_11_10.md)
- [LexyBrain RAG Audit](./LEXYBRAIN_RAG_AUDIT_2025.md)
- [LexyBrain Unified Engine](./LEXYBRAIN_UNIFIED_ENGINE.md)

---

## 🆘 Support

For issues or questions:
1. Check [Full Documentation](./AI_CORPUS_EMBEDDING_FIX_2025_11_10.md)
2. Review job logs for errors
3. Run test script to diagnose
4. Check database health queries above

---

**Last Updated:** 2025-11-10
