# RunPod Test API

A simple test API endpoint for testing the RunPod integration flow.

## Files Created

- `/src/app/api/test-runpod/route.ts` - API endpoint
- `/public/test-runpod.html` - Browser-based test interface

## Usage

### Option 1: Browser Test Interface (Recommended)

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open in your browser:
   ```
   http://localhost:3000/test-runpod.html
   ```

3. Enter your message and click "Send Test Request"

### Option 2: Direct API Calls

#### Using GET (from browser or curl)

**Browser:**
```
http://localhost:3000/api/test-runpod?message=Hello%20from%20the%20browser
```

**curl:**
```bash
curl "http://localhost:3000/api/test-runpod?message=What%20is%20the%20capital%20of%20France?"
```

#### Using POST (more control)

```bash
curl -X POST http://localhost:3000/api/test-runpod \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the capital of France?",
    "system": "You are a helpful assistant.",
    "max_tokens": 500,
    "temperature": 0.7
  }'
```

## Request Parameters

### GET Parameters
- `message` (optional) - The message to send to RunPod
  - Default: "Hello from the browser! Please respond with a friendly greeting."

### POST Body
```json
{
  "message": "Your message here",
  "system": "System prompt (optional)",
  "max_tokens": 500,
  "temperature": 0.7
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "RunPod test successful",
  "request": {
    "message": "Your message",
    "timestamp": "2025-11-08T10:30:00.000Z"
  },
  "response": {
    "completion": "The AI's response",
    "duration_ms": 1234
  },
  "raw_output": {
    // Full RunPod response
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "type": "RunPodClientError",
    "details": "Full error details"
  },
  "request": {
    "message": "Your message",
    "timestamp": "2025-11-08T10:30:00.000Z"
  }
}
```

## Environment Variables Required

Make sure these are set in your `.env.local`:

```bash
RUNPOD_API_KEY=your-runpod-api-key
LEXYBRAIN_RUNPOD_ENDPOINT_ID=826ys3jox3ev2n  # or your endpoint ID
LEXYBRAIN_ENABLE=true
```

## Testing Checklist

- [ ] API endpoint returns successful response
- [ ] Response contains completion text
- [ ] Error handling works (try with invalid config)
- [ ] Duration is reported correctly
- [ ] HTML test page loads and works

## Notes

- This is a **test endpoint** with no authentication
- Do not use in production
- No quota checking or rate limiting
- Direct access to RunPod without caching

## Troubleshooting

### Error: "RUNPOD_API_KEY is not defined"
- Check your `.env.local` file
- Restart your dev server after adding env vars

### Error: "Failed to fetch"
- Check if your dev server is running
- Check browser console for CORS errors

### Timeout errors
- RunPod endpoint might be cold starting (first request takes longer)
- Default timeout is 55 seconds
- Check RunPod dashboard for endpoint status
