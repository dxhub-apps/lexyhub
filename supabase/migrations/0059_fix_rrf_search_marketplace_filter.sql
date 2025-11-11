-- Fix ai_corpus_rrf_search to include NULL marketplace records in all searches
-- Issue: When searching for a specific marketplace (e.g., 'etsy'),
-- corpus records with NULL marketplace (global content) were being excluded

CREATE OR REPLACE FUNCTION public.ai_corpus_rrf_search(
  p_query text,
  p_query_embedding vector(384),
  p_capability text,
  p_marketplace text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_limit int DEFAULT 12,
  p_rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  owner_scope text,
  owner_user_id uuid,
  source_type text,
  source_ref jsonb,
  marketplace text,
  language text,
  chunk text,
  metadata jsonb,
  combined_score numeric,
  lexical_rank int,
  vector_rank int
)
LANGUAGE sql
AS $$
WITH lexical AS (
  SELECT
    c.id,
    c.owner_scope,
    c.owner_user_id,
    c.source_type,
    c.source_ref,
    c.marketplace,
    c.language,
    c.chunk,
    c.metadata,
    ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.chunk_tsv, websearch_to_tsquery('english', p_query)) DESC, c.created_at DESC) AS lexical_rank
  FROM public.ai_corpus c
  WHERE c.is_active = true
    AND (p_marketplace IS NULL OR c.marketplace = p_marketplace OR c.marketplace IS NULL)
    AND (p_language IS NULL OR c.language = p_language)
    AND (COALESCE(trim(p_query), '') = '' OR c.chunk_tsv @@ websearch_to_tsquery('english', p_query))
),
vector AS (
  SELECT
    c.id,
    c.owner_scope,
    c.owner_user_id,
    c.source_type,
    c.source_ref,
    c.marketplace,
    c.language,
    c.chunk,
    c.metadata,
    ROW_NUMBER() OVER (ORDER BY c.embedding <#> p_query_embedding) AS vector_rank
  FROM public.ai_corpus c
  WHERE c.is_active = true
    AND p_query_embedding IS NOT NULL
    AND (p_marketplace IS NULL OR c.marketplace = p_marketplace OR c.marketplace IS NULL)
    AND (p_language IS NULL OR c.language = p_language)
),
merged AS (
  SELECT
    COALESCE(l.id, v.id) AS id,
    COALESCE(l.owner_scope, v.owner_scope) AS owner_scope,
    COALESCE(l.owner_user_id, v.owner_user_id) AS owner_user_id,
    COALESCE(l.source_type, v.source_type) AS source_type,
    COALESCE(l.source_ref, v.source_ref) AS source_ref,
    COALESCE(l.marketplace, v.marketplace) AS marketplace,
    COALESCE(l.language, v.language) AS language,
    COALESCE(l.chunk, v.chunk) AS chunk,
    COALESCE(l.metadata, v.metadata) AS metadata,
    l.lexical_rank,
    v.vector_rank
  FROM lexical l
  FULL OUTER JOIN vector v ON l.id = v.id
)
SELECT
  m.id,
  m.owner_scope,
  m.owner_user_id,
  m.source_type,
  m.source_ref,
  m.marketplace,
  m.language,
  m.chunk,
  m.metadata,
  (COALESCE(1.0 / (p_rrf_k + m.lexical_rank), 0) + COALESCE(1.0 / (p_rrf_k + m.vector_rank), 0)) AS combined_score,
  m.lexical_rank,
  m.vector_rank
FROM merged m
ORDER BY combined_score DESC, lexical_rank NULLS LAST, vector_rank NULLS LAST
LIMIT p_limit;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.ai_corpus_rrf_search IS
  'Reciprocal Rank Fusion search for ai_corpus. ' ||
  'Includes NULL marketplace records (global content) in all searches. ' ||
  'Fixed 2025-11-11: Previously excluded NULL marketplace records when searching for specific marketplaces.';
