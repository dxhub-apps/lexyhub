# LexyBrain RAG Endpoint Specification

**Feature**: Ask LexyBrain - RAG-Powered Chat Assistant
**Endpoint**: `POST /api/lexybrain/rag`
**Version**: 1.0
**Status**: Design & Specification
**Author**: Senior Engineering Team
**Last Updated**: 2025-11-09

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema Additions](#database-schema-additions)
4. [API Specification](#api-specification)
5. [Internal Workflow](#internal-workflow)
6. [Retrieval Strategy](#retrieval-strategy)
7. [Prompt System](#prompt-system)
8. [Hugging Face Integration](#hugging-face-integration)
9. [Authentication & Authorization](#authentication--authorization)
10. [Quota & Rate Limiting](#quota--rate-limiting)
11. [Error Handling](#error-handling)
12. [Performance & Monitoring](#performance--monitoring)
13. [Implementation Checklist](#implementation-checklist)
14. [File Structure](#file-structure)

---

## Executive Summary

### Purpose
The RAG endpoint powers "Ask LexyBrain", an interactive AI assistant that provides marketplace intelligence grounded in LexyHub's proprietary data. Unlike the existing LexyBrain Insights (which generates fixed-format reports), the RAG endpoint enables conversational interaction with context-aware responses.

### Key Capabilities
- **Multi-turn conversations** with persistent thread history
- **Vector-based retrieval** from pgvector corpus (keywords, listings, alerts, docs)
- **Capability detection** to optimize retrieval and generation strategies
- **Source attribution** with confidence scores and citations
- **Training data collection** for future fine-tuning
- **Graceful degradation** with fallback responses

### Integration Points
- **Reuses existing Hugging Face infrastructure** from LexyBrain Insights
- **Extends lexybrain_prompt_configs** table for RAG templates
- **Leverages keyword_embeddings** and vector search RPCs
- **Uses standard authentication patterns** (user session, extension, partner API)
- **Follows existing quota system** with new `rag_messages` quota key

---

## Architecture Overview

### High-Level Flow

```
User Message
    ↓
[1] Authentication & Validation
    ↓
[2] Thread & Message Persistence (user message)
    ↓
[3] Capability Detection (classify intent)
    ↓
[4] Vector Retrieval (pgvector search + context fetch)
    ↓
[5] Prompt Construction (system + context + history)
    ↓
[6] LLM Generation (Hugging Face via LEXYBRAIN_RAG_MODEL_ID)
    ↓
[7] Response Persistence (assistant message + metadata)
    ↓
[8] Training Data Collection
    ↓
Response JSON
```

### Comparison with Existing LexyBrain Insights

| Aspect | LexyBrain Insights | Ask LexyBrain (RAG) |
|--------|-------------------|---------------------|
| **Interaction** | Single request → fixed schema output | Multi-turn conversation |
| **Input** | Structured (market, niche_terms, type) | Natural language query |
| **Retrieval** | SQL-based niche_context RPC | Vector similarity + SQL joins |
| **Output** | Typed schemas (MarketBrief, Radar, etc) | Free-form text + structured metadata |
| **Caching** | Input hash → output JSON | No caching (conversational) |
| **State** | Stateless | Stateful (thread history) |
| **Model** | LEXYBRAIN_MODEL_ID | LEXYBRAIN_RAG_MODEL_ID |

---

## Database Schema Additions

### New Tables (Migration: `004X_ask_lexybrain_rag.sql`)

#### 1. `rag_threads` Table

**Purpose**: Track conversation threads per user

```sql
CREATE TABLE public.rag_threads (
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

CREATE INDEX rag_threads_user_id_idx ON public.rag_threads(user_id, last_message_at DESC);
CREATE INDEX rag_threads_archived_idx ON public.rag_threads(archived) WHERE NOT archived;

-- Auto-update trigger
CREATE TRIGGER rag_threads_updated_at_trigger
  BEFORE UPDATE ON public.rag_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### 2. `rag_messages` Table

**Purpose**: Store all messages (user + assistant) with retrieval metadata

```sql
CREATE TABLE public.rag_messages (
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

CREATE INDEX rag_messages_thread_id_idx ON public.rag_messages(thread_id, created_at ASC);
CREATE INDEX rag_messages_role_idx ON public.rag_messages(role);
CREATE INDEX rag_messages_training_idx ON public.rag_messages(training_eligible) WHERE training_eligible = true;
CREATE INDEX rag_messages_deleted_idx ON public.rag_messages(deleted_at) WHERE deleted_at IS NULL;
```

#### 3. `rag_feedback` Table

**Purpose**: Capture user feedback on AI responses

```sql
CREATE TABLE public.rag_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.rag_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text CHECK (rating IN ('positive', 'negative', 'neutral')),
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rag_feedback_message_id_idx ON public.rag_feedback(message_id);
CREATE INDEX rag_feedback_user_id_idx ON public.rag_feedback(user_id, created_at DESC);
CREATE INDEX rag_feedback_rating_idx ON public.rag_feedback(rating);
```

### Extended Tables

#### 4. `lexybrain_prompt_configs` (Add RAG Templates)

**Seed Data** for RAG capabilities:

```sql
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
);

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
);

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
);

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
);

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
);

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
);
```

#### 5. `plan_entitlements` (Add RAG Quotas)

```sql
-- Add rag_messages_per_month column
ALTER TABLE public.plan_entitlements
  ADD COLUMN IF NOT EXISTS rag_messages_per_month int NOT NULL DEFAULT 50;

-- Update plan entitlements
UPDATE public.plan_entitlements SET rag_messages_per_month = CASE
  WHEN plan_code = 'free' THEN 50
  WHEN plan_code = 'basic' THEN 500
  WHEN plan_code = 'pro' THEN 2000
  WHEN plan_code = 'growth' THEN -1  -- unlimited
  WHEN plan_code = 'admin' THEN -1   -- unlimited
  ELSE 50
END;
```

### Row-Level Security (RLS)

```sql
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

-- rag_feedback
ALTER TABLE public.rag_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.rag_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.rag_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Vector Search Enhancements

#### New RPC: `search_rag_context()`

```sql
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
  source_type text,  -- 'keyword', 'listing', 'alert', 'doc'
  source_label text,
  similarity_score float,
  metadata jsonb,
  owner_scope text   -- 'user', 'team', 'global'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Implementation will:
  -- 1. Join keyword_embeddings with keywords table
  -- 2. Filter by capability-specific criteria
  -- 3. Apply market, time_range, owner_scope filters
  -- 4. Compute cosine similarity
  -- 5. Return top K results with metadata

  -- Pseudo-implementation for specification purposes
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
    (p_market IS NULL OR k.market = p_market)
    AND ke.embedding IS NOT NULL
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_top_k;
END;
$$;
```

---

## API Specification

### Endpoint

```
POST /api/lexybrain/rag
```

### Authentication

- **Required**: Yes
- **Methods**:
  - User session (Supabase JWT via cookies) - primary
  - Extension Bearer token (`x-ext-client` header)
  - Partner API key (for programmatic access)

### Request Schema

```typescript
// TypeScript interface
interface RagRequest {
  // Thread management
  threadId?: string | null;  // Omit or null to create new thread

  // User message (required)
  message: string;  // Natural language query

  // Optional explicit capability
  capability?: 'market_brief' | 'competitor_intel' | 'keyword_explanation' |
               'alert_explanation' | 'general_chat' | null;

  // Optional structured context
  context?: {
    keywordIds?: string[];
    watchlistIds?: string[];
    listingIds?: string[];
    alertIds?: string[];
    shopUrl?: string;
    marketplaces?: string[];
    timeRange?: {
      from: string;  // ISO 8601
      to: string;
    };
  };

  // Generation options
  options?: {
    maxTokens?: number;      // Default: 1024
    temperature?: number;    // Default: 0.7
    language?: string;       // Default: 'en'
    planCode?: string;       // For admin overrides
  };

  // Client metadata
  meta?: {
    client?: 'web' | 'extension' | 'api';
    version?: string;
  };
}
```

**Validation Rules**:
- `message`: 1-4000 characters
- `capability`: Must be valid enum value
- `context.keywordIds`: Max 50 IDs
- `context.timeRange`: `from` must be before `to`
- `options.maxTokens`: 256-2048
- `options.temperature`: 0.0-1.0

### Response Schema

```typescript
interface RagResponse {
  // Thread and message IDs
  threadId: string;
  messageId: string;  // ID of the assistant message

  // Generated answer
  answer: string;

  // Capability used
  capability: string;

  // Source attribution
  sources: Array<{
    id: string;
    type: 'keyword' | 'listing' | 'alert' | 'doc';
    label: string;
    score: number;  // Similarity score 0-1
  }>;

  // Structured references (extracted entity IDs)
  references: {
    keywords: string[];
    listings: string[];
    alerts: string[];
    docs: string[];
  };

  // Model metadata
  model: {
    id: string;  // e.g., "meta-llama/Llama-3.1-70B-Instruct"
    usage: {
      inputTokens: number;
      outputTokens: number;
    } | null;
    latencyMs: number;
  };

  // Flags for client handling
  flags: {
    usedRag: boolean;              // True if retrieval was used
    fallbackToGeneric: boolean;    // True if failed and returned fallback
    insufficientContext: boolean;  // True if retrieval returned <5 results
  };
}
```

### Error Responses

```typescript
interface RagError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

**Error Codes**:
- `401` - `authentication_required`: No valid session or token
- `403` - `quota_exceeded`: User has exceeded RAG message quota
- `422` - `validation_error`: Invalid request format
- `429` - `rate_limit_exceeded`: Too many requests (60 req/min)
- `500` - `generation_failed`: LLM generation error
- `503` - `feature_disabled`: RAG feature disabled or cost cap reached

---

## Internal Workflow

### Step-by-Step Execution Flow

#### 1. **Authentication & Validation** (50-100ms)

**File**: `/src/app/api/lexybrain/rag/route.ts`

```typescript
// Authenticate user (reuse existing pattern)
const supabase = createRouteHandlerClient({ cookies });
const { data: { user }, error } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json(
    { error: { code: 'authentication_required', message: 'Please sign in' } },
    { status: 401 }
  );
}

// Parse and validate request
const parsed = RagRequestSchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(
    { error: { code: 'validation_error', message: parsed.error.message } },
    { status: 422 }
  );
}
```

**Actions**:
- Verify Supabase session or Bearer token
- Resolve user ID, team ID, plan
- Validate request schema with Zod
- Check feature flag (`LEXYBRAIN_RAG_ENABLED`)

#### 2. **Quota Enforcement** (20-50ms)

**File**: `/src/lib/lexybrain-quota.ts` (extend existing)

```typescript
// Check and consume quota
const quotaKey = 'rag_messages';
await consumeLexyBrainQuota(userId, quotaKey, 1);  // Throws if exceeded
```

**Actions**:
- Query `usage_counters` table for current month
- Compare against plan entitlement (`rag_messages_per_month`)
- Atomic increment or reject
- Log quota event

#### 3. **Thread & Message Persistence (User Message)** (30-80ms)

**File**: `/src/lib/rag/thread-manager.ts` (new)

```typescript
const thread = await ensureThread(userId, threadId);
const userMessage = await insertMessage({
  threadId: thread.id,
  role: 'user',
  content: request.message,
  capability: request.capability || null,
  contextJson: request.context || null,
});
```

**Actions**:
- If `threadId` missing → create new thread with auto-generated title
- If `threadId` provided → validate ownership and load thread
- Insert user message into `rag_messages`
- Update `rag_threads.last_message_at` and `message_count`

#### 4. **Capability Detection** (100-200ms or 0ms if explicit)

**File**: `/src/lib/rag/capability-detector.ts` (new)

**Two Modes**:

A. **Explicit Capability** (user provided in request)
```typescript
if (request.capability) {
  return request.capability;
}
```

B. **Auto-Detection** (LLM-based or heuristic)
```typescript
// Heuristic fallback (fast)
const capability = detectCapabilityHeuristic(request.message);

// Or LLM-based (more accurate, slower)
const capability = await classifyIntent(request.message);
```

**Heuristic Rules**:
```typescript
const keywords = message.toLowerCase();

if (keywords.includes('competitor') || keywords.includes('listing')) {
  return 'competitor_intel';
}
if (keywords.includes('alert') || keywords.includes('risk')) {
  return 'alert_explanation';
}
if (keywords.includes('keyword') && keywords.includes('why')) {
  return 'keyword_explanation';
}
if (keywords.includes('market') || keywords.includes('niche') || keywords.includes('brief')) {
  return 'market_brief';
}
return 'general_chat';
```

**Actions**:
- Use explicit capability if provided
- Else classify via heuristics or OpenAI intent classifier (reuse `/src/lib/lexybrain/intent.ts`)
- Update user message record with detected capability

#### 5. **Retrieval** (200-500ms)

**File**: `/src/lib/rag/retrieval.ts` (new)

**Sub-steps**:

**A. Generate Query Embedding**
```typescript
// Reuse existing embedding service
const embedding = await generateEmbedding(request.message);
```

**B. Retrieve from Vector Corpus**
```typescript
const results = await supabase.rpc('search_rag_context', {
  p_query_embedding: embedding,
  p_user_id: userId,
  p_capability: capability,
  p_market: request.context?.marketplaces?.[0] || null,
  p_time_range_from: request.context?.timeRange?.from || null,
  p_time_range_to: request.context?.timeRange?.to || null,
  p_top_k: 40,
});
```

**C. Fetch Additional Context (if structured IDs provided)**
```typescript
// If user provided keywordIds, fetch full keyword objects
if (request.context?.keywordIds?.length) {
  const { data: keywords } = await supabase
    .from('keywords')
    .select('id, term, demand_index, competition_score, trend_momentum')
    .in('id', request.context.keywordIds);

  // Merge with vector results
}
```

**D. Rerank (Optional)**
```typescript
// Simple reranking: prioritize user-owned sources
const reranked = results.sort((a, b) => {
  if (a.owner_scope === 'user' && b.owner_scope !== 'user') return -1;
  if (b.owner_scope === 'user' && a.owner_scope !== 'user') return 1;
  return b.similarity_score - a.similarity_score;
});

const topK = reranked.slice(0, 12);
```

**Actions**:
- Generate embedding for user message
- Query `search_rag_context` RPC with filters
- Optionally fetch structured context (keywords, listings, alerts)
- Rerank by relevance + ownership
- Return top 12 sources
- Set `insufficientContext` flag if <5 sources

#### 6. **Prompt Construction** (10-30ms)

**File**: `/src/lib/rag/prompt-builder.ts` (new)

```typescript
const prompt = buildRagPrompt({
  capability,
  systemPrompt: await loadSystemPrompt('ask_lexybrain_system'),
  capabilityPrompt: await loadCapabilityPrompt(capability),
  retrievedContext: topK,
  conversationHistory: await loadThreadHistory(threadId, maxMessages: 10),
  userMessage: request.message,
});
```

**Template Structure**:
```
=== SYSTEM INSTRUCTIONS ===
[System prompt from lexybrain_prompt_configs]

=== YOUR ROLE ===
[Capability-specific prompt]

=== RETRIEVED CONTEXT ===
The following data was retrieved from LexyHub's database to help answer the query:

Sources (12 total):
1. [Keyword] "vintage wedding rings" - Demand: 87, Competition: 45, Trend: +12% (Similarity: 0.92)
2. [Keyword] "handmade engagement rings" - Demand: 72, Competition: 38, Trend: +8% (Similarity: 0.89)
...

=== CONVERSATION HISTORY ===
User: [Previous message 1]
Assistant: [Previous response 1]
User: [Previous message 2]
Assistant: [Previous response 2]

=== CURRENT USER QUERY ===
[User's message]

=== INSTRUCTIONS ===
Answer the query based on the retrieved context. Cite sources when referencing specific data.
If the context is insufficient, clearly state what information is missing.
```

**Actions**:
- Load system and capability prompts from DB
- Format retrieved sources with metadata
- Load last 10 messages from thread (if multi-turn)
- Combine into final prompt
- Estimate token count

#### 7. **LLM Generation** (2000-8000ms)

**File**: `/src/lib/lexybrain/client.ts` (extend existing HuggingFaceProvider)

```typescript
const result = await lexybrainGenerate({
  modelId: process.env.LEXYBRAIN_RAG_MODEL_ID!,
  prompt,
  options: {
    maxTokens: request.options?.maxTokens || 1024,
    temperature: request.options?.temperature || 0.7,
  },
  userId,
  metadata: { feature: 'rag', capability },
});
```

**Actions**:
- Call existing `lexybrainGenerate()` with RAG model ID
- Use same Hugging Face infrastructure (retry logic, error handling)
- Track latency, tokens, cost
- Extract structured references if present in output
- Handle timeouts and errors gracefully

#### 8. **Response Persistence (Assistant Message)** (30-80ms)

```typescript
const assistantMessage = await insertMessage({
  threadId: thread.id,
  role: 'assistant',
  content: result.text,
  modelId: process.env.LEXYBRAIN_RAG_MODEL_ID!,
  retrievedSourceIds: topK.map(s => ({ id: s.source_id, type: s.source_type, score: s.similarity_score })),
  generationMetadata: {
    tokensIn: result.metadata.promptTokens,
    tokensOut: result.metadata.outputTokens,
    latencyMs: result.metadata.latencyMs,
    temperature: request.options?.temperature || 0.7,
  },
  flags: {
    usedRag: topK.length > 0,
    fallbackToGeneric: false,
    insufficientContext: topK.length < 5,
  },
  trainingEligible: await checkTrainingEligibility(userId),
});
```

**Actions**:
- Insert assistant message
- Store retrieved source IDs and scores
- Store generation metadata
- Set training eligibility flag
- Update thread timestamp

#### 9. **Training Data Collection** (Async, Fire-and-Forget)

**File**: `/src/lib/rag/training-collector.ts` (new)

```typescript
// Non-blocking
collectTrainingData({
  userId,
  messageId: assistantMessage.id,
  prompt,
  response: result.text,
  sources: topK,
  capability,
}).catch(err => logger.warn('Training data collection failed', err));
```

**Actions**:
- If `trainingEligible === true`, log to `lexybrain_requests` and `lexybrain_responses`
- Store normalized prompt and context
- Enable future fine-tuning

#### 10. **Usage Event Recording** (Async)

```typescript
await recordUsageEvent(userId, 'rag_message', {
  cacheHit: false,
  latencyMs: result.metadata.latencyMs,
  tokensIn: result.metadata.promptTokens,
  tokensOut: result.metadata.outputTokens,
  costCents: estimateRagCost(result.metadata),
  modelVersion: process.env.LEXYBRAIN_RAG_MODEL_ID,
});
```

#### 11. **Return Response** (5-10ms)

```typescript
return NextResponse.json({
  threadId: thread.id,
  messageId: assistantMessage.id,
  answer: result.text,
  capability,
  sources: topK.map(s => ({
    id: s.source_id,
    type: s.source_type,
    label: s.source_label,
    score: s.similarity_score,
  })),
  references: extractReferences(result.text, topK),
  model: {
    id: process.env.LEXYBRAIN_RAG_MODEL_ID!,
    usage: {
      inputTokens: result.metadata.promptTokens,
      outputTokens: result.metadata.outputTokens,
    },
    latencyMs: result.metadata.latencyMs,
  },
  flags: {
    usedRag: topK.length > 0,
    fallbackToGeneric: false,
    insufficientContext: topK.length < 5,
  },
});
```

---

## Retrieval Strategy

### Capability-Specific Retrieval Policies

| Capability | Source Types | Filters | Top K | Rerank Strategy |
|------------|--------------|---------|-------|----------------|
| **market_brief** | keywords, trends | market, recent 90 days | 40 → 12 | Prioritize high opportunity score |
| **competitor_intel** | listings, shops, keywords | market, active listings | 40 → 12 | Prioritize user-owned + high sales |
| **keyword_explanation** | keywords, keyword_history, alerts | exact + related terms | 30 → 10 | Exact match first, then similar |
| **alert_explanation** | alerts, risk_rules, docs | user alerts, severity | 20 → 8 | User alerts first, then global rules |
| **general_chat** | docs, keywords, watchlists | user-owned preferred | 30 → 10 | User data first, then global |

### Retrieval Scope Rules

**User Scope** (highest priority):
- Keywords, watchlists, alerts created by the user
- Always included if semantically relevant

**Team Scope** (medium priority):
- Data shared within the user's team/organization
- Included if user scope insufficient

**Global Scope** (fallback):
- Public LexyHub docs, FAQs, help content
- Marketplace knowledge base
- Used when user/team data unavailable

### Source Filtering

**By Market**:
```sql
WHERE (p_market IS NULL OR source.market = p_market)
```

**By Time Range**:
```sql
WHERE (p_time_range_from IS NULL OR source.created_at >= p_time_range_from)
  AND (p_time_range_to IS NULL OR source.created_at <= p_time_range_to)
```

**By Capability**:
```sql
WHERE source.type = ANY(get_source_types_for_capability(p_capability))
```

---

## Prompt System

### Prompt Template Storage

**Location**: `lexybrain_prompt_configs` table (existing)

**New Prompt Types**:
- `ask_lexybrain_system` (global) - Core identity and rules
- `ask_lexybrain_{capability}_v1` - Capability-specific instructions

### Prompt Loading Strategy

```typescript
async function loadPromptsForCapability(capability: string) {
  const { data } = await supabase
    .from('lexybrain_prompt_configs')
    .select('type, system_instructions, constraints')
    .eq('is_active', true)
    .in('type', ['global', capability]);

  const systemPrompt = data.find(p => p.type === 'global')?.system_instructions;
  const capabilityPrompt = data.find(p => p.type === capability)?.system_instructions;

  return { systemPrompt, capabilityPrompt };
}
```

### Prompt Versioning

- Versioned names: `ask_lexybrain_market_brief_v1`, `_v2`, etc.
- Admin can activate/deactivate versions via `/api/admin/lexybrain/configs`
- A/B testing: Random assignment to version, track in `generation_metadata`

---

## Hugging Face Integration

### Model Configuration

**Environment Variables**:
```bash
# Existing (for Insights)
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-8B-Instruct

# New (for RAG)
LEXYBRAIN_RAG_MODEL_ID=meta-llama/Llama-3.1-70B-Instruct  # Larger model for conversational quality
```

**Rationale**:
- Insights uses 8B model (fast, structured output)
- RAG uses 70B model (better reasoning, conversation)
- Both use same Hugging Face infrastructure

### Client Reuse

**Existing Code**: `/src/lib/lexybrain/client.ts`

**Changes Required**: None! Just pass different `modelId`:

```typescript
// Insights call
await lexybrainGenerate({
  modelId: process.env.LEXYBRAIN_MODEL_ID!,
  ...
});

// RAG call
await lexybrainGenerate({
  modelId: process.env.LEXYBRAIN_RAG_MODEL_ID!,
  ...
});
```

**Shared Infrastructure**:
- ✅ HTTP client with retry logic
- ✅ Error handling (network, timeout, 4xx, 5xx)
- ✅ Token usage tracking
- ✅ Cost estimation
- ✅ Logging and Sentry integration
- ✅ Rate limiting and cost cap enforcement

### Error Handling

**Failure Modes**:

1. **Network Timeout** (>60s)
   - Retry once with exponential backoff
   - If still fails, return fallback response

2. **Model Overloaded** (503 from HF)
   - Wait 2s, retry once
   - If fails, return fallback

3. **Invalid Response** (malformed JSON)
   - Use text extraction fallback
   - Log to `ai_failures` table

**Fallback Response**:
```typescript
const fallbackResponse = {
  answer: "I'm having trouble generating a response right now. Your data shows: [brief summary of top 3 sources]. Please try again or rephrase your question.",
  flags: { fallbackToGeneric: true, usedRag: true },
};
```

---

## Authentication & Authorization

### Supported Auth Methods

#### 1. **User Session** (Primary - Web App)

**Pattern**: Same as LexyBrain Insights

```typescript
const supabase = createRouteHandlerClient({ cookies });
const { data: { user } } = await supabase.auth.getUser();
```

**File**: `/src/app/api/lexybrain/rag/route.ts`

#### 2. **Extension Bearer Token** (Chrome Extension)

**Pattern**: Same as existing extension endpoints

```typescript
const context = await authenticateExtension(request);
if (!context) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**File**: `/src/lib/extension/auth.ts`

#### 3. **Partner API Key** (Optional - for external integrations)

**Pattern**: Same as `/api/v1/keywords`

```typescript
const apiKey = request.headers.get('x-api-key');
const context = await authenticatePartnerKey(apiKey);
```

**File**: `/src/lib/api/partner-auth.ts`

### Authorization Rules

**Thread Access**:
- Users can only view/modify their own threads (enforced via RLS)
- Admin users can view all threads (via service role)

**Model Access**:
- Free plan: `rag_messages_per_month = 50`
- Basic plan: `rag_messages_per_month = 500`
- Pro plan: `rag_messages_per_month = 2000`
- Growth/Admin: unlimited

---

## Quota & Rate Limiting

### Quota System

**New Quota Key**: `rag_messages`

**Integration**: Extend `/src/lib/lexybrain-quota.ts`

```typescript
export type LexyBrainQuotaKey =
  | 'ai_calls'
  | 'ai_brief'
  | 'ai_sim'
  | 'rag_messages';  // NEW

export function getQuotaKeyForType(type: string): LexyBrainQuotaKey {
  if (type === 'rag_message') return 'rag_messages';
  // ... existing mappings
}
```

**Enforcement**:
```typescript
await consumeLexyBrainQuota(userId, 'rag_messages', 1);
```

**Reset**: Monthly (first day of month, same as other LexyBrain quotas)

### Rate Limiting

**Limits**:
- **Per User**: 60 requests/minute
- **Global**: Enforced via daily cost cap (same as Insights)

**Implementation**:
```typescript
// In-memory rate limiter (same pattern as extension auth)
if (!checkRateLimit(userId, 60, 60000)) {
  return NextResponse.json(
    { error: { code: 'rate_limit_exceeded', message: 'Too many requests' } },
    { status: 429 }
  );
}
```

**Cost Cap**:
- Reuse `isDailyCostCapReached()` from existing quota system
- Reject new requests if cap reached
- Return `503 cost_cap_reached`

---

## Error Handling

### Error Classes

**Reuse**: `/src/lib/api/errors.ts`

**New Error Types** (if needed):
```typescript
export class RagThreadNotFoundError extends NotFoundError {
  constructor(threadId: string) {
    super(`Thread ${threadId} not found`);
  }
}

export class RagContextInsufficientError extends ApiError {
  constructor() {
    super('Insufficient context for RAG', 'INSUFFICIENT_CONTEXT', 200); // Still returns 200
  }
}
```

### Error Handling Strategy

**Graceful Degradation**:
1. **Retrieval fails** → Continue with empty context, set `insufficientContext` flag
2. **LLM fails** → Return fallback response with retrieved sources
3. **DB write fails** → Log error, still return response to user

**Logging**:
```typescript
logger.error({
  type: 'rag_generation_error',
  user_id: userId,
  thread_id: threadId,
  capability,
  error: err.message,
}, 'RAG generation failed');
```

**Sentry Integration**:
```typescript
Sentry.captureException(error, {
  tags: { feature: 'rag', capability },
  extra: { userId, threadId, messageId },
});
```

---

## Performance & Monitoring

### Performance Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| **Total Latency** | <5s | <10s | >10s |
| **Retrieval** | <500ms | <1s | >1s |
| **LLM Generation** | <3s | <8s | >10s |
| **DB Operations** | <200ms | <500ms | >500ms |

### Monitoring & Logging

**Usage Events** (existing table: `ai_usage_events`):
```typescript
await recordUsageEvent(userId, 'rag_message', {
  cacheHit: false,
  latencyMs: totalLatency,
  tokensIn,
  tokensOut,
  costCents: estimatedCost,
  modelVersion: process.env.LEXYBRAIN_RAG_MODEL_ID,
});
```

**Custom Metrics** (via Pino logger):
```typescript
logger.info({
  type: 'rag_request_complete',
  user_id: userId,
  thread_id: threadId,
  capability,
  retrieval_count: sources.length,
  retrieval_latency_ms: retrievalLatency,
  generation_latency_ms: generationLatency,
  total_latency_ms: totalLatency,
  tokens_in: tokensIn,
  tokens_out: tokensOut,
}, 'RAG request completed');
```

**Analytics Dashboard** (future):
- Total RAG messages/day
- P50/P95 latency
- Quota usage by plan
- Most common capabilities
- Retrieval quality (avg sources per request)
- User satisfaction (based on feedback table)

---

## Implementation Checklist

### Phase 1: Database & Schema (Week 1)

- [ ] Create migration `004X_ask_lexybrain_rag.sql`
- [ ] Add tables: `rag_threads`, `rag_messages`, `rag_feedback`
- [ ] Extend `plan_entitlements` with `rag_messages_per_month`
- [ ] Seed RAG prompt configs in `lexybrain_prompt_configs`
- [ ] Implement `search_rag_context()` RPC function
- [ ] Create RLS policies for new tables
- [ ] Test migration on dev/staging

### Phase 2: Core Libraries (Week 2)

- [ ] **`/src/lib/rag/thread-manager.ts`**
  - `ensureThread()` - Get or create thread
  - `insertMessage()` - Insert user/assistant messages
  - `loadThreadHistory()` - Fetch recent messages
  - `archiveThread()` - Soft delete thread

- [ ] **`/src/lib/rag/capability-detector.ts`**
  - `detectCapabilityHeuristic()` - Fast keyword matching
  - `classifyIntent()` - LLM-based classification (reuse existing)

- [ ] **`/src/lib/rag/retrieval.ts`**
  - `generateEmbedding()` - Reuse existing embedding service
  - `retrieveContext()` - Call `search_rag_context` RPC
  - `rerank()` - Prioritize user-owned sources
  - `fetchStructuredContext()` - Get keywords/listings by ID

- [ ] **`/src/lib/rag/prompt-builder.ts`**
  - `buildRagPrompt()` - Construct full prompt
  - `loadSystemPrompt()` - Fetch from DB
  - `loadCapabilityPrompt()` - Fetch from DB
  - `formatSources()` - Pretty-print retrieved context

- [ ] **`/src/lib/rag/training-collector.ts`**
  - `collectTrainingData()` - Log to lexybrain_requests/responses
  - `checkTrainingEligibility()` - Check user opt-in

- [ ] **Extend `/src/lib/lexybrain-quota.ts`**
  - Add `'rag_messages'` to quota key enum
  - Add mapping in `getQuotaKeyForType()`

### Phase 3: API Endpoint (Week 2-3)

- [ ] **`/src/app/api/lexybrain/rag/route.ts`**
  - Implement `POST` handler
  - Request validation (Zod schema)
  - Authentication (user session + extension)
  - Quota enforcement
  - Call orchestration (steps 1-11)
  - Error handling with graceful degradation
  - Response formatting

- [ ] **Request/Response Type Definitions**
  - `/src/lib/rag/types.ts` - TypeScript interfaces

- [ ] **Environment Variables**
  - Add `LEXYBRAIN_RAG_MODEL_ID` to `.env.example`
  - Add `LEXYBRAIN_RAG_ENABLED` feature flag
  - Update `/src/lib/env.ts` with validation

### Phase 4: Testing (Week 3)

- [ ] **Unit Tests**
  - `capability-detector.test.ts`
  - `prompt-builder.test.ts`
  - `retrieval.test.ts`

- [ ] **Integration Tests**
  - `rag-endpoint.test.ts` (end-to-end)
  - Test all capabilities
  - Test error scenarios (quota exceeded, auth failure, LLM timeout)

- [ ] **Manual Testing**
  - Test via Postman/cURL
  - Test multi-turn conversations
  - Test with insufficient context
  - Test quota limits

### Phase 5: Frontend Integration (Week 4)

- [ ] **Chat UI Component** (`/src/components/ask-lexybrain/ChatInterface.tsx`)
- [ ] **Thread List Component** (`/src/components/ask-lexybrain/ThreadList.tsx`)
- [ ] **Message Component** with source citations
- [ ] **Feedback Component** (thumbs up/down)
- [ ] **API Client** (`/src/lib/api/rag-client.ts`)
- [ ] **State Management** (React Query or SWR)

### Phase 6: Admin & Analytics (Week 5)

- [ ] **Admin Endpoint**: `/api/admin/lexybrain/rag/stats`
  - Total messages, threads, active users
  - Quota usage by plan
  - Capability distribution

- [ ] **Admin UI**: Analytics dashboard
- [ ] **Prompt Management UI**: Edit/version prompts
- [ ] **User Feedback Review**: `/api/admin/lexybrain/rag/feedback`

### Phase 7: Documentation (Week 5)

- [ ] Update `/docs/lexybrain/technical.md`
- [ ] Create `/docs/lexybrain/rag-user-guide.md`
- [ ] Update API documentation
- [ ] Update environment setup guide

### Phase 8: Deployment (Week 6)

- [ ] Deploy migration to staging
- [ ] Test on staging with real data
- [ ] Deploy to production
- [ ] Monitor errors and latency
- [ ] Gradual rollout (feature flag per plan)

---

## File Structure

### New Files

```
/home/user/lexyhub/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── lexybrain/
│   │           └── rag/
│   │               └── route.ts                    # Main endpoint
│   │
│   ├── lib/
│   │   └── rag/
│   │       ├── types.ts                            # TypeScript types
│   │       ├── thread-manager.ts                   # Thread CRUD
│   │       ├── capability-detector.ts              # Intent classification
│   │       ├── retrieval.ts                        # Vector + context retrieval
│   │       ├── prompt-builder.ts                   # Prompt construction
│   │       ├── training-collector.ts               # Training data logging
│   │       └── utils.ts                            # Helpers
│   │
│   ├── components/
│   │   └── ask-lexybrain/
│   │       ├── ChatInterface.tsx                   # Main chat UI
│   │       ├── ThreadList.tsx                      # Thread sidebar
│   │       ├── Message.tsx                         # Message bubble
│   │       ├── SourceCitation.tsx                  # Source chips
│   │       └── FeedbackButton.tsx                  # Thumbs up/down
│   │
├── supabase/
│   └── migrations/
│       └── 004X_ask_lexybrain_rag.sql              # New tables + RPC
│
└── docs/
    └── lexybrain/
        ├── rag-endpoint-specification.md           # THIS FILE
        └── rag-user-guide.md                       # End-user docs
```

### Modified Files

```
/home/user/lexyhub/
├── src/
│   └── lib/
│       ├── lexybrain-quota.ts                      # Add 'rag_messages' quota
│       ├── env.ts                                  # Add LEXYBRAIN_RAG_MODEL_ID
│       └── lexybrain/
│           └── client.ts                           # No changes (reuse as-is)
│
└── .env.example                                     # Add new env vars
```

---

## Appendix

### A. Example Request/Response

**Request**:
```json
POST /api/lexybrain/rag
{
  "threadId": null,
  "message": "What are the top trending keywords in the wedding niche on Etsy right now?",
  "capability": "market_brief",
  "context": {
    "marketplaces": ["etsy"]
  },
  "options": {
    "maxTokens": 1024,
    "temperature": 0.7
  },
  "meta": {
    "client": "web",
    "version": "1.0"
  }
}
```

**Response**:
```json
{
  "threadId": "550e8400-e29b-41d4-a716-446655440000",
  "messageId": "660e8400-e29b-41d4-a716-446655440001",
  "answer": "Based on recent Etsy data, here are the top trending wedding keywords:\n\n**High Demand + Growing Trends:**\n- \"vintage wedding rings\" - Demand index 87, competition 45, momentum +12%\n- \"handmade engagement rings\" - Demand 72, competition 38, momentum +8%\n- \"boho wedding dress\" - Demand 91, competition 62, momentum +15%\n\n**Key Insights:**\nVintage and handmade styles are seeing strong growth. The boho aesthetic continues to dominate with both high demand and momentum. Competition is moderate across these terms, suggesting good opportunities for differentiated products.\n\n**Actionable Next Steps:**\n1. Consider listing vintage-style or handmade wedding jewelry\n2. Optimize for \"boho\" aesthetic if your products align\n3. Use LexyBrain's Opportunity Radar to deep-dive on specific keywords",
  "capability": "market_brief",
  "sources": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "type": "keyword",
      "label": "vintage wedding rings",
      "score": 0.92
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "type": "keyword",
      "label": "handmade engagement rings",
      "score": 0.89
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "type": "keyword",
      "label": "boho wedding dress",
      "score": 0.87
    }
  ],
  "references": {
    "keywords": ["770e8400-e29b-41d4-a716-446655440002", "880e8400-e29b-41d4-a716-446655440003", "990e8400-e29b-41d4-a716-446655440004"],
    "listings": [],
    "alerts": [],
    "docs": []
  },
  "model": {
    "id": "meta-llama/Llama-3.1-70B-Instruct",
    "usage": {
      "inputTokens": 1847,
      "outputTokens": 312
    },
    "latencyMs": 3421
  },
  "flags": {
    "usedRag": true,
    "fallbackToGeneric": false,
    "insufficientContext": false
  }
}
```

### B. Environment Variables

```bash
# Existing LexyBrain Insights
LEXYBRAIN_ENABLE=true
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-8B-Instruct
LEXYBRAIN_DAILY_COST_CAP=10000  # cents
HF_TOKEN=hf_...

# New RAG Variables
LEXYBRAIN_RAG_ENABLED=true
LEXYBRAIN_RAG_MODEL_ID=meta-llama/Llama-3.1-70B-Instruct
```

### C. Database Index Strategy

**Indexes for Performance**:
```sql
-- Fast thread lookups
CREATE INDEX rag_threads_user_id_idx ON rag_threads(user_id, last_message_at DESC);

-- Fast message retrieval
CREATE INDEX rag_messages_thread_id_idx ON rag_messages(thread_id, created_at ASC);

-- Training data queries
CREATE INDEX rag_messages_training_idx ON rag_messages(training_eligible) WHERE training_eligible = true;

-- Soft delete support
CREATE INDEX rag_messages_deleted_idx ON rag_messages(deleted_at) WHERE deleted_at IS NULL;
```

### D. Cost Estimation

**Per Message Cost** (estimated):
- Embedding generation: ~$0.0001 (via OpenAI)
- LLM generation (70B model): ~$0.003-$0.01 depending on tokens
- Total per message: ~$0.01

**Monthly Costs by Plan**:
- Free (50 msgs): $0.50/user/month
- Basic (500 msgs): $5/user/month
- Pro (2000 msgs): $20/user/month

**Daily Cost Cap**: Reuse existing `LEXYBRAIN_DAILY_COST_CAP` (default $100)

---

## Conclusion

This specification provides a complete, implementation-ready blueprint for the LexyBrain RAG endpoint. It:

✅ **Reuses existing infrastructure**: Hugging Face client, auth, quota, logging
✅ **Extends proven patterns**: Same DB structure, RLS, error handling
✅ **Adds minimal complexity**: 3 new tables, 1 RPC, 6 new lib files
✅ **Enables conversational AI**: Multi-turn, context-aware, grounded responses
✅ **Production-ready**: Quota, rate limits, graceful degradation, monitoring

**Next Steps**: Begin implementation with Phase 1 (Database & Schema), then proceed through phases 2-8.

**Questions or Clarifications**: Contact the engineering team or update this spec as implementation progresses.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: ✅ Ready for Implementation
