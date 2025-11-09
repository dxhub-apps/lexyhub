-- =====================================================
-- Migration: Drop Unused Database Objects
-- Date: 2025-11-09
-- Purpose: Remove dead tables, functions, and indexes
-- =====================================================

-- =====================================================
-- 1. Drop unused RPC functions
-- =====================================================

-- Function replaced by ai_corpus_rrf_search
DROP FUNCTION IF EXISTS search_keywords_by_embedding(vector, integer);
DROP FUNCTION IF EXISTS search_keywords_by_embedding(vector(384), integer);

-- Function never called in codebase
DROP FUNCTION IF EXISTS similar_keywords(uuid, integer);

-- Function created but no scheduled job exists
DROP FUNCTION IF EXISTS cleanup_expired_ai_insights();

-- =====================================================
-- 2. Create archive tables for unused data
-- =====================================================

-- Archive keyword_embeddings (replaced by ai_corpus)
CREATE TABLE IF NOT EXISTS public.keyword_embeddings_archive (
  keyword_id uuid,
  embedding vector(384),
  model_name text,
  updated_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

-- Copy data to archive
INSERT INTO public.keyword_embeddings_archive (keyword_id, embedding, model_name, updated_at)
SELECT keyword_id, embedding, model_name, updated_at
FROM public.keyword_embeddings
ON CONFLICT DO NOTHING;

-- Archive user_activity (never referenced)
CREATE TABLE IF NOT EXISTS public.user_activity_archive (
  LIKE public.user_activity INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

-- Copy data to archive
INSERT INTO public.user_activity_archive
SELECT *, now() FROM public.user_activity
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. Drop unused tables
-- =====================================================

-- Drop keyword_embeddings (replaced by ai_corpus)
DROP TABLE IF EXISTS public.keyword_embeddings CASCADE;

-- Drop user_activity (never referenced in codebase)
DROP TABLE IF EXISTS public.user_activity CASCADE;

-- Drop api_usage_tracking (created but never queried)
DROP TABLE IF EXISTS public.api_usage_tracking CASCADE;

-- Drop rag_feedback (created but not used)
-- NOTE: Keeping this for now as it may be used in future
-- DROP TABLE IF EXISTS public.rag_feedback CASCADE;

-- =====================================================
-- 4. Drop unused indexes
-- =====================================================

-- These indexes were associated with dropped tables
-- Dropped automatically with CASCADE above

-- =====================================================
-- 5. Add comments
-- =====================================================

COMMENT ON TABLE public.keyword_embeddings_archive IS
'Archive of keyword_embeddings table. Replaced by ai_corpus table in unified LexyBrain engine.';

COMMENT ON TABLE public.user_activity_archive IS
'Archive of user_activity table. Was never referenced in codebase.';

-- =====================================================
-- 6. Verify cleanup
-- =====================================================

-- This query can be run manually to verify the cleanup:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%_archive';
