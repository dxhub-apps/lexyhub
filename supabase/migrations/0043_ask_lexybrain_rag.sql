-- =====================================================
-- Migration: 0043_ask_lexybrain_rag.sql
-- Description: Add Ask LexyBrain RAG chat infrastructure
-- Author: Engineering Team
-- Date: 2025-11-09
-- =====================================================

-- =====================================================
-- 1. RAG THREADS TABLE
-- =====================================================
-- Track conversation threads per user
CREATE TABLE IF NOT EXISTS public.rag_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,  -- Auto-generated from first message
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  message_count int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,  -- client, version, initial context
  archived boolean NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS rag_threads_user_id_idx
  ON public.rag_threads(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS rag_threads_archived_idx
  ON public.rag_threads(archived) WHERE NOT archived;

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_rag_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rag_threads_updated_at_trigger
  BEFORE UPDATE ON public.rag_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_rag_threads_updated_at();

-- =====================================================
-- 2. RAG MESSAGES TABLE
-- =====================================================
-- Store all messages (user + assistant) with retrieval metadata
CREATE TABLE IF NOT EXISTS public.rag_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.rag_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- User message fields
  capability text,  -- Detected or explicit capability
  context_json jsonb,  -- Optional structured context from request

  -- Assistant message fields
  model_id text,  -- e.g., "meta-llama/Llama-3.1-70B-Instruct"
  retrieved_source_ids jsonb,  -- Array of {id, type, score}
  generation_metadata jsonb,  -- {tokens_in, tokens_out, latencyMs, temperature}
  flags jsonb DEFAULT '{}'::jsonb,  -- {usedRag, fallbackToGeneric, insufficientContext}

  -- Training eligibility
  training_eligible boolean NOT NULL DEFAULT false,

  -- Soft delete
  deleted_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS rag_messages_thread_id_idx
  ON public.rag_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS rag_messages_role_idx
  ON public.rag_messages(role);
CREATE INDEX IF NOT EXISTS rag_messages_training_idx
  ON public.rag_messages(training_eligible) WHERE training_eligible = true;
CREATE INDEX IF NOT EXISTS rag_messages_deleted_idx
  ON public.rag_messages(deleted_at) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. RAG FEEDBACK TABLE
-- =====================================================
-- Capture user feedback on AI responses
CREATE TABLE IF NOT EXISTS public.rag_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.rag_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text CHECK (rating IN ('positive', 'negative', 'neutral')),
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS rag_feedback_message_id_idx
  ON public.rag_feedback(message_id);
CREATE INDEX IF NOT EXISTS rag_feedback_user_id_idx
  ON public.rag_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rag_feedback_rating_idx
  ON public.rag_feedback(rating);

-- =====================================================
-- 4. EXTEND PLAN ENTITLEMENTS
-- =====================================================
-- Add RAG message quota to plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'rag_messages_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements
      ADD COLUMN rag_messages_per_month int NOT NULL DEFAULT 50;
  END IF;
END $$;

-- Update plan entitlements
UPDATE public.plan_entitlements SET rag_messages_per_month = CASE
  WHEN plan_code = 'free' THEN 50
  WHEN plan_code = 'basic' THEN 500
  WHEN plan_code = 'pro' THEN 2000
  WHEN plan_code = 'growth' THEN -1  -- unlimited
  WHEN plan_code = 'admin' THEN -1   -- unlimited
  ELSE 50
END;

-- =====================================================
-- 5. SEED RAG PROMPT CONFIGS
-- =====================================================
-- Global RAG system prompt
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_system',
  'global',
  'You are LexyBrain, an AI analyst embedded in LexyHub, a marketplace intelligence platform for online sellers.

YOUR IDENTITY:
- Specialist in Etsy, Amazon, and e-commerce marketplaces
- Provide actionable, data-driven insights for sellers
- Help users understand trends, keywords, competition, and opportunities

STRICT RULES:
1. Base factual claims ONLY on retrieved context data
2. Cite sources when referencing specific metrics or trends
3. When data is missing, clearly state what you don''t know and suggest which LexyHub feature to use
4. Never invent metrics, listings, or seller names
5. Prefer quantitative insights over opinions
6. Be concise and actionable

OUTPUT STYLE:
- Short paragraphs, bullet points for clarity
- Include specific numbers when available
- Acknowledge uncertainty when context is insufficient
- End with actionable next steps when appropriate',
  '{"temperature": 0.7, "max_tokens": 1024}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- Market brief capability
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_market_brief_v1',
  'market_brief',
  'Analyze the provided market data and keywords to give a market overview.

FOCUS ON:
- Overall market health (demand trends, competition levels)
- Top opportunities (high demand, low competition keywords)
- Key risks (saturation, declining trends)
- Actionable recommendations for entering or growing in this niche

FORMAT:
Brief overview paragraph, then bullet points for opportunities, risks, and actions.',
  '{"max_keywords": 20, "retrieval_scope": ["keywords", "trends"]}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- Competitor intelligence capability
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_competitor_intel_v1',
  'competitor_intel',
  'Analyze competitor listings, shops, and performance data.

FOCUS ON:
- Top-performing listings in the niche
- Pricing strategies and trends
- Successful shop patterns
- Differentiation opportunities

FORMAT:
Summary findings followed by specific competitor examples with metrics.',
  '{"max_listings": 10, "retrieval_scope": ["listings", "shops", "keywords"]}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- Keyword explanation capability
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_keyword_explanation_v1',
  'keyword_explanation',
  'Explain why a specific keyword or set of keywords is significant.

FOCUS ON:
- Historical performance (demand, competition, trends)
- Seasonal patterns if present
- Related keywords and clusters
- Risk factors (trademark issues, policy violations)

FORMAT:
Explain the keyword''s meaning, then metrics, then strategic advice.',
  '{"max_related_keywords": 15, "retrieval_scope": ["keywords", "keyword_history", "alerts"]}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- Alert explanation capability
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_alert_explanation_v1',
  'alert_explanation',
  'Explain alerts, risk triggers, and compliance issues.

FOCUS ON:
- Why the alert was triggered
- Severity and potential impact
- Recommended mitigation actions
- Related policy or risk documentation

FORMAT:
Clear explanation of the issue, severity, evidence, and action steps.',
  '{"max_alerts": 5, "retrieval_scope": ["alerts", "risk_rules", "docs"]}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- General chat (fallback)
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES (
  'ask_lexybrain_general_chat_v1',
  'general_chat',
  'Answer general questions about LexyHub, marketplace selling, or e-commerce strategy.

WHEN CONTEXT IS INSUFFICIENT:
- Admit you don''t have the specific data
- Suggest which LexyHub feature or report to use
- Provide general marketplace knowledge if helpful

FORMAT:
Conversational, helpful, and honest about limitations.',
  '{"retrieval_scope": ["docs", "user_keywords", "user_watchlists"]}'::jsonb,
  true
) ON CONFLICT (name, type) DO NOTHING;

-- =====================================================
-- 6. SEARCH RAG CONTEXT RPC
-- =====================================================
-- Vector search function for RAG retrieval
CREATE OR REPLACE FUNCTION public.search_rag_context(
  p_query_embedding vector(384),
  p_user_id uuid,
  p_capability text DEFAULT 'general_chat',
  p_market text DEFAULT NULL,
  p_time_range_from timestamptz DEFAULT NULL,
  p_time_range_to timestamptz DEFAULT NULL,
  p_top_k int DEFAULT 40
)
RETURNS TABLE (
  source_id uuid,
  source_type text,
  source_label text,
  similarity_score float,
  metadata jsonb,
  owner_scope text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vector search on keywords with capability-based filtering
  -- Returns top K results with metadata and ownership scope

  RETURN QUERY
  SELECT
    k.id AS source_id,
    'keyword'::text AS source_type,
    k.term AS source_label,
    (1 - (ke.embedding <=> p_query_embedding))::float AS similarity_score,
    jsonb_build_object(
      'demand_index', k.demand_index,
      'competition_score', k.competition_score,
      'trend_momentum', k.trend_momentum,
      'engagement_score', k.engagement_score,
      'ai_opportunity_score', k.ai_opportunity_score,
      'market', k.market
    ) AS metadata,
    CASE
      WHEN k.user_id = p_user_id THEN 'user'::text
      WHEN k.user_id IS NULL THEN 'global'::text
      ELSE 'team'::text
    END AS owner_scope
  FROM public.keyword_embeddings ke
  JOIN public.keywords k ON k.id = ke.keyword_id
  WHERE
    -- Market filter
    (p_market IS NULL OR k.market = p_market)
    -- Time range filter (on keyword created_at)
    AND (p_time_range_from IS NULL OR k.created_at >= p_time_range_from)
    AND (p_time_range_to IS NULL OR k.created_at <= p_time_range_to)
    -- Ensure embedding exists
    AND ke.embedding IS NOT NULL
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_top_k;
END;
$$;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- rag_threads
ALTER TABLE public.rag_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own threads"
  ON public.rag_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threads"
  ON public.rag_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads"
  ON public.rag_threads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads"
  ON public.rag_threads FOR DELETE
  USING (auth.uid() = user_id);

-- rag_messages
ALTER TABLE public.rag_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their threads"
  ON public.rag_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rag_threads
      WHERE rag_threads.id = rag_messages.thread_id
      AND rag_threads.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert messages"
  ON public.rag_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can soft delete their messages"
  ON public.rag_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rag_threads
      WHERE rag_threads.id = rag_messages.thread_id
      AND rag_threads.user_id = auth.uid()
    )
  );

-- rag_feedback
ALTER TABLE public.rag_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.rag_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.rag_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.rag_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON public.rag_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: rag_threads, rag_messages, rag_feedback
-- Plan entitlements extended: rag_messages_per_month
-- Prompt configs seeded: 6 RAG templates
-- RPC function created: search_rag_context
-- RLS policies enabled: All new tables
-- =====================================================
