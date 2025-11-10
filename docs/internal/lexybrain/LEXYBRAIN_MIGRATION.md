# LexyBrain HuggingFace Migration Guide

## Overview

LexyBrain has been migrated from RunPod to HuggingFace Inference API for better reliability, cost efficiency, and flexibility. This migration includes a provider abstraction layer that allows easy switching between AI providers in the future.

## What Changed

### New Architecture

1. **Provider Abstraction Layer** (`src/lib/lexybrain/providers/`)
   - `types.ts` - Provider interface definition
   - `huggingface.ts` - HuggingFace provider implementation
   - `index.ts` - Provider factory and configuration

2. **Updated Main Client** (`src/lib/lexybrain.ts`)
   - Now uses provider abstraction instead of direct API calls
   - Automatically selects provider based on environment configuration
   - Maintains backward compatibility with existing code

3. **HuggingFace Client** (`src/lib/lexybrain/hfRouterClient.ts`)
   - Direct HuggingFace Inference Router integration
   - Uses OpenAI-compatible chat completions API
   - Supports any HuggingFace model that implements chat interface

### Data Persistence

All AI requests and responses are automatically logged to the database for future training:

- **Request Table**: `lexybrain_requests` - Stores all prompts and context
- **Response Table**: `lexybrain_responses` - Stores all completions and metadata
- **Feedback Table**: `lexybrain_feedback` - Stores user feedback for quality improvement
- **Training Data View**: `lexybrain_training_data` - Combined view for model fine-tuning

This logging happens transparently via `trainingLogger.ts` and requires no additional configuration.

## Migration Steps

### 1. Get HuggingFace API Token

1. Visit https://huggingface.co/settings/tokens
2. Create a new token with "Read" permissions
3. Copy the token (starts with `hf_`)

### 2. Update Environment Variables

Add the following to your `.env.local` or environment configuration:

```bash
# Required: HuggingFace API Token
HF_TOKEN=hf_your_token_here

# Optional: Model ID (defaults to meta-llama/Llama-3.1-8B-Instruct)
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-8B-Instruct

# Optional: Provider selection (defaults to "huggingface")
LEXYBRAIN_PROVIDER=huggingface
```

### 3. Remove Old Environment Variables (Optional)

The following variables are no longer needed and can be removed:

```bash
# Deprecated - No longer used
RUNPOD_API_KEY=...
LEXYBRAIN_RUNPOD_ENDPOINT_ID=...
LEXYBRAIN_API_URL=...
LEXYBRAIN_MODEL_URL=...
LEXYBRAIN_KEY=...
```

**Note**: You can keep these for now as they won't interfere with the new system.

### 4. Verify Configuration

Visit `/api/lexybrain/debug` to check your configuration:

```bash
curl http://localhost:3000/api/lexybrain/debug
```

Expected response:
```json
{
  "enabled": true,
  "provider": "huggingface",
  "huggingface": {
    "hasToken": true,
    "tokenAnalysis": {
      "issue": "✅ OK: Token is set and trimmed"
    },
    "modelId": "meta-llama/Llama-3.1-8B-Instruct"
  }
}
```

### 5. Test the Integration

Test the `/insights` page to ensure everything works:

1. Navigate to `/insights`
2. Generate a Market Brief or other insight type
3. Verify the response is generated successfully
4. Check that data is being saved to the database

## Available Models

You can use any HuggingFace model that supports chat completions. Popular options:

### Recommended Models

- **meta-llama/Llama-3.1-8B-Instruct** (default, fast, good quality)
- **meta-llama/Llama-3.1-70B-Instruct** (slower, higher quality)
- **mistralai/Mixtral-8x7B-Instruct-v0.1** (good balance)

### Setting a Different Model

```bash
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-70B-Instruct
```

## Provider Abstraction Layer

### Switching Providers

To switch to a different AI provider in the future:

1. Implement the `LexyBrainProvider` interface in `src/lib/lexybrain/providers/`
2. Add the provider to the factory in `providers/index.ts`
3. Set `LEXYBRAIN_PROVIDER` environment variable

Example:
```bash
LEXYBRAIN_PROVIDER=openai  # For future OpenAI integration
```

### Current Provider Support

- ✅ **HuggingFace** - Fully implemented and tested
- 🚧 **OpenAI** - Interface defined, not yet implemented
- ❌ **RunPod** - Deprecated, will throw error if selected

### Adding a New Provider

1. Create a new file in `src/lib/lexybrain/providers/` (e.g., `anthropic.ts`)
2. Implement the `LexyBrainProvider` interface:

```typescript
import { LexyBrainProvider, LexyBrainProviderRequest, LexyBrainProviderResponse } from "./types";

export class AnthropicProvider implements LexyBrainProvider {
  getProviderName(): string {
    return "Anthropic";
  }

  async generate(request: LexyBrainProviderRequest): Promise<LexyBrainProviderResponse> {
    // Your implementation here
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    // Your implementation here
  }
}
```

3. Add to factory in `providers/index.ts`:

```typescript
case "anthropic":
  return new AnthropicProvider();
```

4. Update `ProviderType` in `providers/types.ts`:

```typescript
export type ProviderType = "huggingface" | "runpod" | "openai" | "anthropic";
```

## Data Collection for Training

All LexyBrain interactions are automatically logged for future model training:

### What Gets Logged

1. **Requests**:
   - User ID
   - Full prompt
   - Context (market, keywords, etc.)
   - Timestamp
   - Insight type

2. **Responses**:
   - Model name/version
   - Complete output (validated JSON)
   - Latency metrics
   - Token counts (estimated)
   - Success/failure status

3. **Feedback**:
   - User ratings (positive/negative/neutral)
   - Optional notes
   - Associated request/response IDs

### Accessing Training Data

Use the provided helper functions:

```typescript
import { exportTrainingData } from "@/lib/lexybrain/trainingLogger";

// Export data for a date range
const data = await exportTrainingData(
  new Date("2025-01-01"),
  new Date("2025-12-31"),
  1000 // limit
);
```

### Database Tables

- `lexybrain_requests` - All AI requests
- `lexybrain_responses` - All AI responses
- `lexybrain_feedback` - User feedback
- `ai_insights` - Cached insights (for performance)
- `ai_usage_events` - Usage analytics and billing

## Troubleshooting

### Error: "HF_TOKEN is not set"

Make sure you've added the HuggingFace token to your environment variables:

```bash
HF_TOKEN=hf_your_token_here
```

### Error: "HF router HTTP 401"

Your HuggingFace token is invalid or expired. Generate a new token at https://huggingface.co/settings/tokens

### Error: "HF router HTTP 403"

The selected model requires additional permissions or is not available. Try using the default model:

```bash
LEXYBRAIN_MODEL_ID=meta-llama/Llama-3.1-8B-Instruct
```

### Insights Not Generating

1. Check debug endpoint: `/api/lexybrain/debug`
2. Verify `LEXYBRAIN_ENABLE=true` in environment
3. Check browser console and server logs for errors
4. Ensure user has sufficient quota (check `usage_counters` table)

### Data Not Being Saved

The training logger is designed to be non-blocking and will log warnings but not fail requests. Check server logs for warnings like:

```
Failed to log LexyBrain request (non-blocking)
Failed to log LexyBrain response (non-blocking)
```

Common causes:
- Supabase connection issues
- Row-level security policies blocking inserts
- Database schema changes

## Performance Considerations

### Response Times

- **Llama-3.1-8B**: ~2-5 seconds
- **Llama-3.1-70B**: ~5-15 seconds
- **Mixtral-8x7B**: ~3-8 seconds

### Caching

The system includes intelligent caching based on input hash:

- **Market Brief**: 24 hours
- **Opportunity Radar**: 24 hours
- **Risk Sentinel**: 12 hours
- **Ad Insight**: 6 hours

Cache hits don't consume quota and return instantly.

### Cost Optimization

1. Use smaller models (8B) for most requests
2. Implement request throttling for heavy users
3. Monitor daily cost cap via `LEXYBRAIN_DAILY_COST_CAP`
4. Review usage via `ai_usage_events` table

## Rollback Plan

If you need to rollback to RunPod temporarily:

1. Keep old environment variables:
   ```bash
   RUNPOD_API_KEY=your_key
   LEXYBRAIN_RUNPOD_ENDPOINT_ID=your_endpoint
   ```

2. Set provider:
   ```bash
   LEXYBRAIN_PROVIDER=runpod
   ```

3. Implement RunPod provider (not recommended - deprecated)

## Support

For issues or questions:

1. Check debug endpoint: `/api/lexybrain/debug`
2. Review server logs for detailed error messages
3. Check HuggingFace status: https://status.huggingface.co/
4. Open an issue in the repository

## Future Enhancements

Planned improvements:

- [ ] OpenAI provider implementation
- [ ] Anthropic Claude provider implementation
- [ ] Multi-model routing based on insight type
- [ ] Actual token counting (not estimated)
- [ ] Streaming responses for better UX
- [ ] Fine-tuned models using collected training data
- [ ] A/B testing between different models
- [ ] Cost analytics dashboard

## Summary

The migration to HuggingFace provides:

✅ Better reliability with managed infrastructure
✅ Flexible model selection
✅ Cost transparency and control
✅ Provider abstraction for future flexibility
✅ Comprehensive data collection for training
✅ Backward compatibility with existing code

All existing features continue to work without code changes. Simply update your environment variables and you're ready to go!
