/**
 * LexyBrain Client
 *
 * Provider-agnostic client wrapper for LexyBrain AI services.
 * Supports multiple providers (HuggingFace, OpenAI, etc.) via abstraction layer.
 */

import { getDefaultProvider } from "./lexybrain/providers";

export type LexyBrainRequest = {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
};

export type LexyBrainResponse = {
  model: string;
  completion: string;
};

/**
 * Call LexyBrain to generate text completion
 *
 * Uses the configured provider (default: HuggingFace)
 * Set LEXYBRAIN_PROVIDER env var to change provider
 *
 * @param input - Request parameters
 * @returns Response with model name and completion
 * @throws Error if request fails or response is invalid
 */
export async function lexybrainGenerate(
  input: LexyBrainRequest
): Promise<LexyBrainResponse> {
  console.log(`[LexyBrain] Initiating request`);
  console.log(`[LexyBrain] Request parameters:`, {
    promptLength: input.prompt?.length || 0,
    maxTokens: input.max_tokens ?? 1024,
    temperature: input.temperature ?? 0.3,
    hasSystem: !!input.system,
  });

  try {
    const provider = getDefaultProvider();
    console.log(`[LexyBrain] Using provider: ${provider.getProviderName()}`);

    const response = await provider.generate({
      prompt: input.prompt,
      max_tokens: input.max_tokens ?? 1024,
      temperature: input.temperature ?? 0.3,
      system: input.system,
    });

    console.log(`[LexyBrain] Response data:`, {
      model: response.model,
      completionLength: response.completion?.length || 0,
    });

    if (!response?.completion) {
      console.error(`[LexyBrain] Missing completion in response`);
      throw new Error("LexyBrain: missing completion in response");
    }

    console.log(`[LexyBrain] Request completed successfully`);
    return {
      model: response.model,
      completion: response.completion,
    };
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
  apiUrl?: string;
  message: string;
  details?: any;
}> {
  console.log(`[LexyBrain] Testing connection`);

  try {
    const provider = getDefaultProvider();
    const result = await provider.testConnection();

    return {
      success: result.success,
      message: result.message,
      details: result.details,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      details: {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      },
    };
  }
}
