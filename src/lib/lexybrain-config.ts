/**
 * LexyBrain Configuration Module
 *
 * Provides centralized configuration and feature flag management for LexyBrain.
 * All LexyBrain functionality should check isLexyBrainEnabled() before executing.
 */

import { env } from "./env";

// =====================================================
// Core Configuration
// =====================================================

/**
 * Check if LexyBrain is enabled
 * Returns true when:
 * - LEXYBRAIN_ENABLE === "true"
 * - LEXYBRAIN_MODEL_URL and LEXYBRAIN_KEY exist
 */
export function isLexyBrainEnabled(): boolean {
  return (
    env.LEXYBRAIN_ENABLE === "true" &&
    !!env.LEXYBRAIN_MODEL_URL &&
    !!env.LEXYBRAIN_KEY
  );
}

/**
 * Get the RunPod model endpoint URL
 * Throws if LexyBrain is not enabled or URL is missing
 */
export function getLexyBrainModelUrl(): string {
  if (!env.LEXYBRAIN_MODEL_URL) {
    throw new Error(
      "LEXYBRAIN_MODEL_URL is not configured. Please set this environment variable."
    );
  }
  // Trim whitespace that might have been accidentally added in env vars
  return env.LEXYBRAIN_MODEL_URL.trim();
}

/**
 * Get the LexyBrain API key for RunPod authentication
 * Throws if LexyBrain is not enabled or key is missing
 */
export function getLexyBrainKey(): string {
  if (!env.LEXYBRAIN_KEY) {
    throw new Error(
      "LEXYBRAIN_KEY is not configured. Please set this environment variable."
    );
  }
  // Trim whitespace that might have been accidentally added in env vars
  return env.LEXYBRAIN_KEY.trim();
}

/**
 * Get the model version string for tracking
 * Defaults to "llama-3-8b" if not specified
 */
export function getLexyBrainModelVersion(): string {
  return env.LEXYBRAIN_MODEL_VERSION || "llama-3-8b";
}

/**
 * Get the daily cost cap in cents
 * Returns null if no cap is set (unlimited)
 * Example: "10000" = $100/day cap
 */
export function getLexyBrainDailyCostCap(): number | null {
  if (!env.LEXYBRAIN_DAILY_COST_CAP) {
    return null;
  }

  const parsed = parseInt(env.LEXYBRAIN_DAILY_COST_CAP, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * Get SLO configuration for latency monitoring
 */
export function getLexyBrainSloConfig(): { maxLatencyMs: number } {
  const defaultMaxLatency = 30000; // 30 seconds default

  if (!env.LEXYBRAIN_MAX_LATENCY_MS) {
    return { maxLatencyMs: defaultMaxLatency };
  }

  const parsed = parseInt(env.LEXYBRAIN_MAX_LATENCY_MS, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return { maxLatencyMs: defaultMaxLatency };
  }

  return { maxLatencyMs: parsed };
}

// =====================================================
// Feature Flags
// =====================================================

/**
 * Check if LexyBrain graph (Neural Map) feature is enabled
 * Returns true if LexyBrain is enabled (graph is core feature)
 */
export function isLexyBrainGraphEnabled(): boolean {
  return isLexyBrainEnabled();
}

// =====================================================
// TTL Configuration (Cache Expiration)
// =====================================================

export const LEXYBRAIN_TTL = {
  market_brief: 1440, // 24 hours in minutes
  radar: 1440, // 24 hours
  risk: 720, // 12 hours
  ad_insight: 360, // 6 hours
} as const;

export type LexyBrainInsightType = keyof typeof LEXYBRAIN_TTL;

/**
 * Get the TTL (time-to-live) for a given insight type
 */
export function getLexyBrainTtl(type: LexyBrainInsightType): number {
  return LEXYBRAIN_TTL[type];
}

// =====================================================
// Cost Estimation (for daily cap enforcement)
// =====================================================

/**
 * Estimated cost per insight type in cents
 * These are rough estimates and should be calibrated based on actual usage
 */
export const LEXYBRAIN_ESTIMATED_COSTS = {
  market_brief: 5, // ~$0.05 per brief
  radar: 3, // ~$0.03 per radar
  risk: 2, // ~$0.02 per risk check
  ad_insight: 2, // ~$0.02 per ad insight
  graph: 1, // ~$0.01 per graph generation
} as const;

/**
 * Get estimated cost for an insight type
 */
export function getEstimatedCost(
  type: keyof typeof LEXYBRAIN_ESTIMATED_COSTS
): number {
  return LEXYBRAIN_ESTIMATED_COSTS[type];
}

// =====================================================
// Status Check
// =====================================================

/**
 * Get comprehensive LexyBrain status for health checks
 */
export function getLexyBrainStatus(): {
  enabled: boolean;
  modelUrl: string | null;
  modelVersion: string;
  hasApiKey: boolean;
  dailyCostCap: number | null;
  maxLatencyMs: number;
} {
  return {
    enabled: isLexyBrainEnabled(),
    modelUrl: env.LEXYBRAIN_MODEL_URL || null,
    modelVersion: getLexyBrainModelVersion(),
    hasApiKey: !!env.LEXYBRAIN_KEY,
    dailyCostCap: getLexyBrainDailyCostCap(),
    maxLatencyMs: getLexyBrainSloConfig().maxLatencyMs,
  };
}

// =====================================================
// Validation
// =====================================================

/**
 * Validate LexyBrain configuration
 * Throws with descriptive error if configuration is invalid
 */
export function validateLexyBrainConfig(): void {
  if (env.LEXYBRAIN_ENABLE === "true") {
    if (!env.LEXYBRAIN_MODEL_URL) {
      throw new Error(
        "LexyBrain is enabled but LEXYBRAIN_MODEL_URL is not set"
      );
    }

    if (!env.LEXYBRAIN_KEY) {
      throw new Error("LexyBrain is enabled but LEXYBRAIN_KEY is not set");
    }

    // Validate URL format
    try {
      new URL(env.LEXYBRAIN_MODEL_URL);
    } catch {
      throw new Error(
        `LEXYBRAIN_MODEL_URL is not a valid URL: ${env.LEXYBRAIN_MODEL_URL}`
      );
    }
  }
}

// Run validation on import (fail fast)
if (typeof window === "undefined") {
  // Only validate on server-side
  try {
    if (env.LEXYBRAIN_ENABLE === "true") {
      validateLexyBrainConfig();
    }
  } catch (error) {
    console.warn("LexyBrain configuration validation warning:", error);
  }
}
