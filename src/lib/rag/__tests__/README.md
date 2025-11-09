# RAG Testing Guide

## Unit Tests

Run unit tests with:

```bash
npm test src/lib/rag/__tests__
```

## Manual Testing

### Prerequisites

1. Set environment variables:
   ```bash
   HF_TOKEN=your_huggingface_token
   LEXYBRAIN_RAG_MODEL_ID=meta-llama/Llama-3.1-70B-Instruct
   ```

2. Ensure you're authenticated in the app

### Test Cases

#### 1. Basic RAG Request

```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "message": "What are the top trending keywords in the wedding niche?",
    "capability": "market_brief"
  }'
```

Expected response:
- `threadId`: New thread UUID
- `messageId`: Assistant message UUID
- `answer`: Generated text based on retrieved keywords
- `sources`: Array of keyword sources with scores
- `flags.usedRag`: true
- `flags.fallbackToGeneric`: false

#### 2. Multi-turn Conversation

First message:
```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "message": "Tell me about vintage jewelry market"
  }'
```

Save the `threadId` from response.

Second message (using same thread):
```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "threadId": "thread-id-from-first-request",
    "message": "What are the top competitors in this niche?"
  }'
```

Expected: Response should reference context from first message.

#### 3. Test with Structured Context

```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "message": "Analyze these keywords",
    "context": {
      "keywordIds": ["keyword-uuid-1", "keyword-uuid-2"],
      "marketplaces": ["etsy"]
    }
  }'
```

Expected: Response should reference the specific keywords provided.

#### 4. Test Quota Enforcement

Make 51 requests rapidly (if on free plan):

```bash
for i in {1..51}; do
  curl -X POST http://localhost:3000/api/lexybrain/rag \
    -H "Content-Type: application/json" \
    -H "Cookie: your-auth-cookie" \
    -d '{"message": "Test '$i'"}'
done
```

Expected: 51st request should return 403 with quota_exceeded error.

#### 5. Test Insufficient Context

```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "message": "Tell me about xyz123nonexistentkeyword"
  }'
```

Expected:
- `flags.insufficientContext`: true
- `answer`: Should mention lack of data

#### 6. Test Authentication Failure

```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test without auth"
  }'
```

Expected: 401 Unauthorized

#### 7. Test Invalid Request

```bash
curl -X POST http://localhost:3000/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "message": ""
  }'
```

Expected: 422 Validation Error (message must be 1-4000 chars)

#### 8. Test All Capabilities

Test each capability explicitly:

```bash
# Market Brief
curl ... -d '{"message": "Market brief for vintage", "capability": "market_brief"}'

# Competitor Intel
curl ... -d '{"message": "Who are my competitors?", "capability": "competitor_intel"}'

# Keyword Explanation
curl ... -d '{"message": "Explain this keyword", "capability": "keyword_explanation"}'

# Alert Explanation
curl ... -d '{"message": "Why this alert?", "capability": "alert_explanation"}'

# General Chat
curl ... -d '{"message": "How does LexyHub work?", "capability": "general_chat"}'
```

## Integration Tests

Integration tests require:
1. Running Supabase instance
2. Test database with migrations applied
3. Test user account
4. HuggingFace API access

Create integration tests in `/src/app/api/lexybrain/rag/__tests__/` when ready.

## Performance Testing

Monitor latency for each step:

```bash
# Check logs for timing breakdown
grep "rag_request_complete" logs.json | jq '{
  total: .total_latency_ms,
  retrieval: .retrieval_latency_ms,
  generation: .generation_latency_ms
}'
```

Expected targets:
- Retrieval: <500ms
- Generation: <10s
- Total: <12s

## Monitoring

Check Sentry for any errors:
- Tags: `feature:rag`, `component:rag-endpoint`
- Look for `rag_request_error` events

Check database for usage:
```sql
SELECT * FROM ai_usage_events WHERE type = 'rag_message' ORDER BY ts DESC LIMIT 10;
SELECT * FROM rag_threads WHERE user_id = 'your-user-id';
SELECT * FROM rag_messages WHERE thread_id = 'test-thread-id';
```
