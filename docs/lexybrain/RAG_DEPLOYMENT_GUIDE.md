# Ask LexyBrain RAG - Deployment Guide

**Quick Start Guide for Production Deployment**

---

## Pre-Deployment Checklist

- [ ] Hugging Face account with API token
- [ ] Supabase project with migrations access
- [ ] Vercel project configured
- [ ] Access to production environment variables

---

## Step 1: Database Migration

### Staging Environment

```bash
# 1. Connect to staging Supabase
npx supabase link --project-ref your-staging-project

# 2. Push migration
npx supabase db push

# 3. Verify migration
npx supabase db diff

# Expected output: No pending migrations
```

### Production Environment

```bash
# 1. Connect to production Supabase
npx supabase link --project-ref your-production-project

# 2. Create backup first!
# Via Supabase dashboard: Database > Backups > Create Backup

# 3. Push migration
npx supabase db push

# 4. Verify tables created
npx supabase db execute "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name LIKE 'rag_%'
  ORDER BY table_name;
"

# Expected: rag_feedback, rag_messages, rag_threads
```

---

## Step 2: Environment Variables

### Required Variables

```bash
# Hugging Face
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Model IDs
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-8B-Instruct
LEXYBRAIN_RAG_MODEL_ID=meta-llama/Llama-3.1-70B-Instruct

# Optional
LEXYBRAIN_ENABLE=true
LEXYBRAIN_DAILY_COST_CAP=10000  # $100 in cents
```

### Set in Vercel

```bash
# Via CLI
vercel env add HF_TOKEN production
# Paste token when prompted

vercel env add LEXYBRAIN_RAG_MODEL_ID production
# Enter: meta-llama/Llama-3.1-70B-Instruct

# Or via dashboard
# https://vercel.com/your-org/lexyhub/settings/environment-variables
```

### Verify Variables

```bash
# List all environment variables
vercel env ls

# Should include:
# - HF_TOKEN (Sensitive)
# - LEXYBRAIN_RAG_MODEL_ID
# - LEXYBRAIN_MODEL_ID
```

---

## Step 3: Deploy to Staging

### Build Verification

```bash
# 1. Pull latest
git pull origin main

# 2. Install dependencies
npm ci

# 3. Type check
npx tsc --noEmit

# Should complete without errors

# 4. Build
npm run build

# Should complete successfully
```

### Deploy to Staging

```bash
# 1. Deploy to staging environment
vercel --prod --scope your-org --target staging

# 2. Wait for deployment
# URL: https://lexyhub-staging.vercel.app

# 3. Test endpoint
curl -X POST https://lexyhub-staging.vercel.app/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"message": "Test deployment"}'

# Should return 200 with response
```

---

## Step 4: Smoke Tests

### Test 1: Basic Request

```bash
# Authenticate in browser first, get cookie
# Then test:

curl -X POST https://lexyhub-staging.vercel.app/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "message": "What are trending keywords in vintage jewelry?",
    "capability": "market_brief"
  }'

# Expected:
# - Status: 200
# - Response includes: threadId, messageId, answer, sources
```

### Test 2: Multi-turn

```bash
# First request
RESPONSE=$(curl ... -d '{"message": "Tell me about handmade jewelry"}')

# Extract threadId
THREAD_ID=$(echo $RESPONSE | jq -r '.threadId')

# Second request with thread
curl ... -d "{\"threadId\": \"$THREAD_ID\", \"message\": \"What about competition?\"}"

# Expected: References previous context
```

### Test 3: Quota

```bash
# As free user, make 51 requests
for i in {1..51}; do
  curl ... -d "{\"message\": \"Test $i\"}"
done

# 51st should return 403 quota_exceeded
```

### Test 4: Database Verification

```sql
-- Via Supabase SQL Editor

-- Check threads created
SELECT COUNT(*) FROM rag_threads WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check messages
SELECT COUNT(*) FROM rag_messages WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check quota usage
SELECT * FROM usage_counters WHERE key = 'rag_messages' ORDER BY updated_at DESC LIMIT 10;
```

---

## Step 5: Monitoring Setup

### Vercel Logs

```bash
# Stream logs
vercel logs --follow

# Filter for RAG
vercel logs --follow | grep "rag_"

# Expected log types:
# - rag_request_start
# - rag_retrieval_complete
# - rag_generation_complete
# - rag_request_complete
```

### Sentry Configuration

1. Go to Sentry dashboard
2. Create alert for `rag_request_error` events
3. Set notification channel (Slack, email)
4. Threshold: >5 errors in 5 minutes

### Database Monitoring

Create scheduled query in Supabase (optional):

```sql
-- Daily RAG usage report
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT thread_id) as threads,
  COUNT(*) as messages,
  COUNT(DISTINCT user_id) as users
FROM rag_messages
WHERE role = 'user'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Step 6: Deploy to Production

### Final Checks

- [ ] All staging tests pass
- [ ] No Sentry errors in last hour
- [ ] Database tables verified
- [ ] Environment variables set
- [ ] Backup created

### Deploy

```bash
# 1. Merge to main (if on feature branch)
git checkout main
git merge your-feature-branch

# 2. Deploy to production
vercel --prod

# 3. Monitor deployment
vercel logs --follow | grep "rag_"

# 4. Run smoke tests on production
```

### Post-Deployment

```bash
# 1. Test production endpoint
curl -X POST https://lexyhub.com/api/lexybrain/rag \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"message": "Test production"}'

# 2. Check database
# Via Supabase dashboard

# 3. Monitor Sentry for 30 minutes
# https://sentry.io/organizations/your-org/issues/

# 4. Check Vercel analytics
# https://vercel.com/your-org/lexyhub/analytics
```

---

## Step 7: Gradual Rollout (Optional)

### Feature Flag Approach

```typescript
// In your feature flag config
{
  "ask_lexybrain_rag": {
    "enabled": true,
    "rollout_percentage": 10,  // Start with 10% of users
    "allowlist": ["admin@lexyhub.com"]
  }
}
```

### Increase Rollout

Week 1: 10% of users
Week 2: 25% of users
Week 3: 50% of users
Week 4: 100% of users

Monitor error rates at each step.

---

## Rollback Procedure

### If Issues Occur

1. **Disable via environment variable**:
   ```bash
   vercel env add LEXYBRAIN_RAG_ENABLED false production
   vercel --prod  # Redeploy
   ```

2. **Revert code**:
   ```bash
   git revert HEAD
   git push origin main
   vercel --prod
   ```

3. **Rollback migration** (if necessary):
   ```sql
   -- Drop tables (WARNING: loses all data)
   DROP TABLE IF EXISTS rag_feedback CASCADE;
   DROP TABLE IF EXISTS rag_messages CASCADE;
   DROP TABLE IF EXISTS rag_threads CASCADE;

   -- Or restore from backup
   -- Via Supabase dashboard: Database > Backups > Restore
   ```

---

## Performance Tuning

### If Latency > 12s

1. **Check HuggingFace status**:
   - https://status.huggingface.co

2. **Reduce model size**:
   ```bash
   # Use 8B instead of 70B
   vercel env add LEXYBRAIN_RAG_MODEL_ID meta-llama/Llama-3.1-8B-Instruct
   ```

3. **Optimize retrieval**:
   - Reduce top_k from 40 to 20
   - Reduce rerank from 12 to 8

4. **Cache common queries**:
   - Implement Redis caching for frequent questions

### If Quota Exceeded Too Often

1. **Increase limits**:
   ```sql
   UPDATE plan_entitlements
   SET rag_messages_per_month = 100
   WHERE plan_code = 'free';
   ```

2. **Or upgrade users**:
   - Encourage users to upgrade to Basic plan

---

## Cost Estimation

### HuggingFace Costs

Based on model and usage:

- **8B model**: ~$0.001 per message
- **70B model**: ~$0.01 per message

Monthly costs for 10,000 messages:
- With 8B: $10/month
- With 70B: $100/month

### Optimization

- Cache popular queries
- Use 8B for simple questions, 70B for complex
- Implement daily cost cap (already in place)

---

## Success Metrics

Track after 1 week:

- [ ] >100 unique users tried Ask LexyBrain
- [ ] Average latency <10s
- [ ] Error rate <1%
- [ ] Positive feedback >70%
- [ ] 0 critical Sentry errors

---

## Support Contacts

- **Engineering**: engineering@lexyhub.com
- **On-call**: See PagerDuty schedule
- **Sentry**: https://sentry.io/organizations/your-org/
- **Vercel**: https://vercel.com/support

---

## Documentation

- **API Spec**: `/docs/lexybrain/rag-endpoint-specification.md`
- **Implementation**: `/docs/lexybrain/RAG_IMPLEMENTATION_COMPLETE.md`
- **Testing**: `/src/lib/rag/__tests__/README.md`

---

✅ **Deployment Complete**

Monitor for 24 hours and collect user feedback.
