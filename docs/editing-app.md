# Editing Suite Documentation

> Comprehensive Etsy listing optimization tools with AI-powered insights

## Overview

The Editing Suite is a unified workflow for Etsy listing optimization that integrates listing intelligence, competitor benchmarking, and tag optimization. Built as a self-contained module within the Lexy app, it provides sellers with actionable insights to improve listing quality, analyze market competition, and optimize tag performance.

### Key Features

- **Listing Intelligence** - AI-powered quality audits analyzing sentiment, tone, readability, keyword density, and completeness
- **Competitor Analysis** - Market benchmarking with pricing insights, review analysis, and tag overlap detection
- **Tag Optimizer** - Data-driven tag recommendations using search volume, trends, and competition metrics

### Architecture

The suite follows a modular architecture:

```
/editing
├── layout.tsx                    # Shared layout with hero and navigation
├── page.tsx                      # Overview dashboard
├── listing-intelligence/         # Quality audit tool
├── competitor-analysis/          # Market benchmarking tool
└── tag-optimizer/                # Tag health and optimization tool

/components/editing
├── EditingNav.tsx               # Navigation component
├── ListingIntelligenceForm.tsx  # Listing quality form
├── CompetitorAnalysisForm.tsx   # Competitor input form
└── TagOptimizerForm.tsx         # Tag optimization form
```

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Features](#features)
   - [Listing Intelligence](#listing-intelligence)
   - [Competitor Analysis](#competitor-analysis)
   - [Tag Optimizer](#tag-optimizer)
4. [Technical Implementation](#technical-implementation)
5. [Data Model](#data-model)
6. [API Reference](#api-reference)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Database Setup

Run the editing suite migration after all previous migrations:

```sql
-- Location: supabase/migrations/0011_editing_suite.sql
-- Creates tables for:
-- - listing_quality_audits
-- - competitor_snapshots & competitor_snapshot_listings
-- - tag_catalog
-- - listing_tag_health & tag_optimizer_runs
```

### Environment Variables

The suite uses existing environment variables:

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Database connection | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service authentication | Yes |
| `OPENAI_API_KEY` | AI analysis (future use) | Optional |

See `docs/environment-setup.md` for configuration details.

### Analytics

Analytics events are tracked via `@vercel/analytics`:

- `listing.intelligence.run` - Quality audit completion
- `competitor.analysis.run` - Competitor analysis execution
- `tag.optimizer.run` - Tag optimization runs

Ensure analytics is enabled in your Vercel project settings.

---

## Getting Started

### Accessing the Suite

The Editing Suite is accessible at `/editing` within the authenticated app layout. Users can navigate to it via:

1. **Sidebar Navigation** - Click the "Editing" entry with pencil icon in `AppShell.tsx`
2. **Direct URL** - Navigate to `/editing` for the overview dashboard
3. **Sub-tools** - Direct access via `/editing/listing-intelligence`, `/editing/competitor-analysis`, or `/editing/tag-optimizer`

### Layout Structure

The suite uses a shared layout pattern:

```tsx
// src/app/(app)/editing/layout.tsx
- Wraps all editing pages
- Provides hero header with context
- Includes EditingNav for sub-navigation
- Applies `.editing-*` CSS classes
```

**Key Components:**

| Component | Purpose | Type |
|-----------|---------|------|
| `layout.tsx` | Shared wrapper with hero and navigation | Server Component |
| `EditingNav.tsx` | Tab navigation with active state tracking | Client Component |
| `page.tsx` | Overview dashboard with feature cards | Server Component |

### Navigation Flow

```
┌─────────────────────┐
│   AppShell Sidebar  │
│   [Editing Entry]   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  /editing           │
│  Overview Dashboard │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │  EditingNav     │ │
│ ├─────────────────┤ │
│ │ • Overview      │ │
│ │ • Intelligence  │ │
│ │ • Competitors   │ │
│ │ • Tag Optimizer │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### Styling

All editing suite styles are scoped under `.editing-*` prefixes in `src/app/globals.css`, ensuring:

- Consistent visual identity across the suite
- Isolation from other app sections
- Easy theming and customization
- Responsive design patterns

---

## Features

### Listing Intelligence

**Purpose:** AI-powered quality audits that analyze listing content for optimization opportunities.

#### What It Does

The Listing Intelligence tool evaluates Etsy listings across multiple quality dimensions:

- **Completeness** - Checks for missing attributes (materials, dimensions, categories)
- **Sentiment** - Analyzes emotional tone and positivity in descriptions
- **Readability** - Calculates Flesch reading ease scores
- **Tone** - Evaluates language style and professionalism
- **Intent** - Classifies listing purpose (gift, home, fashion, craft)
- **Keyword Density** - Identifies top performing keywords and gaps

#### User Workflow

1. **Input Data** - Enter listing details or provide a `listingId` to load from database
   - Title, description, tags
   - Materials, categories, price
   - Review count, rating, sales volume

2. **Analysis** - Submit for processing
   - Runs deterministic scoring algorithms
   - Generates weighted quality score (0-100)
   - Identifies specific improvement areas

3. **Results** - Review comprehensive scorecard
   - **Score Breakdown** - Individual metric performance
   - **Keyword Density** - Top performing terms by frequency
   - **Missing Attributes** - Gaps in listing metadata
   - **Quick Fixes** - Actionable improvement suggestions

#### Technical Implementation

**API Endpoint:** `POST /api/listings/intelligence`

**Request Parameters:**
```typescript
{
  listingId?: string;     // Optional: load from database
  title: string;
  description: string;
  tags: string[];
  materials?: string[];
  categories?: string[];
  price: number;
  reviewCount?: number;
  rating?: number;
  salesVolume?: number;
}
```

**Response:**
```typescript
{
  score: number;          // 0-100 quality score
  breakdown: {
    completeness: number;
    sentiment: number;
    readability: number;
    tone: number;
    intent: string;
    keywordDensity: number;
  };
  missingAttributes: string[];
  quickFixes: string[];
  keywordLeaders: Array<{ keyword: string; count: number }>;
}
```

**Core Algorithm** (`src/lib/listings/intelligence.ts`):

1. **Tokenization** - Split text and filter stopwords
2. **Keyword Extraction** - Calculate term frequency and density
3. **Readability** - Apply Flesch reading ease formula
4. **Sentiment Analysis** - Match against positive/negative word sets
5. **Tone Detection** - Analyze language patterns and formality
6. **Intent Classification** - Keyword-based category matching
7. **Completeness Check** - Validate required fields and metadata
8. **Score Composition** - Weighted combination of all metrics

**Database Storage:**
- Results saved to `listing_quality_audits` table
- Includes full input data, scores, and recommendations
- Enables historical tracking and trend analysis

**Analytics:**
- Event: `listing.intelligence.run`
- Metrics: quality score, missing attribute count

### Competitor Analysis

**Purpose:** Market benchmarking and competitive intelligence for Etsy search keywords and shops.

#### What It Does

The Competitor Analysis tool provides comprehensive market insights:

- **Pricing Intelligence** - Calculates quartiles, averages, and pricing ranges
- **Performance Metrics** - Analyzes reviews, ratings, and estimated sales
- **Content Patterns** - Extracts common phrases and adjectives across listings
- **Tag Overlap** - Identifies shared keywords and tag strategies
- **Market Saturation** - Classifies strong vs. weak competitors
- **Narrative Summary** - Generates strategic recommendations

#### User Workflow

1. **Define Scope** - Enter search keyword or shop name

2. **Add Competitors** - Input details for each competitor listing:
   - Title, price, tags
   - Review count, rating
   - Estimated sales volume
   - Image count

3. **Analyze Market** - Submit for processing
   - Statistical analysis of pricing and performance
   - Pattern extraction from titles and descriptions
   - Tag overlap calculation
   - Competitor ranking by composite score

4. **Review Insights** - Examine results across multiple dimensions:
   - **Market Summary** - KPIs and statistical benchmarks
   - **Shared Phrases** - Common bigrams and patterns
   - **Tag Analysis** - Overlapping keywords and gaps
   - **Competitor Ranking** - Sorted by performance metrics
   - **Strategic Guidance** - Narrative recommendations

#### Technical Implementation

**API Endpoint:** `POST /api/insights/competitors`

**Request Parameters:**
```typescript
{
  keyword: string;        // Search term or shop name
  competitors: Array<{
    title: string;
    price: number;
    reviewCount: number;
    rating: number;
    estimatedSales: number;
    tags: string[];
    imageCount: number;
  }>;
}
```

**Response:**
```typescript
{
  summary: {
    avgPrice: number;
    priceRange: { min: number; max: number; quartiles: number[] };
    avgReviews: number;
    avgRating: number;
    strongCompetitors: number;
    weakCompetitors: number;
  };
  sharedPhrases: Array<{ phrase: string; count: number }>;
  commonAdjectives: string[];
  tagOverlap: Array<{ tag: string; frequency: number }>;
  rankedListings: Array<{
    title: string;
    compositeScore: number;
    rank: number;
  }>;
  narrative: string;
}
```

**Core Algorithm** (`src/lib/insights/competitors.ts`):

1. **Statistical Analysis**
   - Calculate price quartiles and averages
   - Compute review and rating distributions
   - Identify outliers and trends

2. **Ranking System**
   - Composite score formula: `(reviews × 0.4) + (rating × 0.3) + (sales × 0.2) + (images × 0.1)`
   - Normalizes all metrics to 0-1 scale
   - Sorts competitors by final score

3. **Pattern Extraction**
   - Bigram extraction from titles (2-word phrases)
   - Filter phrases appearing in 2+ listings
   - Extract adjectives using heuristic patterns

4. **Tag Analysis**
   - Normalize tag formats (lowercase, trim)
   - Count tag frequency across listings
   - Calculate overlap percentages

5. **Classification**
   - **Strong:** reviews > 100 AND rating ≥ 4.5
   - **Weak:** reviews < 20 OR rating < 4.0
   - **Moderate:** Everything else

**Database Storage:**
- Snapshots saved to `competitor_snapshots` table
- Individual listing data in `competitor_snapshot_listings`
- Enables temporal analysis and trend tracking

**Analytics:**
- Event: `competitor.analysis.run`
- Metrics: keyword, competitor count, strong listing percentage

### Tag Optimizer

**Purpose:** Data-driven tag optimization using search volume, trends, and competition metrics.

#### What It Does

The Tag Optimizer evaluates and improves listing tags:

- **Health Scoring** - Rates each tag based on search demand and performance
- **Duplicate Detection** - Identifies redundant or similar tags
- **Low-Volume Warnings** - Flags tags with minimal search traffic
- **Smart Recommendations** - Suggests high-performing alternatives
- **Gap Analysis** - Identifies missing high-value tags
- **Historical Tracking** - Stores optimization runs for progress monitoring

#### User Workflow

1. **Input Tags** - Enter current listing tags
   - Manual input or load via `listingId`
   - Tags pulled from `listing_tags` table if ID provided

2. **Run Analysis** - Submit for evaluation
   - Cross-reference against `tag_catalog`
   - Calculate individual tag scores
   - Detect duplicates and low-performers
   - Generate replacement candidates

3. **Review Diagnostics** - Examine detailed results:
   - **Overall Health Score** - Composite 0-100 rating
   - **Tag-by-Tag Breakdown** - Individual scores and issues
   - **Duplicates** - Redundant tags to consolidate
   - **Low-Volume Tags** - Tags with poor search demand
   - **Recommendations** - Specific replacement suggestions
   - **High-Value Additions** - New tags to consider

4. **Apply Changes** - Implement suggestions in listing

#### Technical Implementation

**API Endpoints:**

**POST `/api/tags/health`** - Evaluate tag set
```typescript
Request: {
  listingId?: string;     // Optional: load from database
  tags: string[];         // Tags to analyze
}

Response: {
  overallScore: number;   // 0-100 health rating
  tagDiagnostics: Array<{
    tag: string;
    score: number;
    issues: string[];
    recommendations: string[];
  }>;
  duplicates: string[][];
  lowVolumeTags: string[];
  suggestedAdditions: Array<{
    tag: string;
    score: number;
    reason: string;
  }>;
}
```

**GET `/api/tags/health?listingId=<id>`** - Fetch stored diagnostics
```typescript
Response: {
  runId: string;
  timestamp: string;
  results: { /* same as POST response */ }
}
```

**Core Algorithm** (`src/lib/tags/optimizer.ts`):

1. **Catalog Indexing**
   - Load `tag_catalog` into memory
   - Build lookup maps for quick access
   - Index related tags for suggestions

2. **Tag Scoring**
   ```typescript
   score = (
     searchVolume * 0.5 +      // Search demand weight
     trendScore * 0.3 +         // Growth momentum
     (1 - competition) * 0.2    // Competition inverse
   ) * 100
   ```

3. **Duplicate Detection**
   - Normalize tags (lowercase, trim)
   - Detect exact matches
   - Identify semantic similarity (Levenshtein distance)
   - Group related duplicates

4. **Low-Volume Flagging**
   - Threshold: searchVolume < 100/month
   - Cross-check with catalog data
   - Flag missing catalog entries

5. **Recommendation Engine**
   - Find related tags from catalog
   - Calculate score improvement delta
   - Minimum improvement: +15 points
   - Rank by potential impact

6. **Gap Analysis**
   - Identify high-performing related tags
   - Exclude currently used tags
   - Suggest top 5 additions by score

**Database Storage:**
- Run summaries in `tag_optimizer_runs`
- Per-tag diagnostics in `listing_tag_health`
- Links to original `listing_tags` via `listingId`

**Analytics:**
- Event: `tag.optimizer.run`
- Metrics: health score, duplicate count, recommendations generated

---

## Data Model

### Database Schema

The Editing Suite uses six core tables in Supabase:

#### `listing_quality_audits`
**Purpose:** Historical record of listing intelligence analysis

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `listing_id` | UUID | Reference to listings table (nullable) |
| `user_id` | UUID | User who ran audit |
| `input_data` | JSONB | Raw listing data submitted |
| `score` | INTEGER | Overall quality score (0-100) |
| `breakdown` | JSONB | Individual metric scores |
| `missing_attributes` | TEXT[] | Detected gaps |
| `quick_fixes` | TEXT[] | Recommendations |
| `keyword_leaders` | JSONB | Top keywords by frequency |
| `created_at` | TIMESTAMP | Audit timestamp |

**Indexes:** `listing_id`, `user_id`, `created_at`

#### `competitor_snapshots`
**Purpose:** Aggregated competitor analysis results

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User who ran analysis |
| `keyword` | TEXT | Search term or shop name |
| `summary_stats` | JSONB | Pricing, reviews, ratings |
| `shared_phrases` | JSONB | Common bigrams |
| `tag_overlap` | JSONB | Tag frequency data |
| `narrative` | TEXT | Strategic summary |
| `competitor_count` | INTEGER | Number of listings analyzed |
| `created_at` | TIMESTAMP | Analysis timestamp |

**Indexes:** `user_id`, `keyword`, `created_at`

#### `competitor_snapshot_listings`
**Purpose:** Individual competitor listing details

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `snapshot_id` | UUID | Foreign key to competitor_snapshots |
| `title` | TEXT | Listing title |
| `price` | DECIMAL | Price in USD |
| `review_count` | INTEGER | Number of reviews |
| `rating` | DECIMAL | Star rating (0-5) |
| `estimated_sales` | INTEGER | Estimated monthly sales |
| `tags` | TEXT[] | Listing tags |
| `image_count` | INTEGER | Number of images |
| `composite_score` | DECIMAL | Calculated ranking score |
| `rank` | INTEGER | Position in results |

**Indexes:** `snapshot_id`, `composite_score`

#### `tag_catalog`
**Purpose:** Reference database of tag performance metrics

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tag` | TEXT | Normalized tag text (unique) |
| `search_volume` | INTEGER | Monthly search volume |
| `trend_score` | DECIMAL | Growth momentum (-1 to 1) |
| `competition` | DECIMAL | Competition level (0-1) |
| `related_tags` | TEXT[] | Semantic alternatives |
| `category` | TEXT | Tag category (optional) |
| `last_updated` | TIMESTAMP | Data freshness |

**Indexes:** `tag` (unique), `search_volume`, `category`

#### `listing_tag_health`
**Purpose:** Per-tag diagnostics from optimizer runs

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `run_id` | UUID | Foreign key to tag_optimizer_runs |
| `listing_id` | UUID | Reference to listings table (nullable) |
| `tag` | TEXT | Tag being evaluated |
| `score` | INTEGER | Health score (0-100) |
| `issues` | TEXT[] | Detected problems |
| `recommendations` | TEXT[] | Suggested alternatives |
| `created_at` | TIMESTAMP | Diagnostic timestamp |

**Indexes:** `run_id`, `listing_id`, `tag`

#### `tag_optimizer_runs`
**Purpose:** Summary of tag optimization executions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User who ran optimizer |
| `listing_id` | UUID | Reference to listings table (nullable) |
| `overall_score` | INTEGER | Composite health score (0-100) |
| `tags_analyzed` | INTEGER | Number of tags evaluated |
| `duplicates_found` | INTEGER | Duplicate count |
| `low_volume_count` | INTEGER | Low-volume tag count |
| `suggestions_made` | INTEGER | Recommendation count |
| `created_at` | TIMESTAMP | Run timestamp |

**Indexes:** `user_id`, `listing_id`, `created_at`

### Data Relationships

```
listings (existing)
    ↓
    ├── listing_quality_audits (1:many)
    ├── listing_tag_health (1:many)
    └── tag_optimizer_runs (1:many)

competitor_snapshots (1:many)
    ↓
    └── competitor_snapshot_listings

tag_optimizer_runs (1:many)
    ↓
    └── listing_tag_health

tag_catalog (standalone reference)
```

---

## API Reference

### Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/listings/intelligence` | POST | Analyze listing quality |
| `/api/insights/competitors` | POST | Benchmark competitors |
| `/api/tags/health` | POST | Evaluate tag set |
| `/api/tags/health` | GET | Fetch saved diagnostics |

### Authentication

All endpoints require authentication via Supabase session:

```typescript
// Client-side (automatically handled)
const { data, error } = await fetch('/api/listings/intelligence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

// Server-side (use service role key)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### Rate Limiting

Current limits (subject to change):

- 100 requests per user per hour
- 1000 requests per user per day
- Burst allowance: 10 requests per minute

### Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| 400 | Invalid request payload | Check required fields |
| 401 | Unauthorized | Verify authentication |
| 404 | Listing not found | Confirm listingId exists |
| 429 | Rate limit exceeded | Wait and retry |
| 500 | Server error | Check logs, contact support |

---

## Best Practices

### Tag Catalog Management

**Seeding Strategy:**
- Populate `tag_catalog` from keyword research tools (e.g., Google Keyword Planner, Etsy analytics)
- Include 3-5 `related_tags` per entry for optimal recommendations
- Update `search_volume` and `trend_score` monthly for accuracy
- Set realistic `competition` scores (0 = low, 1 = high saturation)

**Maintenance Schedule:**
```bash
# Monthly: Update search volumes and trends
# Quarterly: Review and expand related_tags
# Annually: Prune low-performing or obsolete tags
```

### Batch Processing

**Automated Audits:**

```typescript
// Example: Nightly listing audit job
const listingsToAudit = await getActiveListings();

for (const listing of listingsToAudit) {
  await fetch('/api/listings/intelligence', {
    method: 'POST',
    body: JSON.stringify({ listingId: listing.id })
  });

  // Rate limit friendly
  await sleep(1000);
}
```

**Benefits:**
- All APIs are idempotent (safe to rerun)
- Historical data accumulates over time
- Enables trend analysis and A/B testing

### Performance Optimization

**Database Queries:**
- Use indexes on `created_at` for time-based filtering
- Limit result sets with `LIMIT` clauses
- Cache `tag_catalog` in Redis for high-traffic scenarios

**Client-Side:**
- Debounce form submissions (500ms minimum)
- Implement loading states for better UX
- Show progress indicators for long-running analyses

### Deployment Checklist

Before deploying to production:

- [ ] Run `npm run build` to verify Next.js compilation
- [ ] Execute migration `0011_editing_suite.sql` on production database
- [ ] Seed `tag_catalog` with minimum 1000 entries
- [ ] Configure Vercel Analytics for event tracking
- [ ] Test all three tools end-to-end
- [ ] Verify sidebar navigation includes Editing entry
- [ ] Check responsive design on mobile devices
- [ ] Review error handling and user feedback
- [ ] Set up monitoring alerts for API errors

### Analytics Usage

**Tracking Adoption:**

Monitor these metrics in Vercel Analytics:

- `listing.intelligence.run` - Usage frequency, quality score distribution
- `competitor.analysis.run` - Market segments analyzed, competitor counts
- `tag.optimizer.run` - Health score improvements, recommendation acceptance

**Success Metrics:**

- Average quality score improvement over time
- Percentage of listings with health score > 70
- Reduction in duplicate tag usage
- Time saved vs. manual optimization

---

## Troubleshooting

### Common Issues

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `Tag catalog unavailable` | Empty `tag_catalog` table or connection failure | 1. Verify migration ran: `SELECT COUNT(*) FROM tag_catalog;`<br>2. Seed catalog with keyword data<br>3. Check Supabase connection |
| `Listing not found` | Invalid `listingId` or permission denied | 1. Confirm ID exists: `SELECT id FROM listings WHERE id = 'xxx';`<br>2. Verify user authentication<br>3. Check RLS policies |
| Missing quick fixes in UI | Insufficient listing detail for analysis | 1. Ensure description has 100+ characters<br>2. Include materials and categories<br>3. Add minimum 5 tags |
| Low tag scores across board | Outdated or empty catalog data | 1. Update `search_volume` and `trend_score` fields<br>2. Add more entries to catalog (target 1000+)<br>3. Verify `related_tags` are populated |
| Slow API responses | Database query performance issues | 1. Check index usage with `EXPLAIN ANALYZE`<br>2. Review connection pooling settings<br>3. Consider caching catalog in Redis |
| Analytics events not appearing | Vercel Analytics not configured | 1. Enable analytics in Vercel dashboard<br>2. Verify `@vercel/analytics` package installed<br>3. Check `VERCEL_ANALYTICS_ID` environment variable |
| Navigation not showing active state | Client-side routing issue | 1. Clear browser cache and reload<br>2. Verify `usePathname()` hook working<br>3. Check `.editing-nav-item--active` CSS class |
| Form submissions timing out | Large payload or network issues | 1. Reduce competitor count (max 20 recommended)<br>2. Check server logs for errors<br>3. Increase API timeout settings |

### Debugging Tips

**Enable Verbose Logging:**

```typescript
// Add to API routes for debugging
console.log('[EDITING] Request:', { listingId, tags });
console.log('[EDITING] Response:', { score, recommendations });
```

**Database Query Debugging:**

```sql
-- Check audit history
SELECT created_at, score, listing_id
FROM listing_quality_audits
WHERE user_id = 'xxx'
ORDER BY created_at DESC
LIMIT 10;

-- Verify catalog coverage
SELECT COUNT(*), AVG(search_volume)
FROM tag_catalog
WHERE search_volume > 0;

-- Review optimizer performance
SELECT overall_score, duplicates_found, suggestions_made
FROM tag_optimizer_runs
WHERE user_id = 'xxx'
ORDER BY created_at DESC
LIMIT 10;
```

**Network Inspection:**

1. Open browser DevTools → Network tab
2. Filter by `/api/` endpoints
3. Check request/response payloads
4. Review response times and status codes

### Getting Help

If issues persist:

1. **Check Documentation** - Review this guide and environment setup docs
2. **Search Issues** - Look for similar problems in GitHub issues
3. **Enable Debug Mode** - Set `DEBUG=true` in environment variables
4. **Collect Logs** - Gather API responses and database queries
5. **Contact Support** - Provide reproduction steps and logs

---

## Summary

The Editing Suite provides Etsy sellers with three powerful optimization tools:

1. **Listing Intelligence** - AI-powered quality audits for comprehensive listing analysis
2. **Competitor Analysis** - Market benchmarking with pricing and tag insights
3. **Tag Optimizer** - Data-driven tag recommendations for better search visibility

### Key Benefits

- **Unified Workflow** - All tools accessible from single `/editing` interface
- **Historical Tracking** - All analyses stored for trend analysis
- **Actionable Insights** - Specific recommendations, not just scores
- **Scalable Architecture** - API-first design supports automation
- **Analytics Integration** - Built-in usage tracking for product insights

### Next Steps

1. **Deploy** - Run migrations and seed tag catalog
2. **Test** - Verify all three tools with sample data
3. **Monitor** - Track usage via Vercel Analytics
4. **Iterate** - Refine catalog and scoring algorithms based on feedback
5. **Automate** - Set up batch processing for active listings

Keep the tag catalog and listing data fresh for the strongest insights. Regular updates ensure recommendations stay relevant as market conditions evolve.
