import { createOpenAI } from "@ai-sdk/openai";

import { env } from "../env";

type OpenAIClient = ReturnType<typeof createOpenAI>;

let cachedClient: OpenAIClient | null = null;

export function getOpenAIClient(): OpenAIClient | null {
  if (!env.OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured; AI calls will be skipped.");
    return null;
  }

  if (!cachedClient) {
    cachedClient = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return cachedClient;
}
