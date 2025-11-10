# Database Optimization Guide

This document provides guidelines and best practices for optimizing database performance in LexyHub, specifically focusing on PostgreSQL with pgvector.

## Table of Contents

- [Index Strategy](#index-strategy)
- [Query Optimization](#query-optimization)
- [pgvector Performance](#pgvector-performance)
- [Connection Pooling](#connection-pooling)
- [Monitoring](#monitoring)
- [Recommended Indexes](#recommended-indexes)

## Index Strategy

### General Principles

1. **Index columns used in WHERE clauses**
2. **Index foreign keys**
3. **Index columns used for sorting (ORDER BY)**
4. **Consider composite indexes for multi-column queries**
5. **Don't over-index** - indexes slow down writes

### Index Types

#### B-tree Index (Default)
Best for equality and range queries.

```sql
CREATE INDEX idx_keywords_term ON keywords(term);
CREATE INDEX idx_keywords_demand_score ON keywords(demand_score DESC);
```

#### GIN Index
Best for full-text search and JSONB columns.

```sql
-- Full-text search
CREATE INDEX idx_keywords_term_gin ON keywords USING gin(to_tsvector('english', term));

-- JSONB columns
CREATE INDEX idx_keywords_extras ON keywords USING gin(extras);
```

#### GiST Index
Best for geometric data and advanced text search.

```sql
CREATE INDEX idx_listings_location ON listings USING gist(location);
```

#### IVFFlat Index (pgvector)
Best for vector similarity search.

```sql
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

## Query Optimization

### 1. Use EXPLAIN ANALYZE

Always analyze query plans:

```sql
EXPLAIN ANALYZE
SELECT * FROM keywords
WHERE demand_score > 80
  AND competition_score < 50
ORDER BY trend_momentum DESC
LIMIT 20;
```

Look for:
- **Seq Scan** → Might need an index
- **High cost numbers** → Inefficient query
- **Nested Loop** with large datasets → Consider hash or merge join

### 2. Avoid N+1 Queries

Bad (N+1 queries):
```typescript
const keywords = await supabase.from('keywords').select('*');
for (const keyword of keywords.data) {
  const embedding = await supabase
    .from('embeddings')
    .select('*')
    .eq('keyword_id', keyword.id);
}
```

Good (Single query with join):
```typescript
const { data } = await supabase
  .from('keywords')
  .select(`
    *,
    embeddings (*)
  `);
```

### 3. Use Appropriate Limits

Always paginate large result sets:

```typescript
const { data } = await supabase
  .from('keywords')
  .select('*')
  .range(0, 49) // Fetch 50 results
  .limit(50);
```

### 4. Select Only Needed Columns

Bad:
```typescript
const { data } = await supabase.from('keywords').select('*');
```

Good:
```typescript
const { data } = await supabase
  .from('keywords')
  .select('id, term, demand_score');
```

### 5. Use Prepared Statements

Supabase client automatically uses prepared statements, but for raw SQL:

```sql
PREPARE keyword_search (text) AS
  SELECT * FROM keywords WHERE term = $1;

EXECUTE keyword_search('handmade jewelry');
```

## pgvector Performance

### Index Configuration

```sql
-- Create IVFFlat index for approximate nearest neighbor
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);
```

**`lists` parameter guidelines**:
- Small dataset (<100k vectors): `lists = sqrt(rows)`
- Medium dataset (100k-1M): `lists = rows / 1000`
- Large dataset (>1M): `lists = rows / 500`

### Query Optimization

Use `SET` to optimize search:

```sql
-- Set number of lists to search (trade-off: speed vs accuracy)
SET ivfflat.probes = 10; -- Default is 1

-- Search for similar vectors
SELECT k.term, 1 - (e.vector <=> query_vector) AS similarity
FROM keywords k
JOIN embeddings e ON k.id = e.keyword_id
WHERE e.model = 'text-embedding-3-large'
ORDER BY e.vector <=> query_vector
LIMIT 50;
```

**Probes guidelines**:
- `probes = 1`: Fastest, ~85% recall
- `probes = 10`: Good balance, ~90% recall
- `probes = lists/2`: High accuracy, ~95% recall
- `probes = lists`: Exact search (no speed benefit)

### Distance Operators

- `<->` Euclidean distance (L2)
- `<#>` Negative inner product
- `<=>` Cosine distance (1 - cosine similarity)

**Use cosine distance for normalized embeddings** (OpenAI embeddings).

### Embedding Size Considerations

- OpenAI `text-embedding-3-large`: 3,072 dimensions
- Index size: ~12 KB per vector + overhead
- 1M vectors = ~12 GB index size

## Connection Pooling

### Supabase Configuration

Supabase automatically handles connection pooling via **Supavisor**.

#### Connection Limits

- **Direct connection**: Limited pool (default: 20 connections)
- **Transaction mode**: Better for long transactions
- **Session mode**: Better for connection reuse

### Optimization Tips

1. **Close connections properly**
   ```typescript
   // Connections auto-closed by Supabase client
   ```

2. **Use connection timeout**
   ```typescript
   const supabase = createClient(url, key, {
     db: {
       schema: 'public',
     },
     global: {
       headers: { 'x-connection-timeout': '30000' },
     },
   });
   ```

3. **Batch operations**
   ```typescript
   // Use batch inserts instead of individual
   const { data } = await supabase
     .from('keywords')
     .insert([keyword1, keyword2, keyword3]);
   ```

## Monitoring

### Key Metrics to Track

1. **Query Performance**
   - Average query time
   - Slow query log (>1s)
   - Most frequently executed queries

2. **Connection Stats**
   - Active connections
   - Waiting connections
   - Connection errors

3. **Index Usage**
   - Index hit rate (should be >95%)
   - Unused indexes
   - Index bloat

### Monitoring Queries

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Recommended Indexes

### Keywords Table

```sql
-- Primary key (auto-created)
-- id (bigserial PRIMARY KEY)

-- Search by term
CREATE INDEX idx_keywords_term ON keywords(term);
CREATE INDEX idx_keywords_term_lower ON keywords(lower(term));
CREATE INDEX idx_keywords_term_trgm ON keywords USING gin(term gin_trgm_ops);

-- Filter by scores
CREATE INDEX idx_keywords_demand_score ON keywords(demand_score DESC)
  WHERE demand_score IS NOT NULL;
CREATE INDEX idx_keywords_competition_score ON keywords(competition_score)
  WHERE competition_score IS NOT NULL;
CREATE INDEX idx_keywords_trend_momentum ON keywords(trend_momentum DESC)
  WHERE trend_momentum IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_keywords_scores ON keywords(demand_score DESC, competition_score, trend_momentum DESC)
  WHERE demand_score IS NOT NULL
    AND competition_score IS NOT NULL;

-- JSONB extras
CREATE INDEX idx_keywords_extras ON keywords USING gin(extras);
```

### Embeddings Table

```sql
-- Primary key
-- id (bigserial PRIMARY KEY)

-- Foreign key
CREATE INDEX idx_embeddings_keyword_id ON embeddings(keyword_id);

-- Unique constraint for hash
CREATE UNIQUE INDEX idx_embeddings_hash ON embeddings(hash);

-- Vector similarity (most important!)
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);

-- Filter by model
CREATE INDEX idx_embeddings_model ON embeddings(model);
```

### Watchlists & Items

```sql
-- Watchlists
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_type ON watchlists(type);

-- Watchlist items
CREATE INDEX idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_type_id ON watchlist_items(item_type, item_id);
```

### Time-Series Tables

```sql
-- Trend series
CREATE INDEX idx_trend_series_keyword_id ON trend_series(keyword_id);
CREATE INDEX idx_trend_series_date ON trend_series(date DESC);
CREATE INDEX idx_trend_series_keyword_date ON trend_series(keyword_id, date DESC);

-- SERP samples
CREATE INDEX idx_serp_samples_keyword ON etsy_serp_samples(keyword);
CREATE INDEX idx_serp_samples_listing_id ON etsy_serp_samples(listing_id);
CREATE INDEX idx_serp_samples_time ON etsy_serp_samples(sampled_at DESC);
CREATE INDEX idx_serp_samples_keyword_time ON etsy_serp_samples(keyword, sampled_at DESC);
```

### Listings

```sql
-- Listings
CREATE INDEX idx_listings_marketplace ON listings(marketplace);
CREATE INDEX idx_listings_external_id ON listings(marketplace, external_id);
CREATE INDEX idx_listings_user_id ON listings(user_id) WHERE user_id IS NOT NULL;

-- Listing tags
CREATE INDEX idx_listing_tags_listing_id ON listing_tags(listing_id);
CREATE INDEX idx_listing_tags_tag ON listing_tags(tag);
CREATE INDEX idx_listing_tags_performance ON listing_tags(performance_score DESC)
  WHERE performance_score IS NOT NULL;
```

### User Profiles

```sql
-- User profiles
CREATE INDEX idx_user_profiles_plan ON user_profiles(plan);
CREATE INDEX idx_user_profiles_momentum ON user_profiles(momentum);
```

## Performance Checklist

Before deploying to production:

- [ ] All foreign keys have indexes
- [ ] Frequently queried columns are indexed
- [ ] Vector indexes configured with appropriate `lists` value
- [ ] Composite indexes created for multi-column queries
- [ ] JSONB columns have GIN indexes if queried
- [ ] Unused indexes identified and removed
- [ ] EXPLAIN ANALYZE run on critical queries
- [ ] Connection pooling configured
- [ ] Slow query log enabled
- [ ] Monitoring dashboard set up

## Migration Example

```sql
-- migrations/XXX_add_performance_indexes.sql

-- Keywords optimization
CREATE INDEX CONCURRENTLY idx_keywords_term_lower
  ON keywords(lower(term));

CREATE INDEX CONCURRENTLY idx_keywords_scores
  ON keywords(demand_score DESC, competition_score, trend_momentum DESC)
  WHERE demand_score IS NOT NULL AND competition_score IS NOT NULL;

-- Embeddings optimization
CREATE INDEX CONCURRENTLY idx_embeddings_vector
  ON embeddings USING ivfflat (vector vector_cosine_ops)
  WITH (lists = 100);

-- Time-series optimization
CREATE INDEX CONCURRENTLY idx_trend_series_keyword_date
  ON trend_series(keyword_id, date DESC);

CREATE INDEX CONCURRENTLY idx_serp_samples_keyword_time
  ON etsy_serp_samples(keyword, sampled_at DESC);

-- Analyze tables
ANALYZE keywords;
ANALYZE embeddings;
ANALYZE trend_series;
ANALYZE etsy_serp_samples;
```

**Note**: Use `CONCURRENTLY` to avoid locking tables during index creation.

## Resources

- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/performance)
- [EXPLAIN ANALYZE Guide](https://www.postgresql.org/docs/current/using-explain.html)
