# LexyHub Architecture

This document provides a comprehensive overview of LexyHub's system architecture, design decisions, and technical implementation.

## 📐 System Overview

LexyHub is a full-stack SaaS application built with a modern serverless architecture, leveraging Next.js App Router, Supabase PostgreSQL with pgvector for AI-powered semantic search, and OpenAI APIs for intelligent keyword analysis and optimization.

```
┌─────────────────────────────────────────────────────────────┐
│                        Users / Clients                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼────┐             ┌──────▼──────┐
   │  Web App │             │  Extension  │
   │ (Next.js)│             │  (Chrome)   │
   └────┬─────┘             └──────┬──────┘
        │                          │
        └──────────┬───────────────┘
                   │
        ┌──────────▼──────────┐
        │   Vercel Platform   │
        │  (Edge + Serverless)│
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   ┌────▼─────┐      ┌────────▼────────┐
   │ Supabase │      │   OpenAI API    │
   │  (Postgres│      │  (Embeddings    │
   │  + pgvector)     │   + GPT)        │
   └──────────┘      └─────────────────┘
```

## 🏗️ Architecture Layers

### 1. Presentation Layer (Frontend)

**Technology**: Next.js 14 App Router, React 18, TypeScript

#### Components
- **Server Components** (default): For data fetching and static content
- **Client Components**: For interactivity (marked with `'use client'`)
- **UI Components**: Reusable components in `src/components/ui/`
- **Feature Components**: Domain-specific components

#### Key Patterns
- **Server-Side Rendering (SSR)**: Dynamic pages rendered on-demand
- **Static Site Generation (SSG)**: Build-time rendering for docs
- **Client-Side Routing**: Instant navigation with Next.js router
- **Optimistic UI**: Immediate feedback before server confirmation

### 2. API Layer (Backend)

**Technology**: Next.js API Routes, Edge Runtime

#### Route Structure
```
/api
├── /auth              # Authentication (Supabase, OAuth)
├── /keywords          # Keyword search and intelligence
├── /watchlists        # Watchlist CRUD operations
├── /insights          # Trends, intent, competitors
├── /listings          # Listing intelligence and audits
├── /ai                # AI operations (tag optimizer, visual tag)
├── /jobs              # Background job triggers
├── /admin             # Admin/backoffice operations
└── /usage             # Quota and usage tracking
```

#### API Patterns
- **RESTful endpoints**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **Request validation**: Zod schemas for type-safe validation
- **Error handling**: Consistent error responses with proper status codes
- **Authentication**: JWT tokens from Supabase Auth
- **Authorization**: Row-Level Security (RLS) in PostgreSQL

### 3. Business Logic Layer

**Location**: `src/lib/`

#### Modules
- **`/ai`**: AI/ML utilities (embeddings, intent classification, prompts)
- **`/keywords`**: Keyword processing and insights
- **`/etsy`**: Etsy API client, sync, and scraping
- **`/auth`**: Authentication and authorization
- **`/usage`**: Quota management and tracking
- **`/watchlists`**: Watchlist service layer
- **`/insights`**: Competitor analysis, trend aggregation
- **`/market-twin`**: Scenario simulation engine
- **`/billing`**: Stripe integration
- **`/scraping`**: Web scraping utilities

### 4. Data Layer

**Technology**: Supabase (PostgreSQL 15+ with pgvector extension)

#### Key Features
- **pgvector**: 3,072-dimensional vector embeddings for semantic search
- **Row-Level Security (RLS)**: Database-level authorization
- **Real-time subscriptions**: WebSocket updates (optional)
- **Automatic backups**: Point-in-time recovery

## 🗄️ Database Schema

### Core Entities

#### Users & Authentication
```sql
-- Managed by Supabase Auth
auth.users (id, email, ...)

-- User profiles and preferences
user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  plan TEXT,
  momentum TEXT,
  ai_usage_quota INTEGER,
  ...
)
```

#### Keywords & Embeddings
```sql
-- Normalized keywords from all sources
keywords (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,
  demand_score NUMERIC,
  competition_score NUMERIC,
  trend_momentum NUMERIC,
  extras JSONB  -- Intent, persona, etc.
)

-- Vector embeddings for semantic search
embeddings (
  id BIGSERIAL PRIMARY KEY,
  keyword_id BIGINT REFERENCES keywords,
  model TEXT,
  vector vector(3072),  -- pgvector type
  hash TEXT UNIQUE
)

CREATE INDEX ON embeddings USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

#### Watchlists & Monitoring
```sql
watchlists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT,
  type TEXT  -- 'keyword' or 'listing'
)

watchlist_items (
  id BIGSERIAL PRIMARY KEY,
  watchlist_id BIGINT REFERENCES watchlists,
  item_type TEXT,
  item_id BIGINT,
  metadata JSONB
)

-- SERP position tracking
etsy_serp_samples (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT,
  listing_id BIGINT,
  position INTEGER,
  sampled_at TIMESTAMPTZ
)
```

#### Marketplace Data
```sql
-- Normalized listings from all marketplaces
listings (
  id BIGSERIAL PRIMARY KEY,
  marketplace TEXT,  -- 'etsy', 'amazon', etc.
  external_id TEXT,
  title TEXT,
  price NUMERIC,
  tags TEXT[],
  ...
)

listing_tags (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT REFERENCES listings,
  tag TEXT,
  performance_score NUMERIC
)
```

### Database Indexes

Critical indexes for performance:

```sql
-- Keyword search
CREATE INDEX idx_keywords_term ON keywords USING gin(term gin_trgm_ops);
CREATE INDEX idx_keywords_demand ON keywords(demand_score DESC);

-- Vector similarity search
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);

-- Time-series data
CREATE INDEX idx_serp_samples_time ON etsy_serp_samples(sampled_at DESC);
CREATE INDEX idx_trend_series_time ON trend_series(date DESC);

-- User queries
CREATE INDEX idx_watchlists_user ON watchlists(user_id);
CREATE INDEX idx_user_profiles_plan ON user_profiles(plan);
```

## 🤖 AI/ML Pipeline

### 1. Embedding Generation

**Model**: OpenAI `text-embedding-3-large` (3,072 dimensions)

```typescript
// src/lib/ai/embeddings.ts
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: normalizeKeywordTerm(text),
  });
  return response.data[0].embedding;
}
```

**Process**:
1. Normalize keyword text (lowercase, trim, collapse spaces)
2. Generate SHA-256 hash (model + term) for caching
3. Check database for existing embedding
4. If missing, call OpenAI API
5. Store embedding in `embeddings` table with pgvector index

### 2. Semantic Search

**Algorithm**: Cosine similarity with pgvector

```sql
-- Find similar keywords
SELECT k.term, 1 - (e.vector <=> query_vector) AS similarity
FROM keywords k
JOIN embeddings e ON k.id = e.keyword_id
WHERE e.model = 'text-embedding-3-large'
ORDER BY e.vector <=> query_vector
LIMIT 50;
```

**Performance**:
- IVFFlat index for approximate nearest neighbor (ANN)
- Sub-100ms queries on datasets with 1M+ vectors
- Trade-off: 90%+ recall with 10x speed improvement

### 3. Intent Classification

**Model**: GPT-4 with structured prompts

```typescript
// src/lib/ai/intent-classifier.ts
const prompt = `Classify this keyword into intent categories:
- Intent: [commercial, informational, navigational, transactional]
- Funnel Stage: [awareness, consideration, decision]
- Persona: [hobbyist, professional, business]

Keyword: "${keyword}"
Output JSON only.`;
```

**Caching**: Results stored in `keywords.extras` JSONB field

### 4. Tag Optimization

**Model**: GPT-4 for suggestions

```typescript
// src/lib/tags/optimizer.ts
async function optimizeTags(listing: Listing): Promise<Suggestion[]> {
  const prompt = `Given this listing:
Title: ${listing.title}
Current tags: ${listing.tags.join(", ")}
Target: Etsy search visibility

Suggest:
1. Tags to add (high-demand, low-competition)
2. Tags to remove (irrelevant, too competitive)
3. Tags to keep (performing well)

Output as JSON array.`;

  return await callGPT(prompt);
}
```

## 🔄 Data Pipelines

### Background Jobs

**Orchestration**: GitHub Actions + Vercel Cron

#### 1. Embedding Generation
```yaml
# Schedule: Hourly
POST /api/jobs/embed-missing
```
- Finds keywords without embeddings
- Generates embeddings in batches (100/request)
- Handles rate limiting and retries

#### 2. Trend Aggregation
```yaml
# Schedule: Every 6 hours
POST /api/jobs/trend-aggregation
```
- Aggregates trends from Google, Pinterest, Reddit
- Updates `trend_series` and `keywords.trend_momentum`
- Detects anomalies and emerging trends

#### 3. Intent Classification
```yaml
# Schedule: Daily at 02:00 UTC
POST /api/jobs/intent-classify
```
- Classifies unclassified keywords
- Batches 50 keywords per GPT request
- Stores results in `keywords.extras`

#### 4. Cluster Rebuilding
```yaml
# Schedule: Daily at 03:00 UTC
POST /api/jobs/rebuild-clusters
```
- K-means clustering on embeddings
- Generates cluster labels with GPT
- Updates `concept_clusters` table

#### 5. Etsy Data Sync
```yaml
# Schedule: Every 6 hours (staggered)
POST /api/jobs/etsy-ingest
```
- Syncs listings, tags, shop metadata
- Upserts to `listings` and related tables
- Tracks sync state in `provider_sync_states`

### Scraping Pipeline

**Technology**: Playwright for browser automation

```typescript
// scripts/etsy-scraper.mjs
import { chromium } from "playwright";

async function scrapeEtsySearch(keyword: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`https://www.etsy.com/search?q=${encodeURIComponent(keyword)}`);

  const listings = await page.$$eval(".listing-card", cards =>
    cards.map(card => ({
      title: card.querySelector(".title")?.textContent,
      price: card.querySelector(".price")?.textContent,
      url: card.querySelector("a")?.href,
    }))
  );

  await browser.close();
  return listings;
}
```

**Features**:
- Rotating proxies (future)
- Rate limiting per source
- Failure detection and alerting
- Data quality validation

## 🔐 Security Architecture

### Authentication

**Provider**: Supabase Auth (JWT tokens)

```typescript
// Server-side auth check
import { createServerClient } from "@supabase/ssr";

const supabase = createServerClient(/* config */);
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  return new Response("Unauthorized", { status: 401 });
}
```

### Authorization

**Row-Level Security (RLS)** in PostgreSQL:

```sql
-- Users can only see their own watchlists
CREATE POLICY "Users see own watchlists"
  ON watchlists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin users can see all
CREATE POLICY "Admins see all watchlists"
  ON watchlists
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND plan = 'admin'
  ));
```

### API Security

1. **Rate Limiting**: (To be implemented - see Sprint 1)
   - Per-user limits based on plan
   - IP-based limits for anonymous requests

2. **Input Validation**: Zod schemas
   ```typescript
   const schema = z.object({
     keyword: z.string().min(1).max(100),
     limit: z.number().int().min(1).max(100).optional(),
   });

   const input = schema.parse(await request.json());
   ```

3. **SQL Injection Protection**: Parameterized queries only
   ```typescript
   // ✅ Safe
   const { data } = await supabase
     .from("keywords")
     .select("*")
     .eq("term", userInput);

   // ❌ Never do this
   const query = `SELECT * FROM keywords WHERE term = '${userInput}'`;
   ```

### Secrets Management

- **Environment variables** for all secrets
- **Vercel secrets** for production
- **No secrets in code** or version control
- **Principle of least privilege** for service accounts

## 🚀 Deployment Architecture

### Vercel Platform

```
┌─────────────────────────────────────────────┐
│          Vercel Edge Network                │
│  (CDN for static assets, Edge functions)    │
└────────────┬────────────────────────────────┘
             │
     ┌───────┴──────────┐
     │                  │
┌────▼─────┐      ┌─────▼────┐
│  Region  │      │  Region  │
│   iad1   │      │  sfo1    │
│(US East) │      │(US West) │
└──────────┘      └──────────┘
```

### Serverless Functions

- **Runtime**: Node.js 20.x
- **Memory**: 1024 MB (configurable)
- **Timeout**: 10s (API routes), 5m (background jobs)
- **Cold start**: ~200ms (optimized with bundling)

### Database

- **Provider**: Supabase
- **Region**: US East (co-located with Vercel)
- **Connection**: Connection pooling via Supavisor
- **Backups**: Automated daily, retained 7 days

## 📊 Monitoring & Observability

### Current

- **Vercel Analytics**: Page views, Web Vitals
- **Supabase Logs**: Database queries, errors
- **Console logging**: (To be replaced - see Sprint 1)

### Planned (Sprint 1)

- **Structured Logging**: Winston/Pino with context
- **Error Tracking**: Sentry
- **APM**: OpenTelemetry or Vercel Speed Insights
- **Custom Metrics**: Prometheus + Grafana
- **Alerting**: PagerDuty or Slack webhooks

## 🔧 Development Patterns

### Error Handling

```typescript
// API routes
export async function POST(request: NextRequest) {
  try {
    const result = await operation();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    logger.error("Operation failed", { error, context });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Caching Strategy

1. **Database queries**: Supabase built-in caching
2. **API responses**: `Cache-Control` headers
3. **Vector embeddings**: Cached in database
4. **Feature flags**: In-memory cache (60s TTL)
5. **AI responses**: Cached in `keywords.extras` and `keyword_insights_cache`

### Performance Optimization

1. **Database**: Indexes on hot paths, connection pooling
2. **API**: Response compression, pagination
3. **Frontend**: Code splitting, lazy loading, image optimization
4. **AI**: Batch processing, embedding caching
5. **CDN**: Static assets on Vercel Edge Network

## 📈 Scalability

### Current Limits

- **Database**: 100GB storage, 10K connections (Supabase Pro)
- **API**: 1000 req/s per region (Vercel Pro)
- **OpenAI**: 3500 req/min (Tier 4)

### Scaling Strategies

1. **Horizontal**: Multiple Vercel regions
2. **Database**: Read replicas for analytics queries
3. **Caching**: Redis/Upstash for hot data
4. **Job Queue**: BullMQ for background jobs
5. **CDN**: Cloudflare for static assets

## 🧪 Testing Strategy

### Unit Tests

- **Framework**: Vitest
- **Coverage**: 40% minimum (lines, functions, statements)
- **Location**: `src/lib/__tests__/`
- **Mocking**: `vi.mock()` for external dependencies

### Integration Tests

- **Scope**: API routes with mocked database
- **Pattern**: Test request → handler → response
- **Location**: `tests/integration/`

### E2E Tests

- **Framework**: Playwright Test
- **Browsers**: Chromium, Firefox, WebKit
- **Location**: `tests/e2e/`
- **CI**: Run on every PR

## 🔄 Data Flow Examples

### Keyword Search Flow

```
User Input
  ↓
[Client] Keyword Search Form
  ↓ (POST /api/keywords/search)
[API] Validate + Auth
  ↓
[AI] Generate query embedding (OpenAI)
  ↓
[DB] Vector similarity search (pgvector)
  ↓
[AI] Generate insights (GPT - cached)
  ↓
[API] Format response
  ↓
[Client] Display results
```

### Listing Optimization Flow

```
User uploads listing
  ↓
[API] POST /api/ai/tag-optimizer
  ↓
[AI] Analyze title, tags, image (GPT)
  ↓
[DB] Fetch similar high-performing listings
  ↓
[AI] Generate suggestions (GPT)
  ↓
[DB] Cache suggestions
  ↓
[Client] Display recommendations
```

## 🛣️ Future Architecture

### Microservices (Optional)

For higher scale, consider breaking out:
- **Scraping Service**: Dedicated infrastructure for web scraping
- **AI Service**: Batch processing for embeddings and classification
- **Analytics Service**: Data warehouse for reporting

### Event-Driven Architecture

- **Message Queue**: RabbitMQ or AWS SQS
- **Event Bus**: For decoupling services
- **CQRS**: Separate read and write models

---

**For implementation details, see relevant files in `/src` and `/docs`.**
