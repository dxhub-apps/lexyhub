# LexyBrain RunPod Serverless Queue Migration Guide

## Overview

This document describes the migration from RunPod Load Balancer to RunPod Serverless Queue for LexyBrain inference, and the addition of training data collection infrastructure.

**Migration Date:** 2025-11-08
**Status:** ✅ Complete

---

## What Changed?

### Phase 1: RunPod Serverless Queue Integration

**Old Architecture:**
- Used RunPod Load Balancer endpoints
- Direct HTTP calls to llama.cpp server (`/completion`)
- Environment variables: `LEXYBRAIN_MODEL_URL`, `LEXYBRAIN_KEY`

**New Architecture:**
- Uses RunPod Serverless Queue API (`/runsync`)
- Managed worker queue with automatic scaling
- Environment variables: `RUNPOD_API_KEY`, `LEXYBRAIN_RUNPOD_ENDPOINT_ID`

**Benefits:**
- ✅ Scales to zero when idle (cost savings)
- ✅ Better cold start management
- ✅ Standardized RunPod API interface
- ✅ Improved error handling and retries

### Phase 2: Training Data Collection

**New Infrastructure:**
- 3 new database tables: `lexybrain_requests`, `lexybrain_responses`, `lexybrain_feedback`
- Automatic logging of all inference requests/responses
- User feedback mechanism (thumbs up/down)
- Analytics and export functions for training data

**Benefits:**
- 📊 Collect data for supervised fine-tuning
- 🎯 Track model performance and user satisfaction
- 📈 Enable continuous model improvement
- 🔍 Debug and analyze model behavior

---

## Migration Steps

### 1. Update Environment Variables

**Required:**
```bash
# New RunPod Serverless Queue configuration
RUNPOD_API_KEY=your-runpod-api-key-here
LEXYBRAIN_RUNPOD_ENDPOINT_ID=826ys3jox3ev2n
```

**Legacy (for backward compatibility):**
```bash
# These can be removed after confirming the migration works
LEXYBRAIN_MODEL_URL=https://your-endpoint-id-hash.runpod.run
LEXYBRAIN_KEY=your-shared-secret-here
```

Get your RunPod API key from: https://www.runpod.io/console/user/settings

### 2. Run Database Migration

```bash
# Apply the new training tables migration
supabase migration up
# Or manually run: supabase/migrations/0039_lexybrain_training_tables.sql
```

This creates:
- `lexybrain_requests` - Stores prompts and context
- `lexybrain_responses` - Stores model outputs
- `lexybrain_feedback` - Stores user feedback
- `lexybrain_training_data` view - Combined view for exports
- Helper functions for analytics

### 3. Update Application Code

**The migration is backward compatible:**
- If `RUNPOD_API_KEY` is set → uses new Serverless Queue
- If only `LEXYBRAIN_MODEL_URL` is set → falls back to legacy Load Balancer (deprecated)

### 4. Deploy and Test

1. Deploy to staging/preview environment
2. Test LexyBrain generation endpoints
3. Verify training data is being logged
4. Test feedback submission
5. Deploy to production

### 5. Clean Up (After Verification)

After confirming the new system works:
1. Remove `LEXYBRAIN_MODEL_URL` and `LEXYBRAIN_KEY` from environment
2. (Optional) Remove legacy client code in `src/lib/lexybrain-client.ts`

---

## New Features

### 1. Training Data Collection

**Automatic Logging:**
All LexyBrain requests and responses are automatically logged to the database.

**Request Data Captured:**
- User ID
- Full prompt
- Context (market, keywords, etc.)
- Insight type
- Timestamp

**Response Data Captured:**
- Model output (structured JSON)
- Model name/version
- Latency (ms)
- Success status
- Token counts

### 2. User Feedback API

**Submit Feedback:**
```typescript
POST /api/lexybrain/feedback
{
  "responseId": "uuid",
  "feedback": "positive" | "negative" | "neutral",
  "notes": "Optional feedback notes"
}
```

**Get Feedback:**
```typescript
GET /api/lexybrain/feedback?responseId=uuid
```

**Frontend Integration Example:**
```typescript
// After displaying LexyBrain response
const handleFeedback = async (feedback: 'positive' | 'negative') => {
  await fetch('/api/lexybrain/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      responseId: response.metadata.responseId,
      feedback,
    }),
  });
};

// Render thumbs up/down buttons
<button onClick={() => handleFeedback('positive')}>👍</button>
<button onClick={() => handleFeedback('negative')}>👎</button>
```

### 3. Training Data Export

**Via SQL:**
```sql
-- Export training data for fine-tuning
SELECT * FROM lexybrain_training_data
WHERE requested_at >= NOW() - INTERVAL '30 days'
  AND feedback IS NOT NULL
ORDER BY requested_at DESC;
```

**Via Function:**
```sql
-- Get feedback statistics
SELECT * FROM get_lexybrain_feedback_stats(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

**Via TypeScript:**
```typescript
import { exportTrainingData } from '@/lib/lexybrain/trainingLogger';

const data = await exportTrainingData(
  new Date('2025-10-01'),
  new Date('2025-11-01'),
  1000 // limit
);
```

---

## File Structure

### New Files Created

```
src/lib/lexybrain/
├── runpodClient.ts          # RunPod Serverless Queue client
└── trainingLogger.ts        # Training data logging utilities

src/app/api/lexybrain/
└── feedback/
    └── route.ts             # Feedback submission endpoint

supabase/migrations/
└── 0039_lexybrain_training_tables.sql  # Training tables schema
```

### Modified Files

```
src/lib/
├── env.ts                   # Added RUNPOD_API_KEY, LEXYBRAIN_RUNPOD_ENDPOINT_ID
├── lexybrain-config.ts      # Support for new env vars
└── lexybrain-json.ts        # Uses new client + logging

.env.example                 # Documented new env vars
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      LexyHub Backend                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/lexybrain/generate                             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ 1. Check cache                                  │  │  │
│  │  │ 2. Log request → lexybrain_requests             │  │  │
│  │  │ 3. Call RunPod Serverless Queue                 │  │  │
│  │  │    ↓                                             │  │  │
│  │  │    lib/lexybrain/runpodClient.ts                │  │  │
│  │  │    ↓                                             │  │  │
│  │  │    POST https://api.runpod.ai/v2/{id}/runsync  │  │  │
│  │  │    ↓                                             │  │  │
│  │  │ 4. Parse & validate response                    │  │  │
│  │  │ 5. Log response → lexybrain_responses           │  │  │
│  │  │ 6. Cache result                                 │  │  │
│  │  │ 7. Return to user                               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/lexybrain/feedback                             │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ 1. Authenticate user                            │  │  │
│  │  │ 2. Validate response ownership                  │  │  │
│  │  │ 3. Log feedback → lexybrain_feedback            │  │  │
│  │  │ 4. Return success                               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  RunPod Serverless Queue                     │
│                                                             │
│  Endpoint: 826ys3jox3ev2n                                   │
│  Workers: Auto-scale (0-N)                                  │
│  Timeout: 55s                                               │
│  Cold Start: ~2-5s                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│                                                             │
│  Tables:                                                    │
│  ├── lexybrain_requests    (prompts + context)             │
│  ├── lexybrain_responses   (model outputs)                 │
│  └── lexybrain_feedback    (user ratings)                  │
│                                                             │
│  Views:                                                     │
│  └── lexybrain_training_data (combined for export)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LEXYBRAIN_ENABLE` | Yes | `false` | Master feature flag |
| `RUNPOD_API_KEY` | Yes* | - | RunPod API key for serverless queue |
| `LEXYBRAIN_RUNPOD_ENDPOINT_ID` | No | `826ys3jox3ev2n` | RunPod serverless endpoint ID |
| `LEXYBRAIN_MODEL_URL` | No** | - | Legacy load balancer URL (deprecated) |
| `LEXYBRAIN_KEY` | No** | - | Legacy API key (deprecated) |
| `LEXYBRAIN_MODEL_VERSION` | No | `llama-3-8b` | Model identifier for logging |
| `LEXYBRAIN_DAILY_COST_CAP` | No | `10000` | Daily cost cap in cents ($100) |
| `LEXYBRAIN_MAX_LATENCY_MS` | No | `55000` | Max latency in milliseconds (55s) |
| `LEXYBRAIN_NOTIFICATIONS_ENABLED` | No | `false` | Enable risk alert notifications |

\* Required for new serverless queue setup
\** Required only if not using `RUNPOD_API_KEY` (backward compatibility)

---

## Troubleshooting

### Issue: "RunPod authentication failed"
**Cause:** Invalid or missing `RUNPOD_API_KEY`
**Solution:** Verify API key from https://www.runpod.io/console/user/settings

### Issue: "LexyBrain is not enabled"
**Cause:** Missing `LEXYBRAIN_ENABLE=true` or missing API credentials
**Solution:** Set `LEXYBRAIN_ENABLE=true` and configure `RUNPOD_API_KEY`

### Issue: "Training data not logging"
**Cause:** Database migration not applied
**Solution:** Run migration `0039_lexybrain_training_tables.sql`

### Issue: "Feedback submission forbidden"
**Cause:** User trying to submit feedback for another user's response
**Solution:** Ensure `responseId` belongs to the authenticated user

---

## Performance Considerations

### Latency
- **Cold Start:** ~2-5 seconds (first request after idle)
- **Warm Request:** ~500-2000ms (typical)
- **Timeout:** 55 seconds (configured)

### Cost
- **Serverless Queue:** Pay only for execution time
- **Idle Cost:** $0 (scales to zero)
- **Training Logging:** Minimal overhead (~10-20ms)

### Caching
- Cache TTL: 6-24 hours depending on insight type
- Cache hit rate: Expected ~60-80% (typical usage)
- Training data logged on cache miss only

---

## Future Enhancements

### Planned Features
1. **Fine-Tuning Pipeline**
   - Export training data to JSONL format
   - Automated fine-tuning jobs
   - A/B testing for model versions

2. **Advanced Feedback**
   - Detailed feedback categories
   - User-suggested corrections
   - Feedback aggregation and analysis

3. **Analytics Dashboard**
   - Model performance metrics
   - User satisfaction trends
   - Cost and usage analytics

4. **Multi-Model Support**
   - Switch between base and fine-tuned models
   - Model versioning and rollback
   - Performance comparison

---

## Support

### Documentation
- [LexyBrain Technical Docs](./technical.md)
- [LexyBrain Business Docs](./business.md)
- [Setup Guide](./setup-guide.md)

### Contact
- **Issues:** GitHub Issues
- **Questions:** #lexybrain-dev Slack channel

---

## Changelog

### 2025-11-08 - v1.0 Migration
- ✅ Migrated to RunPod Serverless Queue API
- ✅ Added training data collection infrastructure
- ✅ Created feedback submission endpoint
- ✅ Backward compatibility with legacy Load Balancer
- ✅ Database migration for training tables
- ✅ Updated documentation and environment variables

---

**End of Migration Guide**
