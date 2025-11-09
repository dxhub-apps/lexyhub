
-- Ensure vector extension exists for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 0. Team workspace scaffolding (required for team scoped RLS)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_idx
  ON public.team_members(user_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select_policy ON public.teams;
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = public.teams.id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = public.team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- =====================================================
-- 1. Prompt Configuration Store (ai_prompts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  type text NOT NULL CHECK (type IN ('system', 'capability', 'template')),
  content text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompts_key_active_idx
  ON public.ai_prompts(key)
  WHERE is_active = true;

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_prompts_select_policy ON public.ai_prompts;
CREATE POLICY ai_prompts_select_policy ON public.ai_prompts
  FOR SELECT
  USING (true);

-- =====================================================
-- 1a. Team collaboration tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select_members ON public.teams;
CREATE POLICY teams_select_members ON public.teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = id
        AND tm.user_id = auth.uid()
        AND tm.is_active = true
    )
  );

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_idx
  ON public.team_members(user_id)
  WHERE is_active = true;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_members_select_self ON public.team_members;
CREATE POLICY team_members_select_self ON public.team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- Seed core prompts if missing
-- =====================================================
INSERT INTO public.ai_prompts (key, type, content, config, is_active)
SELECT s.key, s.type, s.content, s.config, s.is_active
FROM (
  VALUES
    (
      'lexybrain_system',
      'system',
      'You are LexyBrain, the single intelligence layer for LexyHub. Use only provided deterministic metrics, retrieved corpus facts, and approved policies. If the context is insufficient, respond with "No reliable data" and explain which inputs are missing. Never fabricate metrics, listings, or external data.',
      '{"capabilities":["keyword_insights","market_brief","competitor_intel","alert_explanation","recommendations","compliance_check","support_docs","ask_anything"]}'::jsonb,
      true
    ),
    (
      'keyword_insights_v1',
      'capability',
      'Generate keyword insights by combining deterministic marketplace metrics with verified corpus context. Prioritise numeric evidence, highlight demand, competition, momentum, and risk signals. If data gaps exist, flag them explicitly. Output must respect the market_brief schema.',
      '{"constraints":{"max_opportunities":6,"max_risks":4,"max_actions":6},"output_type":"market_brief"}'::jsonb,
      true
    ),
    (
      'market_brief_v1',
      'capability',
      'Produce a market brief grounded in supplied keyword metrics, predictions, and risk signals. Summaries must reference concrete numbers and cite retrieved corpus IDs.',
      '{"constraints":{"max_opportunities":6,"max_risks":4,"max_actions":6},"output_type":"market_brief"}'::jsonb,
      true
    ),
    (
      'competitor_intel_v1',
      'capability',
      'Analyse competitor trends using deterministic share-of-voice metrics and retrieved corpus facts. Focus on differentiators, emerging threats, and actionable follow-ups. Output uses the radar schema.',
      '{"constraints":{"max_items":8},"output_type":"radar"}'::jsonb,
      true
    ),
    (
      'alert_explanation_v1',
      'capability',
      'Explain alert conditions using risk rules, recent events, and approved corpus guidance. Provide mitigation steps and confidence. Output uses the risk schema.',
      '{"constraints":{"max_alerts":6},"output_type":"risk"}'::jsonb,
      true
    ),
    (
      'ask_anything_v1',
      'capability',
      'Answer grounded questions by mapping them onto the closest supported capability. Always base reasoning on deterministic metrics and retrieved corpus snippets. If nothing relevant is found, respond with "No reliable data".',
      '{"constraints":{},"output_type":"market_brief"}'::jsonb,
      true
    )
) AS s(key, type, content, config, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_prompts p WHERE p.key = s.key
);

-- =====================================================
-- 2. Unified ai_corpus table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_corpus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_scope text NOT NULL CHECK (owner_scope IN ('global', 'team', 'user')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketplace text,
  language text,
  chunk text NOT NULL,
  embedding vector(384),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  chunk_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(chunk, ''))
  ) STORED,
  CONSTRAINT ai_corpus_team_scope_ck CHECK (
    owner_scope <> 'team' OR owner_team_id IS NOT NULL
  ),
  CONSTRAINT ai_corpus_user_scope_ck CHECK (
    owner_scope <> 'user' OR owner_user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ai_corpus_scope_idx ON public.ai_corpus(owner_scope);
CREATE INDEX IF NOT EXISTS ai_corpus_owner_team_idx ON public.ai_corpus(owner_team_id);
CREATE INDEX IF NOT EXISTS ai_corpus_marketplace_idx ON public.ai_corpus(marketplace);
CREATE INDEX IF NOT EXISTS ai_corpus_created_idx ON public.ai_corpus(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_corpus_chunk_tsv_idx ON public.ai_corpus USING GIN (chunk_tsv);
CREATE INDEX IF NOT EXISTS ai_corpus_team_idx ON public.ai_corpus(owner_team_id);

ALTER TABLE public.ai_corpus
  ADD COLUMN IF NOT EXISTS owner_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_corpus_team_scope_ck'
      AND conrelid = 'public.ai_corpus'::regclass
  ) THEN
    ALTER TABLE public.ai_corpus
      ADD CONSTRAINT ai_corpus_team_scope_ck
      CHECK (
        owner_scope <> 'team'
        OR owner_team_id IS NOT NULL
      );
  END IF;
END $$;

-- IVFFlat index for vector search (requires ANALYZE after population)
CREATE INDEX IF NOT EXISTS ai_corpus_embedding_idx
  ON public.ai_corpus USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.ai_corpus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_corpus_select_policy ON public.ai_corpus;
CREATE POLICY ai_corpus_select_policy ON public.ai_corpus
  FOR SELECT
  USING (
    owner_scope = 'global'
    OR (owner_scope = 'user' AND owner_user_id = auth.uid())
    OR (
      owner_scope = 'team'
      AND owner_team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = owner_team_id
          AND tm.user_id = auth.uid()
          AND tm.is_active = true
      )
    )
  );

-- =====================================================
-- 2a. Reciprocal Rank Fusion retrieval helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.ai_corpus_rrf_search(
  p_query text,
  p_query_embedding vector(384),
  p_capability text,
  p_marketplace text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_team_id uuid DEFAULT NULL,
  p_limit int DEFAULT 12,
  p_rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  owner_scope text,
  owner_user_id uuid,
  owner_team_id uuid,
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
    c.owner_team_id,
    c.source_type,
    c.source_ref,
    c.marketplace,
    c.language,
    c.chunk,
    c.metadata,
    ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.chunk_tsv, websearch_to_tsquery('english', p_query)) DESC, c.created_at DESC) AS lexical_rank
  FROM public.ai_corpus c
  WHERE c.is_active = true
    AND (p_marketplace IS NULL OR c.marketplace = p_marketplace)
    AND (p_language IS NULL OR c.language = p_language)
    AND (p_team_id IS NULL OR c.owner_team_id = p_team_id)
    AND (COALESCE(trim(p_query), '') = '' OR c.chunk_tsv @@ websearch_to_tsquery('english', p_query))
),
vector AS (
  SELECT
    c.id,
    c.owner_scope,
    c.owner_user_id,
    c.owner_team_id,
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
    AND (p_marketplace IS NULL OR c.marketplace = p_marketplace)
    AND (p_language IS NULL OR c.language = p_language)
    AND (p_team_id IS NULL OR c.owner_team_id = p_team_id)
),
merged AS (
  SELECT
    COALESCE(l.id, v.id) AS id,
    COALESCE(l.owner_scope, v.owner_scope) AS owner_scope,
    COALESCE(l.owner_user_id, v.owner_user_id) AS owner_user_id,
    COALESCE(l.owner_team_id, v.owner_team_id) AS owner_team_id,
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
  m.owner_team_id,
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

-- =====================================================
-- 3. Deterministic analytics layer tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.keyword_metrics_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  source text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (keyword_id, week_start, COALESCE(source, 'default'))
);

CREATE INDEX IF NOT EXISTS keyword_metrics_weekly_keyword_idx
  ON public.keyword_metrics_weekly(keyword_id, week_start DESC);

CREATE TABLE IF NOT EXISTS public.keyword_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  marketplace text,
  horizon text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keyword_predictions_keyword_idx
  ON public.keyword_predictions(keyword_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.risk_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code text NOT NULL,
  description text NOT NULL,
  marketplace text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS risk_rules_code_idx
  ON public.risk_rules(rule_code);

CREATE TABLE IF NOT EXISTS public.risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid REFERENCES public.keywords(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.risk_rules(id) ON DELETE SET NULL,
  marketplace text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'team', 'user'))
);

CREATE INDEX IF NOT EXISTS risk_events_keyword_idx
  ON public.risk_events(keyword_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_activity_user_idx
  ON public.user_activity(user_id, occurred_at DESC);

-- =====================================================
-- 4. Keyword insight snapshots
-- =====================================================
CREATE TABLE IF NOT EXISTS public.keyword_insight_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  capability text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'team', 'user')),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  metrics_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  insight jsonb NOT NULL,
  references jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT keyword_insight_snapshots_team_scope_ck CHECK (
    scope <> 'team' OR team_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS keyword_insight_snapshots_keyword_idx
  ON public.keyword_insight_snapshots(keyword_id, created_at DESC);
CREATE INDEX IF NOT EXISTS keyword_insight_snapshots_capability_idx
  ON public.keyword_insight_snapshots(capability, created_at DESC);
CREATE INDEX IF NOT EXISTS keyword_insight_snapshots_team_idx
  ON public.keyword_insight_snapshots(team_id)
  WHERE team_id IS NOT NULL;

ALTER TABLE public.keyword_insight_snapshots
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'keyword_insight_snapshots_team_scope_ck'
      AND conrelid = 'public.keyword_insight_snapshots'::regclass
  ) THEN
    ALTER TABLE public.keyword_insight_snapshots
      ADD CONSTRAINT keyword_insight_snapshots_team_scope_ck
      CHECK (
        scope <> 'team'
        OR team_id IS NOT NULL
      );
  END IF;
END $$;

ALTER TABLE public.keyword_insight_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS keyword_insight_snapshots_select_policy ON public.keyword_insight_snapshots;
CREATE POLICY keyword_insight_snapshots_select_policy ON public.keyword_insight_snapshots
  FOR SELECT
  USING (
    scope = 'global'
    OR (scope = 'user' AND created_by = auth.uid())
    OR (
      scope = 'team'
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.team_members tm
        WHERE tm.team_id = team_id
          AND tm.user_id = auth.uid()
          AND tm.is_active = true
      )
    )
  );

-- =====================================================
-- End of migration
-- =====================================================
