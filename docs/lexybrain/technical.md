# LexyBrain Technical Documentation

## Overview

LexyBrain is an AI-powered market intelligence system for Etsy and marketplace sellers, built on top of LexyHub's keyword and market data. It provides four types of insights:

1. **Market Brief** - Comprehensive market analysis with opportunities and risks
2. **Opportunity Radar** - Scored keyword recommendations across 5 dimensions
3. **Ad Insight** - Advertising budget allocation recommendations
4. **Risk Sentinel** - Market risk and challenge identification

## Architecture

### High-Level Flow

```
User Request
    ↓
/api/lexybrain/generate
    ↓
Authentication & Authorization
    ↓
Input Normalization & Hashing
    ↓
Cache Check (ai_insights table)
    ├─ Cache Hit → Return cached result
    └─ Cache Miss
        ↓
    Quota Check (usage_counters + plan_entitlements)
        ↓
    Daily Cost Cap Check
        ↓
    Load Active Prompt Config
        ↓
    Build Context from Keywords
        ↓
    Generate Prompt
        ↓
    Call RunPod Llama-3-8B Endpoint
        ↓
    Parse & Validate JSON
        ↓
    Persist to Cache
        ↓
    Record Usage Event
        ↓
    Return Result
```

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + RLS)
- **Vector Search**: pgvector extension
- **LLM**: Llama-3-8B on RunPod
- **Monitoring**: Sentry (errors) + PostHog (analytics)
- **Validation**: Zod schemas
- **Logging**: Pino structured logging

## Database Schema

### Core Tables

#### `ai_insights` - Cache Layer

```sql
CREATE TABLE ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('market_brief', 'radar', 'ad_insight', 'risk')),
  input_hash text NOT NULL,
  context_json jsonb NOT NULL,
  output_json jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ttl_minutes int NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, input_hash)
);
```

**TTL by Type**:
- `market_brief`: 1440 minutes (24 hours)
- `radar`: 1440 minutes (24 hours)
- `risk`: 720 minutes (12 hours)
- `ad_insight`: 360 minutes (6 hours)

#### `ai_usage_events` - Analytics

```sql
CREATE TABLE ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,
  tokens_in int,
  tokens_out int,
  cache_hit bool DEFAULT false,
  latency_ms int,
  cost_cents int,
  model_version text,
  plan_code text,
  ts timestamptz NOT NULL DEFAULT now()
);
```

#### `ai_failures` - Error Tracking

```sql
CREATE TABLE ai_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL,
  error_code text,
  error_message text,
  payload jsonb NOT NULL,
  ts timestamptz NOT NULL DEFAULT now()
);
```

#### `lexybrain_prompt_configs` - Admin Configuration

```sql
CREATE TABLE lexybrain_prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('market_brief', 'radar', 'ad_insight', 'risk', 'global')),
  system_instructions text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, type),
  -- Ensure only one active config per type
  UNIQUE (type) WHERE is_active = true
);
```

#### `keyword_embeddings` - Vector Search

```sql
CREATE TABLE keyword_embeddings (
  keyword_id uuid PRIMARY KEY REFERENCES keywords(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  model_name text NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX keyword_embeddings_hnsw_idx ON keyword_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

#### `plan_entitlements` - Quota Limits

Extended with LexyBrain columns:

```sql
ALTER TABLE plan_entitlements ADD COLUMN ai_calls_per_month int;
ALTER TABLE plan_entitlements ADD COLUMN briefs_per_month int;
ALTER TABLE plan_entitlements ADD COLUMN sims_per_month int;
ALTER TABLE plan_entitlements ADD COLUMN extension_boost jsonb;
```

**Default Entitlements**:
- **Free**: 20 AI calls, 2 briefs, 2 sims/month (with 2x extension boost)
- **Basic**: 200 AI calls, 20 briefs, 20 sims/month
- **Pro**: 2000 AI calls, 100 briefs, 200 sims/month
- **Growth**: Unlimited (-1)

### RPC Functions

#### `similar_keywords(p_keyword_id uuid, p_k int)`

Returns keywords most similar to the given keyword using vector cosine similarity.

```sql
SELECT term, market, demand_index, competition_score, trend_momentum, similarity
FROM keywords k
JOIN keyword_embeddings ke ON ke.keyword_id = k.id
ORDER BY ke.embedding <=> (SELECT embedding FROM keyword_embeddings WHERE keyword_id = p_keyword_id)
LIMIT p_k;
```

#### `niche_context(p_terms text[], p_market text, p_limit int)`

Retrieves keywords matching the given terms with their metrics.

```sql
SELECT id, term, demand_index, competition_score, trend_momentum
FROM keywords
WHERE market = p_market AND term = ANY(p_terms)
ORDER BY ai_opportunity_score DESC
LIMIT p_limit;
```

## Core Library Modules

### `lib/lexybrain-config.ts`

Centralized configuration and feature flags.

**Key Functions**:
- `isLexyBrainEnabled(): boolean` - Check if feature is enabled
- `getLexyBrainModelUrl(): string` - Get RunPod endpoint URL (throws if disabled or missing)
- `getLexyBrainKey(): string` - Get API key
- `getLexyBrainTtl(type): number` - Get cache TTL for insight type
- `getLexyBrainDailyCostCap(): number | null` - Get daily cost cap

**Environment Variables**:
```bash
LEXYBRAIN_ENABLE=true
LEXYBRAIN_MODEL_URL=https://api.runpod.ai/v2/your-endpoint-id/runsync
LEXYBRAIN_KEY=your-runpod-api-key
LEXYBRAIN_MODEL_VERSION=llama-3-8b
LEXYBRAIN_DAILY_COST_CAP=10000  # $100/day in cents
LEXYBRAIN_MAX_LATENCY_MS=30000  # 30 seconds
```

### `lib/lexybrain-schemas.ts`

TypeScript types and Zod validators for all outputs.

**Key Types**:
```typescript
type MarketBrief = {
  niche: string;
  summary: string;
  top_opportunities: Array<{ term: string; why: string }>;
  risks: Array<{ term: string; why: string }>;
  actions: string[];
  confidence: number; // 0-1
};

type OpportunityRadar = {
  items: Array<{
    term: string;
    scores: {
      demand: number;      // 0-1
      momentum: number;    // 0-1
      competition: number; // 0-1, lower is better
      novelty: number;     // 0-1
      profit: number;      // 0-1
    };
    comment: string;
  }>;
};

type AdInsight = {
  budget_split: Array<{
    term: string;
    daily_cents: number;
    expected_cpc_cents: number;
    expected_clicks: number;
  }>;
  notes: string;
};

type RiskSentinel = {
  alerts: Array<{
    term: string;
    issue: string;
    severity: "low" | "medium" | "high";
    evidence: string;
    action: string;
  }>;
};
```

**Key Functions**:
- `validateLexyBrainOutput(type, data)` - Validate output against schema
- `getSchemaDescription(type)` - Get schema description for prompts

### `lib/lexybrain-prompt.ts`

Builds deterministic prompts for the LLM.

**Key Functions**:
```typescript
function buildLexyBrainPrompt(
  type: LexyBrainOutputType,
  context: LexyBrainContext,
  promptConfig?: PromptConfig
): string
```

**Prompt Structure**:
1. System Instructions (global + type-specific)
2. Task Description
3. Output Schema (strict JSON format)
4. Context Data (keywords with metrics)
5. Final Instruction

### `lib/lexybrain-client.ts`

Low-level RunPod communication.

**Key Functions**:
```typescript
async function callLexyBrainRaw(
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  }
): Promise<string>
```

**Request Format**:
```typescript
{
  input: {
    prompt: string,
    max_tokens: 2048,
    temperature: 0.3,
    top_p: 0.9,
    stop: ["</s>", "<|endoftext|>"]
  }
}
```

**Error Handling**:
- Network errors → captured in Sentry
- Timeout errors → `LexyBrainTimeoutError`
- HTTP errors → `LexyBrainClientError` with status code

### `lib/lexybrain-json.ts`

High-level wrapper with retry logic.

**Key Functions**:
```typescript
async function generateLexyBrainJson(params: {
  type: LexyBrainOutputType;
  context: LexyBrainContext;
  userId: string;
  promptConfig?: PromptConfig;
  maxRetries?: number;
}): Promise<GenerateLexyBrainJsonResult>
```

**Retry Logic**:
1. First attempt with normal prompt
2. On failure, retry with stricter instructions
3. On second failure, record in `ai_failures` and throw

**Validation**:
- JSON parsing errors → retry once
- Schema validation errors → retry once
- Model errors → propagate immediately

### `lib/lexybrain-quota.ts`

Quota enforcement integrated with billing system.

**Key Functions**:
```typescript
async function useLexyBrainQuota(
  userId: string,
  key: LexyBrainQuotaKey,
  amount: number
): Promise<QuotaCheckResult>

async function isDailyCostCapReached(
  dailyCapCents: number | null
): Promise<boolean>
```

**Quota Keys**:
- `ai_calls` - General AI operations (radar, risk, ad_insight)
- `ai_brief` - Market briefs
- `ai_sim` - Simulations (future)

**Quota Mapping**:
- `market_brief` → `ai_brief`
- `radar`, `ad_insight`, `risk` → `ai_calls`

## API Endpoints

### `POST /api/lexybrain/generate`

Main orchestrator for AI insight generation.

**Request**:
```typescript
{
  type: "market_brief" | "radar" | "ad_insight" | "risk",
  market: string,
  niche_terms?: string[],
  budget_cents?: number  // Required for ad_insight
}
```

**Response**:
Returns the generated insight in the format matching the requested type (MarketBrief, OpportunityRadar, etc.).

**Error Responses**:
- `503` - `lexybrain_disabled` - Feature not enabled
- `401` - `unauthorized` - Authentication required
- `422` - `invalid_request` - Invalid request parameters
- `429` - `quota_exceeded` - User quota exhausted
- `503` - `cost_cap_reached` - Daily cost cap reached
- `500` - `generation_failed` - Model error

**Algorithm**:
1. Feature flag check
2. Authentication
3. Request validation
4. Input normalization
5. Context building (fetch keywords)
6. Input hash computation
7. Cache check
8. Quota enforcement
9. Daily cost cap check
10. Load prompt config
11. Generate AI insight
12. Persist to cache
13. Record usage event
14. Track analytics
15. Return result

### `POST /api/lexybrain/graph`

Generates keyword similarity graph for visualization.

**Request**:
```typescript
{
  term: string,
  market: string,
  depth?: number,        // 1-3, default 1
  maxNodes?: number,     // 5-100, default 50
  minSimilarity?: number // 0-1, default 0.5
}
```

**Response**:
```typescript
{
  nodes: Array<{
    id: string,
    term: string,
    demand_index: number | null,
    competition_score: number | null,
    trend_momentum: number | null,
    ai_opportunity_score: number | null
  }>,
  edges: Array<{
    source: string,
    target: string,
    similarity: number  // 0-1
  }>,
  centerTerm: string,
  market: string
}
```

**Algorithm**:
1. Find center keyword by term
2. BFS traversal using `similar_keywords` RPC
3. Build nodes and edges up to maxNodes
4. Filter edges by minSimilarity threshold
5. Return graph data

### Admin API

#### `GET /api/admin/lexybrain/configs`

List all prompt configurations.

**Query Parameters**:
- `type` - Filter by insight type
- `active` - Show only active configs

**Response**:
```typescript
{
  configs: Array<{
    id: string,
    name: string,
    type: string,
    system_instructions: string,
    constraints: Record<string, unknown>,
    is_active: boolean,
    created_at: string,
    updated_at: string
  }>
}
```

#### `POST /api/admin/lexybrain/configs`

Create new prompt configuration.

**Request**:
```typescript
{
  name: string,
  type: "market_brief" | "radar" | "ad_insight" | "risk" | "global",
  system_instructions: string,
  constraints?: Record<string, unknown>,
  is_active?: boolean
}
```

#### `PATCH /api/admin/lexybrain/configs`

Update existing prompt configuration.

**Request**:
```typescript
{
  id: string,
  name?: string,
  system_instructions?: string,
  constraints?: Record<string, unknown>,
  is_active?: boolean
}
```

#### `GET /api/admin/lexybrain/metrics`

Get usage metrics and analytics.

**Query Parameters**:
- `period` - Time range: 7d, 30d, 90d
- `type` - Filter by insight type

**Response**:
```typescript
{
  period: string,
  since: string,
  metrics: {
    total_requests: number,
    cache_hits: number,
    cache_misses: number,
    cache_hit_rate: number,
    avg_latency_ms: number,
    p95_latency_ms: number,
    total_tokens_in: number,
    total_tokens_out: number,
    total_cost_cents: number,
    failures: number,
    active_cache_entries: number,
    by_type: Record<string, { count: number, cache_hit_rate: number }>,
    by_plan: Record<string, { count: number, cache_hit_rate: number }>
  }
}
```

## Caching Strategy

### Input Hashing

Deterministic cache keys are computed from:
1. Insight type
2. Market (normalized)
3. Niche terms (sorted)
4. Budget (for ad_insight)
5. Keyword set hash

**Hash Function**:
```typescript
function computeInputHash(...): string {
  const components = [
    type,
    market.toLowerCase(),
    nicheTerms.sort().join(","),
    budgetCents || 0,
    keywords.map(k => k.term).sort().join(",")
  ];
  return createHash("sha256").update(components.join("|")).digest("hex");
}
```

### TTL Management

Insights expire based on volatility:
- **Market Brief**: 24 hours (comprehensive analysis changes slowly)
- **Radar**: 24 hours (opportunity scores are relatively stable)
- **Risk**: 12 hours (risks emerge faster)
- **Ad Insight**: 6 hours (ad costs fluctuate frequently)

### Cleanup

Expired insights are marked as `stale` but not immediately deleted. A periodic cleanup job (future enhancement) will purge old entries:

```sql
DELETE FROM ai_insights WHERE expires_at < NOW() - INTERVAL '7 days';
```

## Quota Enforcement

### Atomic Operations

Quota checks use atomic database operations to prevent race conditions:

```sql
-- In application code
BEGIN;
SELECT value FROM usage_counters WHERE user_id = ? AND key = ? AND period_start = ?;
-- Check if value + amount <= limit
UPDATE usage_counters SET value = value + amount WHERE ...;
COMMIT;
```

### Monthly Reset

Usage counters are partitioned by `period_start` (first day of month). Counters automatically reset each month as new entries are created.

### Extension Boost

Free tier users with the Chrome extension get a 2x multiplier:
```typescript
const multiplier = extensionBoost.ai_calls_multiplier || 1;
const effectiveLimit = baseLimit * multiplier;
```

## Cost Management

### Estimated Costs

Rough cost estimates per insight type (calibrated based on actual usage):
- Market Brief: ~$0.05
- Opportunity Radar: ~$0.03
- Risk Sentinel: ~$0.02
- Ad Insight: ~$0.02
- Graph Generation: ~$0.01

### Daily Cap

If `LEXYBRAIN_DAILY_COST_CAP` is set, the system will block new uncached requests once the daily spend is reached:

```typescript
const todaySpend = await sumCostCentsToday();
if (todaySpend >= dailyCostCap) {
  return 503; // Only serve cached results
}
```

## Monitoring

### Sentry Integration

All LexyBrain operations are tagged in Sentry:
```typescript
Sentry.captureException(error, {
  tags: {
    feature: "lexybrain",
    component: "generate-endpoint",
    insight_type: "market_brief"
  },
  extra: {
    user_id,
    latency_ms,
    request_data
  }
});
```

### PostHog Analytics

Key events tracked:
- `lexybrain_generate` - Every insight generation
  - Properties: type, market, cache_hit, latency_ms, plan_code
- `lexybrain_graph_view` - Graph visualization
- `lexybrain_admin_config_update` - Admin config changes

### Structured Logging

All operations use Pino structured logging:
```typescript
logger.info({
  type: "lexybrain_success",
  insight_type: "market_brief",
  user_id,
  latency_ms,
  cache_hit: false
}, "LexyBrain generation successful");
```

## Error Handling

### Error Types

1. **LexyBrainClientError** - HTTP/network errors from RunPod
2. **LexyBrainTimeoutError** - Request timeout (default 30s)
3. **LexyBrainValidationError** - JSON parsing/validation failed
4. **LexyBrainQuotaExceededError** - User quota exhausted

### Failure Recording

All failures are logged to `ai_failures` table for analysis:
```sql
INSERT INTO ai_failures (user_id, type, error_code, payload)
VALUES (...);
```

### Graceful Degradation

- If Supabase unavailable → fail open for cost cap checks
- If cache lookup fails → proceed to generation
- If usage recording fails → log warning but don't block response

## Security

### Server-Side Only

All LexyBrain operations are server-side. No secrets or API keys are exposed to clients.

### Authentication

All endpoints require authenticated users via Supabase Auth:
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return 401;
```

### Admin Access

Admin endpoints use `requireAdminUser()` which checks:
1. Email allowlist (`LEXYHUB_ADMIN_EMAILS`)
2. User metadata (`app_metadata.admin` or `user_metadata.admin`)
3. Special "admin" plan

### RLS Policies

- `ai_insights`: Users can only see their own or anonymous insights
- `ai_usage_events`: Users can only see their own events
- `ai_failures`: Admin-only access (via service role)

## Deployment

### Environment Setup

Required:
```bash
LEXYBRAIN_ENABLE=true
LEXYBRAIN_MODEL_URL=https://api.runpod.ai/v2/your-endpoint-id/runsync
LEXYBRAIN_KEY=your-runpod-api-key
```

Optional:
```bash
LEXYBRAIN_MODEL_VERSION=llama-3-8b
LEXYBRAIN_DAILY_COST_CAP=10000
LEXYBRAIN_MAX_LATENCY_MS=30000
```

### Database Migration

Run migrations in order:
```bash
supabase migration up
# Or in production:
supabase db push --project-ref your-project-ref
```

### Vercel Configuration

The generate endpoint uses `maxDuration = 60` (60 seconds). Ensure your Vercel plan supports this.

### RunPod Setup

1. Deploy Llama-3-8B model on RunPod
2. Configure serverless endpoint
3. Set cold start timeout appropriately
4. Note the endpoint ID and API key

## Testing

### Unit Tests

Test each module independently:
```typescript
// lib/lexybrain-schemas.test.ts
test("validates market brief output", () => {
  const output = { niche: "test", summary: "...", ... };
  expect(() => validateLexyBrainOutput("market_brief", output)).not.toThrow();
});
```

### Integration Tests

Test full flow with mocked RunPod:
```typescript
// api/lexybrain/generate.test.ts
test("generates market brief", async () => {
  mockRunPodResponse({ output: validMarketBrief });
  const response = await POST(request);
  expect(response.status).toBe(200);
});
```

### Load Testing

Use k6 or similar to test quotas and caching:
```javascript
import http from 'k6/http';

export default function() {
  http.post('https://lexyhub.com/api/lexybrain/generate', {
    type: 'market_brief',
    market: 'etsy',
    niche_terms: ['handmade jewelry']
  });
}
```

## Troubleshooting

### Common Issues

**Issue**: `lexybrain_disabled` error
- **Solution**: Check `LEXYBRAIN_ENABLE`, `LEXYBRAIN_MODEL_URL`, and `LEXYBRAIN_KEY` env vars

**Issue**: Timeout errors
- **Solution**: Increase `LEXYBRAIN_MAX_LATENCY_MS` or check RunPod endpoint health

**Issue**: Validation errors
- **Solution**: Check `ai_failures` table for details, may need to adjust prompt config

**Issue**: High cache miss rate
- **Solution**: TTLs may be too short, or input hashing is too granular

**Issue**: Quota exceeded unexpectedly
- **Solution**: Check `usage_counters` for current usage, verify plan entitlements

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug
```

Check logs for:
- `lexybrain_request` - Incoming requests
- `lexybrain_cache_hit` - Cache performance
- `lexybrain_quota_used` - Quota consumption
- `lexybrain_error` - Errors and failures

## Future Enhancements

1. **Batch Generation** - Generate multiple insights in parallel
2. **Streaming Responses** - Stream LLM output as it's generated
3. **Fine-Tuned Models** - Train domain-specific models on LexyHub data
4. **Embeddings Pipeline** - Automated background job to generate embeddings
5. **A/B Testing** - Test different prompt configs with metrics
6. **Cost Optimization** - Dynamic temperature/token adjustments based on complexity
7. **Multi-Language Support** - Extend beyond English markets
8. **Real-Time Insights** - WebSocket-based live updates

## References

- [Supabase pgvector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [RunPod Serverless API](https://docs.runpod.io/serverless/overview)
- [Llama-3 Model Card](https://huggingface.co/meta-llama/Llama-3-8B)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Zod Validation](https://zod.dev/)
