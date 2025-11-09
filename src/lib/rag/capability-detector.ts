/**
 * Ask LexyBrain RAG - Capability Detector
 *
 * Detects user intent and maps to RAG capability
 */

import { logger } from "@/lib/logger";
import type { RagCapability } from "./types";

// =====================================================
// Heuristic Detection (Fast)
// =====================================================

/**
 * Detect capability using keyword heuristics
 * Fast fallback when LLM classification is unavailable
 */
export function detectCapabilityHeuristic(message: string): RagCapability {
  const normalized = message.toLowerCase().trim();

  // Keyword patterns for each capability
  const patterns: Record<RagCapability, string[]> = {
    competitor_intel: [
      'competitor',
      'competing',
      'competition listing',
      'other seller',
      'shop performance',
      'top seller',
      'bestseller',
      'similar shop',
      'pricing strategy',
    ],
    alert_explanation: [
      'alert',
      'warning',
      'risk',
      'violation',
      'compliance',
      'policy',
      'trademark',
      'copyright',
      'banned',
      'suspended',
    ],
    keyword_explanation: [
      'keyword',
      'term',
      'search term',
      'why is',
      'what does',
      'explain',
      'meaning of',
      'definition',
      'related keyword',
    ],
    market_brief: [
      'market',
      'niche',
      'industry',
      'overview',
      'analysis',
      'trend',
      'opportunity',
      'brief',
      'summary',
      'state of',
    ],
    general_chat: [],
  };

  // Count matches for each capability
  const scores: Record<RagCapability, number> = {
    competitor_intel: 0,
    alert_explanation: 0,
    keyword_explanation: 0,
    market_brief: 0,
    general_chat: 0,
  };

  for (const [capability, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        scores[capability as RagCapability]++;
      }
    }
  }

  // Find highest score
  let maxScore = 0;
  let detected: RagCapability = 'general_chat';

  for (const [capability, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detected = capability as RagCapability;
    }
  }

  logger.debug(
    {
      type: 'rag_capability_detected',
      message_preview: normalized.slice(0, 50),
      detected,
      scores,
    },
    'Capability detected via heuristics'
  );

  return detected;
}

// =====================================================
// LLM-Based Classification (Optional, High Quality)
// =====================================================

/**
 * Classify intent using LLM (more accurate but slower)
 * Falls back to heuristic if LLM unavailable
 */
export async function classifyIntent(message: string): Promise<RagCapability> {
  try {
    // For now, use heuristic
    // Future: integrate with OpenAI intent classifier or LexyBrain
    return detectCapabilityHeuristic(message);
  } catch (error) {
    logger.warn(
      {
        type: 'rag_intent_classification_failed',
        error: error instanceof Error ? error.message : String(error),
      },
      'LLM intent classification failed, falling back to heuristic'
    );
    return detectCapabilityHeuristic(message);
  }
}

/**
 * Get retrieval scope for a capability
 */
export function getRetrievalScopeForCapability(
  capability: RagCapability
): string[] {
  const scopes: Record<RagCapability, string[]> = {
    market_brief: ['keywords', 'trends'],
    competitor_intel: ['listings', 'shops', 'keywords'],
    keyword_explanation: ['keywords', 'keyword_history', 'alerts'],
    alert_explanation: ['alerts', 'risk_rules', 'docs'],
    general_chat: ['docs', 'user_keywords', 'user_watchlists'],
  };

  return scopes[capability] || ['docs'];
}
