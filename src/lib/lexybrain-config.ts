/**
 * LexyBrain Configuration Module
 *
 * Provides centralized configuration and feature flag management for LexyBrain.
 * All LexyBrain functionality should check isLexyBrainEnabled() before executing.
 *
 * MIGRATION NOTE:
 * - New: Uses RunPod Serverless Queue (RUNPOD_API_KEY, LEXYBRAIN_RUNPOD_ENDPOINT_ID)
 * - Old: Used Load Balancer (LEXYBRAIN_MODEL_URL, LEXYBRAIN_KEY) - DEPRECATED
 */

import { env } from "./env";

// =====================================================
// Core Configuration
// =====================================================

/**
 * Check if LexyBrain is enabled
 * Returns true when:
 * - LEXYBRAIN_ENABLE === "true"
 * - RUNPOD_API_KEY exists (new serverless queue)
 * - OR legacy LEXYBRAIN_MODEL_URL and LEXYBRAIN_KEY exist (deprecated)
 */
export function isLexyBrainEnabled(): boolean {
  const isEnabled = env.LEXYBRAIN_ENABLE === "true";

  // Check new serverless queue configuration
  const hasNewConfig = !!env.RUNPOD_API_KEY;

  // Check legacy load balancer configuration (deprecated)
  const hasLegacyConfig = !!env.LEXYBRAIN_MODEL_URL && !!env.LEXYBRAIN_KEY;

  return isEnabled && (hasNewConfig || hasLegacyConfig);
}

/**
 * Check if using new RunPod Serverless Queue configuration
 */
export function isUsingServerlessQueue(): boolean {
  return !!env.RUNPOD_API_KEY;
}

/**
 * Get the RunPod model endpoint URL (DEPRECATED - for legacy load balancer only)
 * @deprecated Use RunPod Serverless Queue instead
 */
export function getLexyBrainModelUrl(): string {
  if (!env.LEXYBRAIN_MODEL_URL) {
    throw new Error(
      "LEXYBRAIN_MODEL_URL is not configured. Please set this environment variable or migrate to RUNPOD_API_KEY."
    );
  }
  // Trim whitespace that might have been accidentally added in env vars
  return env.LEXYBRAIN_MODEL_URL.trim();
}

/**
 * Get the LexyBrain API key for RunPod authentication (DEPRECATED - for legacy load balancer only)
 * @deprecated Use RUNPOD_API_KEY instead
 */
export function getLexyBrainKey(): string {
  if (!env.LEXYBRAIN_KEY) {
    throw new Error(
      "LEXYBRAIN_KEY is not configured. Please set this environment variable or migrate to RUNPOD_API_KEY."
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
  const defaultMaxLatency = 55000; // 55 seconds default (allows for cold starts while staying under Vercel's 60s limit)

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

/**
 * Check if LexyBrain notifications are enabled
 * Returns true when:
 * - LexyBrain is enabled
 * - LEXYBRAIN_NOTIFICATIONS_ENABLED === "true"
 */
export function isLexyBrainNotificationsEnabled(): boolean {
  return (
    isLexyBrainEnabled() &&
    env.LEXYBRAIN_NOTIFICATIONS_ENABLED === "true"
  );
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
  usingServerlessQueue: boolean;
  modelUrl: string | null;
  modelVersion: string;
  hasApiKey: boolean;
  hasRunPodApiKey: boolean;
  dailyCostCap: number | null;
  maxLatencyMs: number;
} {
  return {
    enabled: isLexyBrainEnabled(),
    usingServerlessQueue: isUsingServerlessQueue(),
    modelUrl: env.LEXYBRAIN_MODEL_URL || null,
    modelVersion: getLexyBrainModelVersion(),
    hasApiKey: !!env.LEXYBRAIN_KEY, // Legacy
    hasRunPodApiKey: !!env.RUNPOD_API_KEY, // New
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
    const hasNewConfig = !!env.RUNPOD_API_KEY;
    const hasLegacyConfig = !!env.LEXYBRAIN_MODEL_URL && !!env.LEXYBRAIN_KEY;

    if (!hasNewConfig && !hasLegacyConfig) {
      throw new Error(
        "LexyBrain is enabled but neither new (RUNPOD_API_KEY) nor legacy (LEXYBRAIN_MODEL_URL, LEXYBRAIN_KEY) configuration is set. " +
        "Please configure RUNPOD_API_KEY for RunPod Serverless Queue."
      );
    }

    // Validate legacy config if present
    if (hasLegacyConfig && env.LEXYBRAIN_MODEL_URL) {
      try {
        new URL(env.LEXYBRAIN_MODEL_URL);
      } catch {
        throw new Error(
          `LEXYBRAIN_MODEL_URL is not a valid URL: ${env.LEXYBRAIN_MODEL_URL}`
        );
      }
    }

    // Warn if using legacy config
    if (hasLegacyConfig && !hasNewConfig) {
      console.warn(
        "⚠️  LexyBrain: Using deprecated Load Balancer configuration (LEXYBRAIN_MODEL_URL, LEXYBRAIN_KEY). " +
        "Please migrate to RunPod Serverless Queue by setting RUNPOD_API_KEY and LEXYBRAIN_RUNPOD_ENDPOINT_ID."
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
