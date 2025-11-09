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
 *
 * UNIFIED: Only HuggingFace provider is supported (removed RunPod, OpenAI stubs)
 */
export function getConfiguredProviderType(): ProviderType {
  const provider = process.env.LEXYBRAIN_PROVIDER?.toLowerCase();

  // Only HuggingFace is supported
  if (provider && provider !== "huggingface") {
    console.warn(
      `[LexyBrain] Invalid provider "${provider}", defaulting to "huggingface". Only HuggingFace is supported.`
    );
  }

  return "huggingface";
}

/**
 * Create a provider instance based on type
 *
 * UNIFIED: Only HuggingFace provider is supported
 */
export function createProvider(type?: ProviderType): LexyBrainProvider {
  const providerType = type || getConfiguredProviderType();

  console.log(`[LexyBrain] Creating provider: ${providerType}`);

  // Only HuggingFace is supported
  return new HuggingFaceProvider();
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
