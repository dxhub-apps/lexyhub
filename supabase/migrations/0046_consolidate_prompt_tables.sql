-- =====================================================
-- Migration: Consolidate Prompt Tables
-- Date: 2025-11-09
-- Purpose: Migrate lexybrain_prompt_configs to ai_prompts
-- =====================================================

-- =====================================================
-- 1. Migrate existing prompts from lexybrain_prompt_configs to ai_prompts
-- =====================================================

-- Insert prompts that don't already exist in ai_prompts
-- Map type to key with _v1 suffix for versioning
INSERT INTO public.ai_prompts (key, type, content, config, is_active, updated_at)
SELECT
  -- Generate key from type (e.g., 'market_brief' -> 'market_brief_v1')
  CASE
    WHEN lpc.type = 'global' THEN 'lexybrain_global_v1'
    ELSE lpc.type || '_v1'
  END as key,
  'capability' as type,
  lpc.system_instructions as content,
  jsonb_build_object(
    'constraints', lpc.constraints,
    'output_type', lpc.type,
    'migrated_from', 'lexybrain_prompt_configs',
    'original_name', lpc.name
  ) as config,
  lpc.is_active,
  lpc.updated_at
FROM public.lexybrain_prompt_configs lpc
WHERE NOT EXISTS (
  -- Only insert if key doesn't already exist
  SELECT 1 FROM public.ai_prompts ap
  WHERE ap.key = CASE
    WHEN lpc.type = 'global' THEN 'lexybrain_global_v1'
    ELSE lpc.type || '_v1'
  END
)
ON CONFLICT (key) WHERE is_active = true DO NOTHING;

-- =====================================================
-- 2. Add missing prompt keys for new capabilities
-- =====================================================

-- Add ask_anything_v1 if missing (used by RAG endpoint)
INSERT INTO public.ai_prompts (key, type, content, config, is_active)
SELECT
  'ask_anything_v1',
  'capability',
  'Answer user questions using retrieved context from LexyHub. Provide accurate, data-driven responses based on keywords, metrics, and corpus data. Cite sources when referencing specific information. If context is insufficient, clearly state what information is missing.',
  '{"constraints":{"max_length":2048},"output_type":"market_brief","migrated_from":"rag_system"}'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_prompts WHERE key = 'ask_anything_v1'
);

-- Add intent_classification_v1
INSERT INTO public.ai_prompts (key, type, content, config, is_active)
SELECT
  'intent_classification_v1',
  'capability',
  'Classify the search intent and purchase stage of a keyword. Analyze the term, marketplace context, and source to determine: intent (discovery, research, education, purchase, wholesale), purchase stage (awareness, consideration, purchase), persona type, and confidence score. Return structured JSON.',
  '{"constraints":{},"output_type":"market_brief"}'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_prompts WHERE key = 'intent_classification_v1'
);

-- Add cluster_labeling_v1
INSERT INTO public.ai_prompts (key, type, content, config, is_active)
SELECT
  'cluster_labeling_v1',
  'capability',
  'Generate a concise label and description for a cluster of related keywords. Analyze the keyword terms, their metrics, and common themes to create a descriptive label (2-4 words) and detailed description (1-2 sentences) that captures the cluster''s semantic meaning and commercial relevance.',
  '{"constraints":{"max_label_length":50,"max_description_length":200},"output_type":"market_brief"}'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_prompts WHERE key = 'cluster_labeling_v1'
);

-- =====================================================
-- 3. Create archive table for lexybrain_prompt_configs
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lexybrain_prompt_configs_archive (
  LIKE public.lexybrain_prompt_configs INCLUDING ALL
);

-- Copy all data to archive
INSERT INTO public.lexybrain_prompt_configs_archive
SELECT * FROM public.lexybrain_prompt_configs
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. Drop lexybrain_prompt_configs (superseded by ai_prompts)
-- =====================================================

-- Drop constraints and indexes first
DROP TRIGGER IF EXISTS lexybrain_prompt_configs_updated_at_trigger ON public.lexybrain_prompt_configs;
DROP FUNCTION IF EXISTS update_lexybrain_prompt_configs_updated_at();
DROP INDEX IF EXISTS lexybrain_prompt_configs_active_type_idx;
DROP INDEX IF EXISTS lexybrain_prompt_configs_type_active_idx;

-- Drop the table
DROP TABLE IF EXISTS public.lexybrain_prompt_configs;

-- =====================================================
-- 5. Add helpful comments
-- =====================================================

COMMENT ON TABLE public.ai_prompts IS
'Unified prompt management for all LexyBrain capabilities. Replaced lexybrain_prompt_configs (archived in lexybrain_prompt_configs_archive).';

COMMENT ON TABLE public.lexybrain_prompt_configs_archive IS
'Archive of legacy lexybrain_prompt_configs table. Data migrated to ai_prompts in migration 0046.';

COMMENT ON COLUMN public.ai_prompts.key IS
'Unique prompt identifier with version suffix (e.g., market_brief_v1, ask_anything_v1)';

COMMENT ON COLUMN public.ai_prompts.type IS
'Prompt category: system (global instructions), capability (feature-specific), template (reusable)';

COMMENT ON COLUMN public.ai_prompts.config IS
'JSON configuration including constraints, output_type, and capability-specific settings';
