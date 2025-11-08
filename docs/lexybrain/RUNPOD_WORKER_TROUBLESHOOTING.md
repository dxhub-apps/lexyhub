# RunPod Worker Troubleshooting Guide

## Issue: Worker Echoing Input Prompt Instead of Model Completion

### Symptoms

- Validation errors showing all required fields as "undefined"
- Log message: `runpod_echo_fallback`
- Echo/content field contains the input prompt (starts with "=== SYSTEM INSTRUCTIONS ===")
- Error: "RunPod worker is echoing the input prompt instead of returning model completion"

### Root Cause

The RunPod serverless worker at endpoint `826ys3jox3ev2n` is **not calling llama.cpp** or **not returning the model's completion**. Instead, it's echoing back the input prompt that was sent to it.

### Expected Worker Behavior

```python
# Correct worker handler (handler.py)
def handler(job):
    """
    RunPod serverless worker handler for LexyBrain
    """
    # 1. Extract input from job
    input_data = job["input"]
    prompt = input_data["prompt"]
    max_tokens = input_data.get("max_tokens", 256)
    temperature = input_data.get("temperature", 0.3)

    # 2. Call llama.cpp server
    response = requests.post(
        "http://localhost:8080/completion",  # llama.cpp server
        json={
            "prompt": prompt,
            "n_predict": max_tokens,
            "temperature": temperature,
            "top_p": input_data.get("top_p", 0.9),
            "stop": input_data.get("stop", ["</s>", "<|endoftext|>"]),
        },
        timeout=50,
    )

    # 3. Extract completion from llama.cpp response
    llama_output = response.json()
    completion_text = llama_output["content"]  # The generated text

    # 4. Return in RunPod expected format
    return {
        "content": completion_text,  # CRITICAL: Return the COMPLETION, not the prompt
        "tokens_predicted": llama_output.get("tokens_predicted", 0),
        "tokens_evaluated": llama_output.get("tokens_evaluated", 0),
        "model": "lexy-brain-7b",
        "timings": {
            "prompt_ms": llama_output.get("timings", {}).get("prompt_ms", 0),
            "predicted_ms": llama_output.get("timings", {}).get("predicted_ms", 0),
        }
    }
```

### Current Buggy Behavior

The worker is likely doing something like:

```python
# WRONG - Echoing input instead of returning completion
def handler(job):
    input_data = job["input"]
    prompt = input_data["prompt"]

    # BUG: Returning the input prompt instead of calling llama.cpp
    return {
        "echo": prompt  # WRONG! This is the INPUT, not the model's OUTPUT
    }
```

### How to Fix

1. **Access the RunPod Worker**:
   - Log into RunPod console: https://www.runpod.io/console
   - Navigate to Serverless → Endpoints
   - Find endpoint ID: `826ys3jox3ev2n`

2. **Check the Worker Code**:
   - Review the `handler.py` file
   - Verify it's calling llama.cpp server
   - Verify it's extracting the completion from llama.cpp's response
   - Verify it's returning `content` field with the completion

3. **Verify llama.cpp Server**:
   - Ensure llama.cpp server is running on the worker pod
   - Test it directly: `curl http://localhost:8080/completion -d '{"prompt":"test","n_predict":10}'`
   - Check that it returns `{"content": "...generated text..."}`

4. **Common Issues**:
   - llama.cpp server not running → worker can't generate completions
   - Wrong field mapping → returning prompt instead of completion
   - Exception handling → silently failing and echoing input

### Testing the Fix

After fixing the worker, test with:

```bash
# Test via RunPod API
curl -X POST https://api.runpod.ai/v2/826ys3jox3ev2n/runsync \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "You are LexyBrain. Return {\"test\": \"success\"}",
      "max_tokens": 50,
      "temperature": 0
    }
  }'

# Expected response:
# {
#   "id": "...",
#   "status": "COMPLETED",
#   "output": {
#     "content": "{\"test\": \"success\"}"  ← Generated completion, NOT the prompt
#   }
# }
```

### Temporary Workaround

If the worker cannot be fixed immediately, consider:

1. **Use Legacy Load Balancer**: Set `LEXYBRAIN_MODEL_URL` to bypass the buggy worker
2. **Deploy New Worker**: Create a new RunPod serverless endpoint with correct handler
3. **Switch Endpoint**: Update `LEXYBRAIN_RUNPOD_ENDPOINT_ID` to a working endpoint

### Detection

The client now automatically detects this issue and throws a clear error:

```
RunPodClientError: RunPod worker is echoing the input prompt instead of
returning model completion. This indicates a worker configuration bug.
```

Check Sentry for tag: `error_type: worker_prompt_echo`

### Related Files

- Client code: `src/lib/lexybrain/runpodClient.ts`
- Detection logic: Lines 415-461
- Migration docs: `docs/lexybrain/MIGRATION_RUNPOD_SERVERLESS.md`

### Support

If you need help fixing the worker:
1. Check RunPod documentation: https://docs.runpod.io/serverless/overview
2. Review llama.cpp server docs: https://github.com/ggerganov/llama.cpp
3. Contact RunPod support for endpoint troubleshooting
