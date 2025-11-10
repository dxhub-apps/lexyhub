# Workflow Architecture

This document explains how workflows interact with the LexHub application and each other.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                               │
│                      (Workflow Orchestration)                        │
└────────────┬───────────────────────────────────────┬────────────────┘
             │                                       │
    ┌────────▼─────────┐                   ┌────────▼─────────┐
    │  Data Collection │                   │  Code Quality    │
    │    Workflows     │                   │    Workflows     │
    └────────┬─────────┘                   └────────┬─────────┘
             │                                       │
┌────────────▼────────────────┐           ┌─────────▼──────────┐
│ External Data Sources       │           │ Validation Gates   │
├─────────────────────────────┤           ├────────────────────┤
│ • Etsy OpenAPI v3           │           │ • Build & Type     │
│ • Etsy Web (Playwright)     │           │ • Lint & Format    │
│ • Reddit API                │           │ • Unit Tests       │
│ • Search Results (SERPs)    │           │ • E2E Tests        │
└────────────┬────────────────┘           │ • Security Scan    │
             │                            │ • Bundle Analysis  │
             │                            └────────────────────┘
             │
    ┌────────▼─────────┐
    │   Raw Keywords   │
    │   & Listings     │
    └────────┬─────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Database                       │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  • keywords (term, source, market, extras)                  │
│  • listings (external_listing_id, title, tags)              │
│  • keyword_serp_samples (position, metrics, snapshot)       │
│  • trend_series (term, source, momentum, recorded_on)       │
│  • concept_clusters (label, members, centroid_vector)       │
│  • embeddings (text, vector, model)                         │
│  • job_runs (job_name, status, started_at, finished_at)     │
│  • schema_migrations_ci (git_sha, actor, workflow, status)  │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────▼─────────┐
    │  Enrichment Jobs │
    │  (Background)    │
    └────────┬─────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│               Background Processing Pipeline                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. embed-missing                                            │
│     └─> Generate embeddings for keywords (OpenAI)           │
│         └─> Store in: embeddings table                      │
│                                                              │
│  2. intent-classify                                          │
│     └─> Classify search intent (OpenAI)                     │
│         └─> Update: keywords.extras.classification          │
│             • intent (informational/transactional/etc)       │
│             • purchaseStage (awareness/consideration/etc)    │
│             • persona                                        │
│             • confidence score                               │
│                                                              │
│  3. rebuild-clusters                                         │
│     └─> Cluster keywords by semantic similarity             │
│         └─> Store in: concept_clusters table                │
│             • centroid_vector                                │
│             • label (AI-generated)                           │
│             • members (keyword list)                         │
│             • stats (momentum, intents)                      │
│                                                              │
│  4. trend-aggregation                                        │
│     └─> Calculate trend momentum                            │
│         └─> Update: keywords.trend_momentum, keywords.extras│
│             • momentum score                                 │
│             • expected_growth_30d                            │
│             • contributors                                   │
│         └─> Persist daily rows in trend_series table         │
│             • recorded_on (DATE)                             │
│             • trend_score (NUMERIC)                          │
│             • velocity (NUMERIC)                             │
│             • expected_growth_30d (NUMERIC)                  │
│                                                              │
│  5. demand-trend (separate workflow)                         │
│     └─> Ingest metrics & score keywords                     │
│         └─> Analyze: search volume, competition, seasonality│
│                                                              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Enriched Keyword Data                       │
├─────────────────────────────────────────────────────────────┤
│  Each keyword now has:                                       │
│  ✓ Semantic embedding (vector)                              │
│  ✓ Search intent classification                             │
│  ✓ Cluster membership                                       │
│  ✓ Trend momentum score                                     │
│  ✓ Competition & demand metrics                             │
│  ✓ SERP analysis data                                       │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   LexHub Application                         │
├─────────────────────────────────────────────────────────────┤
│  Features powered by enriched data:                          │
│  • Keyword search & filtering                               │
│  • Trend analysis & forecasting                             │
│  • Semantic keyword clustering                              │
│  • Intent-based recommendations                             │
│  • Competition analysis                                     │
│  • Tag optimization                                         │
│  • Market opportunity scoring                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: From Collection to Enrichment

### Phase 1: Collection (Multiple Sources)

```
┌──────────────────┐
│ Etsy Keyword     │  Schedule: 08:30 UTC daily
│ Suggestions      ├──► Keywords from autocomplete
└──────────────────┘

┌──────────────────┐
│ Etsy Scraper     │  Schedule: 09:00 UTC daily
│ (OpenAPI v3)     ├──► Listings, tags, metadata
└──────────────────┘

┌──────────────────┐
│ Etsy Best        │  Schedule: 09:00 UTC daily
│ Sellers          ├──► Top products & tags
└──────────────────┘

┌──────────────────┐
│ Reddit           │  Schedule: Every 3 hours
│ Discovery        ├──► Community keywords & trends
└──────────────────┘

┌──────────────────┐
│ SERP Sampler     │  Schedule: 05:15 UTC daily
│                  ├──► Competition data, tag analysis
└──────────────────┘
            │
            └──────────┬──────────────┐
                       ▼              ▼
                  ┌─────────┐   ┌─────────┐
                  │keywords │   │listings│
                  │  table  │   │  table │
                  └─────────┘   └─────────┘
```

### Phase 2: Enrichment (AI-Powered Analysis)

```
Background Jobs Workflow (03:30 UTC)
═══════════════════════════════════════

Step 1: embed-missing
┌──────────────────────────────────┐
│ For keywords without embeddings: │
│ 1. Call OpenAI Embeddings API    │
│ 2. Generate 1536-dim vector      │
│ 3. Store in embeddings table     │
└──────────────────────────────────┘
            │
            ▼
Step 2: intent-classify
┌──────────────────────────────────┐
│ For unclassified keywords:       │
│ 1. Analyze with GPT-4            │
│ 2. Determine:                    │
│    • Search intent               │
│    • Purchase stage              │
│    • Buyer persona               │
│ 3. Store in keywords.extras      │
└──────────────────────────────────┘
            │
            ▼
Step 3: rebuild-clusters
┌──────────────────────────────────┐
│ 1. Fetch keyword embeddings      │
│ 2. Run k-means clustering        │
│ 3. Generate AI cluster labels    │
│ 4. Store in concept_clusters     │
└──────────────────────────────────┘
            │
            ▼
Step 4: trend-aggregation
┌──────────────────────────────────┐
│ 1. Analyze trend_series data     │
│ 2. Calculate momentum scores     │
│ 3. Project 30-day growth         │
│ 4. Update keywords.trend_momentum│
└──────────────────────────────────┘
```

### Phase 3: Scoring (Demand Analysis)

```
Demand Trend Workflow (05:55 UTC)
═════════════════════════════════

┌──────────────────────────────────┐
│ 1. Fetch keywords from past 7d   │
│ 2. Calculate demand scores:      │
│    • Search volume trends        │
│    • Competition levels          │
│    • Seasonality patterns        │
│    • Momentum indicators         │
│ 3. AI-enhanced scoring (GPT-4)   │
│ 4. Update keyword metrics        │
└──────────────────────────────────┘
```

---

## Workflow Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                    Trigger Events                            │
└───┬─────────────┬─────────────┬─────────────┬───────────────┘
    │             │             │             │
    ▼             ▼             ▼             ▼
Schedule     Git Push      PR Events    Manual Trigger
  │             │             │             │
  │             │             │             │
  ▼             ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────────┐
│Data    │  │Release │  │PR      │  │Supabase    │
│Collection│ │Mgmt    │  │Checks  │  │Run One    │
└───┬────┘  └───┬────┘  └───┬────┘  └────────────┘
    │           │           │
    │           │           │
    ▼           ▼           ▼
┌─────────────────────────────────┐
│        Supabase Database         │
│  ┌──────────────────────────┐   │
│  │ Tables                    │   │
│  │ • keywords                │   │
│  │ • listings                │   │
│  │ • keyword_serp_samples    │   │
│  │ • trend_series            │   │
│  │ • concept_clusters        │   │
│  │ • embeddings              │   │
│  │ • job_runs                │   │
│  └──────────────────────────┘   │
└────────────┬────────────────────┘
             │
             ▼
    ┌────────────────┐
    │ Background Jobs│ (Scheduled: 03:30 UTC)
    │ Orchestrator   │
    └────┬───────────┘
         │
         ├─────► POST /api/jobs/embed-missing
         ├─────► POST /api/jobs/intent-classify
         ├─────► POST /api/jobs/rebuild-clusters
         └─────► POST /api/jobs/trend-aggregation
                    │
                    ▼
            ┌────────────────┐
            │ API Routes     │
            │ (Next.js)      │
            └────┬───────────┘
                 │
                 ├─► OpenAI API (embeddings, GPT-4)
                 ├─► Supabase (read/write)
                 └─► Job tracking (job_runs table)
```

---

## Job Execution Flow

### Background Jobs Workflow Detailed Flow

```
1. TRIGGER (03:30 UTC daily or manual)
   │
   ▼
2. VALIDATE CONFIGURATION
   │
   ├─► Check: LEXYHUB_APP_URL exists
   ├─► Check: SERVICE_TOKEN (optional)
   └─► Determine active endpoints
   │
   ▼
3. FOR EACH JOB ENDPOINT:
   │
   ├─► trend-aggregation
   │   ├─► POST https://lexyhub.app/api/jobs/trend-aggregation
   │   ├─► Headers: Authorization, Content-Type
   │   ├─► Response: { processed: N, keywordsUpdated: M }
   │   └─► Save to logs/trend-aggregation.json
   │
   ├─► intent-classify
   │   ├─► POST https://lexyhub.app/api/jobs/intent-classify
   │   ├─► Batch size: 40 keywords (unclassified)
   │   ├─► OpenAI calls: ~40 (one per keyword)
   │   ├─► Response: { processed: N }
   │   └─► Save to logs/intent-classify.json
   │
   ├─► rebuild-clusters
   │   ├─► POST https://lexyhub.app/api/jobs/rebuild-clusters
   │   ├─► Fetch: 80 recent keyword embeddings
   │   ├─► Cluster: k = max(2, min(8, N/10))
   │   ├─► OpenAI: Generate cluster labels
   │   ├─► Response: { clusters: K, members: N }
   │   └─► Save to logs/rebuild-clusters.json
   │
   └─► embed-missing
       ├─► POST https://lexyhub.app/api/jobs/embed-missing
       ├─► Batch size: 50 keywords (no embedding)
       ├─► OpenAI: text-embedding-3-small
       ├─► Response: { processed: N, count: N }
       └─► Save to logs/embed-missing.json
   │
   ▼
4. UPLOAD ARTIFACTS
   │
   └─► Upload logs/ directory as artifact
   │
   ▼
5. REPORT STATUS
   │
   ├─► If all jobs 2xx: ✅ Success
   └─► If any job non-2xx: ❌ Failure
```

---

## API Endpoint Architecture

### Job API Routes

All job endpoints follow this pattern:

```typescript
// src/app/api/jobs/{endpoint}/route.ts

export async function POST(): Promise<NextResponse> {
  // 1. Initialize Supabase client
  const supabase = getSupabaseServerClient();

  // 2. Create job run record
  const jobRunId = await createJobRun(supabase, "job-name");

  try {
    // 3. Fetch data from database
    const data = await supabase.from('table').select('*');

    // 4. Process each item
    for (const item of data) {
      // AI processing, calculations, etc.
      await processItem(item);
    }

    // 5. Update database with results
    await supabase.from('table').update({ ... });

    // 6. Mark job as succeeded
    await finalizeJobRun(supabase, jobRunId, "succeeded", {
      processed: count,
    });

    return NextResponse.json({ processed: count });

  } catch (error) {
    // 7. Mark job as failed
    await finalizeJobRun(supabase, jobRunId, "failed", {
      error: error.message,
    });

    return NextResponse.json({ error }, { status: 500 });
  }
}
```

### Job Run Tracking

Every background job execution is tracked:

```sql
-- Table: job_runs
CREATE TABLE job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running', 'succeeded', 'failed'
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example record
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "job_name": "intent-classify",
  "status": "succeeded",
  "started_at": "2025-11-05T03:30:00Z",
  "finished_at": "2025-11-05T03:32:15Z",
  "metadata": {
    "processed": 35,
    "errors": 0
  }
}
```

---

## Data Models

### Keyword Data Structure

```typescript
interface Keyword {
  id: string;
  term: string;
  source: string; // 'etsy', 'reddit', 'manual', etc.
  market: string; // 'etsy', 'amazon', 'shopify', etc.

  // Core metrics
  search_volume?: number;
  competition_score?: number;
  trend_momentum?: number;

  // Flags
  allow_search_sampling: boolean;

  // Enriched data (JSONB)
  extras: {
    classification?: {
      intent: string; // 'informational', 'transactional', etc.
      purchaseStage: string; // 'awareness', 'consideration', 'decision'
      persona: string;
      confidence: number;
      model: string;
      updatedAt: string;
    };
    trend?: {
      momentum: number;
      expectedGrowth30d: number;
      contributors: string[];
      updatedAt: string;
    };
  };

  created_at: string;
  updated_at: string;
}
```

### SERP Sample Data Structure

```typescript
interface KeywordSerpSample {
  id: string;
  keyword_id: string;
  listing_id?: string;
  source: string; // 'etsy_serp'
  position?: number; // 1-based position in results
  url?: string;
  title?: string;
  tags: string[];
  total_results?: number;

  // Derived metrics
  derived_metrics: {
    competition: number | null; // 0-1 normalized
    coverage: number; // Percentage of tracked listings
    tagReuse: number; // 0-1 tag overlap score
    trackedListingCount: number;
    totalListings: number;
  };

  // Full snapshot (JSONB)
  snapshot: {
    keyword: { id: string; term: string; market: string };
    listings?: Array<{
      etsyListingId: string;
      title: string;
      tags: string[];
      url: string;
      position: number;
    }>;
    serp?: {
      totalResults: number;
      totalResultsText: string;
      capturedAt: string;
      htmlChecksum: string;
      htmlSnippet: string;
    };
  };

  captured_at: string;
}
```

---

## External Dependencies

### OpenAI API Usage

```
Job: embed-missing
├─ Model: text-embedding-3-small
├─ Dimensions: 1536
├─ Cost: ~$0.00002 per 1K tokens
└─ Rate limit: 3,000 RPM (Tier 1)

Job: intent-classify
├─ Model: gpt-4-turbo
├─ Prompt: ~200 tokens
├─ Response: ~100 tokens
├─ Cost: ~$0.003 per request
└─ Rate limit: 500 RPM (Tier 1)

Job: rebuild-clusters
├─ Model: gpt-4-turbo
├─ Prompt: ~300 tokens (cluster members)
├─ Response: ~50 tokens (label + description)
├─ Cost: ~$0.003 per cluster
└─ Calls: 2-8 per run (number of clusters)
```

### Etsy API Usage

```
Workflow: etsy-scraper
├─ API: OpenAPI v3
├─ Endpoint: /v3/application/listings/active
├─ Rate limit: 10,000 requests/day
└─ Authentication: API key header

Workflow: etsy-best-sellers (Playwright)
├─ No API, web scraping
├─ Rate limit: None (be respectful)
└─ Risk: CAPTCHA challenges

Workflow: keyword-serp-sampler (Playwright)
├─ No API, web scraping
├─ Rate limit: None (be respectful)
└─ Risk: CAPTCHA challenges
```

### Reddit API Usage

```
Workflow: reddit-discovery
├─ API: Reddit OAuth2
├─ Rate limit: 60 requests/minute
├─ Authentication: OAuth2 client credentials
└─ Endpoints: /r/{subreddit}/search, /r/{subreddit}/hot
```

---

## Scalability Considerations

### Current Limits

- **Keywords/day:** ~500-1000 (from all sources)
- **SERP samples/day:** ~12 keywords
- **Embeddings/day:** ~50 new keywords
- **Intent classifications/day:** ~40 keywords
- **Clusters rebuilt/day:** 1 time (2-8 clusters)

### Bottlenecks

1. **OpenAI API costs** - Scales with keyword volume
2. **Playwright timeouts** - SERP sampling can be slow
3. **Database queries** - Large JSONB fields in extras
4. **GitHub Actions minutes** - Free tier: 2,000 min/month

### Optimization Strategies

1. **Batch Processing:** Process keywords in larger batches
2. **Caching:** Cache embeddings and classifications
3. **Sampling:** Don't re-sample stable keywords
4. **Indexing:** Add indexes on frequently queried fields
5. **Archiving:** Move old data to separate tables

---

## Security & Compliance

### Secrets Management

All secrets stored in GitHub Secrets (encrypted at rest):
- Database credentials
- API keys
- Service tokens
- Session cookies

### Data Privacy

- No PII collected from users
- Marketplace data is public information
- Reddit data from public subreddits only

### Rate Limiting

- Respect API rate limits
- Implement exponential backoff
- Monitor quota usage
- Fail gracefully on limits

### Error Handling

- Log errors but not sensitive data
- Retry transient failures
- Alert on critical failures
- Track error rates

---

## Monitoring & Observability

### Key Metrics to Track

1. **Workflow Success Rate**
   - Target: >95% success rate
   - Alert if: <90% over 7 days

2. **Keyword Growth Rate**
   - Track: New keywords/day
   - Target: 200-500/day

3. **Enrichment Coverage**
   - Embeddings: >90% of keywords
   - Classifications: >85% of keywords
   - Clusters: Updated daily

4. **API Costs**
   - OpenAI: Track token usage
   - Target: <$50/month

5. **Job Execution Time**
   - Background jobs: <15 minutes
   - SERP sampler: <30 minutes
   - Data collection: <10 minutes

### Dashboards

Recommended metrics to visualize:
- Workflow run history (success/fail)
- Keyword count over time
- Enrichment coverage percentages
- API cost trends
- Job execution times

---

**Architecture Version:** 1.0
**Last Updated:** 2025-11-05
**Related Docs:** [README.md](./README.md) | [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)
