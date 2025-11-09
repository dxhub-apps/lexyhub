/**
 * Provider factory for LexyBrain AI services
 *
 * This module provides a factory function to get the appropriate
 * AI provider based on environment configuration.
 */

import { LexyBrainProvider, ProviderType } from "./types";
import { HuggingFaceProvider } from "./huggingface";

/**
 * Get the configured provider type from environment
 */
export function getConfiguredProviderType(): ProviderType {
  const provider = process.env.LEXYBRAIN_PROVIDER?.toLowerCase() as ProviderType;

  // Default to HuggingFace
  if (!provider) {
    return "huggingface";
  }

  // Validate provider type
  const validProviders: ProviderType[] = ["huggingface", "runpod", "openai"];
  if (!validProviders.includes(provider)) {
    console.warn(
      `[LexyBrain] Invalid provider "${provider}", defaulting to "huggingface"`
    );
    return "huggingface";
  }

  return provider;
}

/**
 * Create a provider instance based on type
 */
export function createProvider(type?: ProviderType): LexyBrainProvider {
  const providerType = type || getConfiguredProviderType();

  console.log(`[LexyBrain] Creating provider: ${providerType}`);

  switch (providerType) {
    case "huggingface":
      return new HuggingFaceProvider();

    case "runpod":
      throw new Error(
        "RunPod provider is deprecated. Please use HuggingFace provider instead."
      );

    case "openai":
      throw new Error(
        "OpenAI provider not yet implemented. Please use HuggingFace provider."
      );

    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

/**
 * Get the default provider instance
 * This is a singleton to avoid creating multiple instances
 */
let defaultProviderInstance: LexyBrainProvider | null = null;

export function getDefaultProvider(): LexyBrainProvider {
  if (!defaultProviderInstance) {
    defaultProviderInstance = createProvider();
  }
  return defaultProviderInstance;
}

// Export types and classes
export * from "./types";
export { HuggingFaceProvider } from "./huggingface";
