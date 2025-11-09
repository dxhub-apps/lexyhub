/**
 * Provider abstraction for LexyBrain AI services
 *
 * This allows easy switching between different AI providers
 * (HuggingFace, OpenAI, Anthropic, etc.) without changing
 * the application code.
 */

export interface LexyBrainProviderRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

export interface LexyBrainProviderResponse {
  completion: string;
  model: string;
}

export interface LexyBrainProvider {
  /**
   * Generate text completion from the AI provider
   */
  generate(request: LexyBrainProviderRequest): Promise<LexyBrainProviderResponse>;

  /**
   * Test connection to the provider
   */
  testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }>;

  /**
   * Get the provider name
   */
  getProviderName(): string;
}

export type ProviderType = "huggingface";
