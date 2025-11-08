-- =====================================================
-- LexyBrain Training Data Tables
-- Migration: 0039
-- Description: Creates tables for collecting training data for future LexyBrain fine-tuning
-- =====================================================

-- Purpose:
-- These tables store structured data for supervised fine-tuning:
-- 1. lexybrain_requests: Normalized prompts and context
-- 2. lexybrain_responses: Raw model outputs for each request
-- 3. lexybrain_feedback: User feedback signals (positive/negative/neutral)

-- =====================================================
-- Table 1: LexyBrain Requests
-- =====================================================
-- Stores the input data for each LexyBrain inference request
-- This will be used to reconstruct training examples later

CREATE TABLE IF NOT EXISTS public.lexybrain_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Metadata for filtering and analysis
  insight_type TEXT NULL, -- 'market_brief', 'radar', 'ad_insight', 'risk'
  market TEXT NULL,
  niche_terms TEXT[] NULL
);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS lexybrain_requests_user_idx
  ON public.lexybrain_requests(user_id);

-- Index for timestamp-based queries (for training data extraction)
CREATE INDEX IF NOT EXISTS lexybrain_requests_requested_at_idx
  ON public.lexybrain_requests(requested_at DESC);

-- Index for filtering by insight type
CREATE INDEX IF NOT EXISTS lexybrain_requests_insight_type_idx
  ON public.lexybrain_requests(insight_type);

-- GIN index for JSONB context queries
CREATE INDEX IF NOT EXISTS lexybrain_requests_context_gin_idx
  ON public.lexybrain_requests USING gin(context_json);

-- =====================================================
-- Table 2: LexyBrain Responses
-- =====================================================
-- Stores the model output for each request
-- Links to lexybrain_requests via request_id

CREATE TABLE IF NOT EXISTS public.lexybrain_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.lexybrain_requests(id) ON DELETE CASCADE,

  -- Model information
  model_name TEXT NULL, -- e.g., 'llama-3-8b-instruct', future: custom fine-tuned models

  -- Output data
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Performance metrics
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms INTEGER NULL,
  success BOOLEAN NOT NULL DEFAULT true,

  -- Token usage (for cost tracking)
  tokens_in INTEGER NULL,
  tokens_out INTEGER NULL
);

-- Index for request-based queries
CREATE INDEX IF NOT EXISTS lexybrain_responses_request_idx
  ON public.lexybrain_responses(request_id);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS lexybrain_responses_generated_at_idx
  ON public.lexybrain_responses(generated_at DESC);

-- Index for filtering by success status
CREATE INDEX IF NOT EXISTS lexybrain_responses_success_idx
  ON public.lexybrain_responses(success);

-- GIN index for JSONB output queries
CREATE INDEX IF NOT EXISTS lexybrain_responses_output_gin_idx
  ON public.lexybrain_responses USING gin(output_json);

-- =====================================================
-- Table 3: LexyBrain Feedback
-- =====================================================
-- Stores user feedback on model responses
-- This is the supervised learning signal for fine-tuning

CREATE TABLE IF NOT EXISTS public.lexybrain_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.lexybrain_responses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Feedback type (supervised signal)
  feedback TEXT NULL CHECK (feedback IN ('positive', 'negative', 'neutral')),

  -- Optional notes for detailed feedback
  notes TEXT NULL,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for response-based queries
CREATE INDEX IF NOT EXISTS lexybrain_feedback_response_idx
  ON public.lexybrain_feedback(response_id);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS lexybrain_feedback_user_idx
  ON public.lexybrain_feedback(user_id);

-- Index for filtering by feedback type
CREATE INDEX IF NOT EXISTS lexybrain_feedback_type_idx
  ON public.lexybrain_feedback(feedback);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS lexybrain_feedback_created_at_idx
  ON public.lexybrain_feedback(created_at DESC);

-- =====================================================
-- Row-Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.lexybrain_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexybrain_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexybrain_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own requests
CREATE POLICY "Users can read their own requests"
  ON public.lexybrain_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert requests (from backend)
CREATE POLICY "Service role can insert requests"
  ON public.lexybrain_requests
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can read responses for their requests
CREATE POLICY "Users can read their responses"
  ON public.lexybrain_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lexybrain_requests
      WHERE lexybrain_requests.id = lexybrain_responses.request_id
        AND lexybrain_requests.user_id = auth.uid()
    )
  );

-- Policy: Service role can insert responses
CREATE POLICY "Service role can insert responses"
  ON public.lexybrain_responses
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can read their own feedback
CREATE POLICY "Users can read their own feedback"
  ON public.lexybrain_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
  ON public.lexybrain_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
  ON public.lexybrain_feedback
  FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- Comments (for documentation)
-- =====================================================

COMMENT ON TABLE public.lexybrain_requests IS
  'Stores LexyBrain inference requests with normalized prompts and context for future fine-tuning';

COMMENT ON TABLE public.lexybrain_responses IS
  'Stores LexyBrain model responses with performance metrics';

COMMENT ON TABLE public.lexybrain_feedback IS
  'Stores user feedback on LexyBrain responses for supervised learning signals';

COMMENT ON COLUMN public.lexybrain_requests.prompt IS
  'Full prompt sent to the model';

COMMENT ON COLUMN public.lexybrain_requests.context_json IS
  'Normalized context data (market, keywords, etc.) used to build the prompt';

COMMENT ON COLUMN public.lexybrain_responses.output_json IS
  'Raw JSON output from the model';

COMMENT ON COLUMN public.lexybrain_responses.latency_ms IS
  'Time taken to generate response in milliseconds';

COMMENT ON COLUMN public.lexybrain_feedback.feedback IS
  'User feedback: positive (thumbs up), negative (thumbs down), or neutral';

-- =====================================================
-- Helpful Views (Optional - for analytics)
-- =====================================================

-- View: Training data export
-- Combines requests, responses, and feedback for easy export
CREATE OR REPLACE VIEW public.lexybrain_training_data AS
SELECT
  req.id AS request_id,
  req.user_id,
  req.prompt,
  req.context_json,
  req.insight_type,
  req.market,
  req.niche_terms,
  req.requested_at,

  res.id AS response_id,
  res.model_name,
  res.output_json,
  res.generated_at,
  res.latency_ms,
  res.success,
  res.tokens_in,
  res.tokens_out,

  fb.feedback,
  fb.notes AS feedback_notes,
  fb.created_at AS feedback_at

FROM public.lexybrain_requests req
LEFT JOIN public.lexybrain_responses res ON req.id = res.request_id
LEFT JOIN public.lexybrain_feedback fb ON res.id = fb.response_id
ORDER BY req.requested_at DESC;

COMMENT ON VIEW public.lexybrain_training_data IS
  'Combined view of requests, responses, and feedback for training data export';

-- =====================================================
-- Analytics Functions
-- =====================================================

-- Function: Get feedback statistics
CREATE OR REPLACE FUNCTION public.get_lexybrain_feedback_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  insight_type TEXT,
  total_requests BIGINT,
  total_responses BIGINT,
  total_feedback BIGINT,
  positive_feedback BIGINT,
  negative_feedback BIGINT,
  neutral_feedback BIGINT,
  avg_latency_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    req.insight_type,
    COUNT(DISTINCT req.id) AS total_requests,
    COUNT(DISTINCT res.id) AS total_responses,
    COUNT(fb.id) AS total_feedback,
    COUNT(fb.id) FILTER (WHERE fb.feedback = 'positive') AS positive_feedback,
    COUNT(fb.id) FILTER (WHERE fb.feedback = 'negative') AS negative_feedback,
    COUNT(fb.id) FILTER (WHERE fb.feedback = 'neutral') AS neutral_feedback,
    ROUND(AVG(res.latency_ms), 2) AS avg_latency_ms
  FROM public.lexybrain_requests req
  LEFT JOIN public.lexybrain_responses res ON req.id = res.request_id
  LEFT JOIN public.lexybrain_feedback fb ON res.id = fb.response_id
  WHERE req.requested_at BETWEEN start_date AND end_date
  GROUP BY req.insight_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_lexybrain_feedback_stats IS
  'Returns feedback statistics by insight type for a given date range';
