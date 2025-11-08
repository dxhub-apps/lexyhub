/**
 * LexyBrain HTTP Client
 *
 * Simple client wrapper for the LexyBrain HTTP endpoint.
 * Uses direct HTTP API instead of RunPod Serverless Queue.
 */

const LEXYBRAIN_API_URL =
  process.env.LEXYBRAIN_API_URL ||
  "https://vnohaft064aqpa-8000.proxy.runpod.net"; // fallback for local dev

export type LexyBrainRequest = {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
};

export type LexyBrainResponse = {
  model: string;
  completion: string;
};

/**
 * Call LexyBrain HTTP endpoint to generate text completion
 *
 * @param input - Request parameters
 * @returns Response with model name and completion
 * @throws Error if request fails or response is invalid
 */
export async function lexybrainGenerate(
  input: LexyBrainRequest
): Promise<LexyBrainResponse> {
  const url = `${LEXYBRAIN_API_URL}/lexybrain/generate`;

  console.log(`[LexyBrain] Initiating request to ${url}`);
  console.log(`[LexyBrain] Request parameters:`, {
    promptLength: input.prompt?.length || 0,
    maxTokens: input.max_tokens ?? 256,
    temperature: input.temperature ?? 0.3,
  });

  const requestBody = {
    prompt: input.prompt,
    max_tokens: input.max_tokens ?? 256,
    temperature: input.temperature ?? 0.3,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    console.log(`[LexyBrain] Received response with status: ${res.status}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[LexyBrain] Error response (${res.status}):`, text.substring(0, 500));
      throw new Error(
        `LexyBrain HTTP ${res.status}: ${res.statusText} ${text}`.trim()
      );
    }

    const data = (await res.json()) as LexyBrainResponse;

    console.log(`[LexyBrain] Response data:`, {
      model: data.model,
      completionLength: data.completion?.length || 0,
    });

    if (!data?.completion) {
      console.error(`[LexyBrain] Missing completion in response`);
      throw new Error("LexyBrain: missing completion in response");
    }

    console.log(`[LexyBrain] Request completed successfully`);
    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[LexyBrain] Request failed:`, {
        name: error.name,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * Test LexyBrain endpoint connectivity and health
 * Returns diagnostic information about the endpoint
 */
export async function testLexyBrainConnection(): Promise<{
  success: boolean;
  apiUrl: string;
  message: string;
  details?: any;
}> {
  console.log(`[LexyBrain] Testing connection to ${LEXYBRAIN_API_URL}`);

  try {
    // Test with a simple request
    const testInput: LexyBrainRequest = {
      prompt: "Say 'hello' in one word",
      max_tokens: 10,
      temperature: 0.7,
    };

    const response = await lexybrainGenerate(testInput);

    return {
      success: true,
      apiUrl: LEXYBRAIN_API_URL,
      message: "Connection successful",
      details: {
        model: response.model,
        completionLength: response.completion?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      apiUrl: LEXYBRAIN_API_URL,
      message: error instanceof Error ? error.message : String(error),
      details: {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      },
    };
  }
}
