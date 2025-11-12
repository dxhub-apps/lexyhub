/**
 * LexyBrain Prompt Builder
 *
 * Constructs prompts for the LexyBrain LLM based on:
 * - Insight type (market_brief, radar, ad_insight, risk)
 * - Context data (market, keywords, metrics)
 * - Admin-configurable prompt settings
 *
 * All prompts are deterministic and fully testable.
 */

import { getSchemaDescription, type LexyBrainOutputType } from "./lexybrain-schemas";

// =====================================================
// Types
// =====================================================

export interface PromptConfig {
  system_instructions: string;
  constraints: Record<string, unknown>;
}

export interface MarketBriefContext {
  market: string;
  niche_terms: string[];
  keywords: Array<{
    term: string;
    demand_index?: number | null;
    competition_score?: number | null;
    trend_momentum?: number | null;
    engagement_score?: number | null;
    ai_opportunity_score?: number | null;
  }>;
  seasonal_context?: {
    current_periods?: Array<{
      name: string;
      description: string;
      days_remaining: number;
      weight: number;
      tags: string[];
    }>;
    upcoming_periods?: Array<{
      name: string;
      description: string;
      days_until: number;
      weight: number;
      tags: string[];
    }>;
  };
  metadata?: Record<string, unknown>;
}

export interface RadarContext {
  market: string;
  niche_terms: string[];
  keywords: Array<{
    term: string;
    demand_index?: number | null;
    competition_score?: number | null;
    trend_momentum?: number | null;
    engagement_score?: number | null;
    ai_opportunity_score?: number | null;
  }>;
  seasonal_context?: {
    current_periods?: Array<{
      name: string;
      description: string;
      days_remaining: number;
      weight: number;
      tags: string[];
    }>;
    upcoming_periods?: Array<{
      name: string;
      description: string;
      days_until: number;
      weight: number;
      tags: string[];
    }>;
  };
  metadata?: Record<string, unknown>;
}

export interface AdInsightContext {
  market: string;
  niche_terms: string[];
  budget_cents: number;
  keywords: Array<{
    term: string;
    demand_index?: number | null;
    competition_score?: number | null;
    trend_momentum?: number | null;
    engagement_score?: number | null;
  }>;
  seasonal_context?: {
    current_periods?: Array<{
      name: string;
      description: string;
      days_remaining: number;
      weight: number;
      tags: string[];
    }>;
    upcoming_periods?: Array<{
      name: string;
      description: string;
      days_until: number;
      weight: number;
      tags: string[];
    }>;
  };
  metadata?: Record<string, unknown>;
}

export interface RiskContext {
  market: string;
  niche_terms: string[];
  keywords: Array<{
    term: string;
    demand_index?: number | null;
    competition_score?: number | null;
    trend_momentum?: number | null;
    engagement_score?: number | null;
  }>;
  seasonal_context?: {
    current_periods?: Array<{
      name: string;
      description: string;
      days_remaining: number;
      weight: number;
      tags: string[];
    }>;
    upcoming_periods?: Array<{
      name: string;
      description: string;
      days_until: number;
      weight: number;
      tags: string[];
    }>;
  };
  metadata?: Record<string, unknown>;
}

export type LexyBrainContext =
  | MarketBriefContext
  | RadarContext
  | AdInsightContext
  | RiskContext;

// =====================================================
// Base Prompt Template
// =====================================================

const BASE_SYSTEM_INSTRUCTIONS = `You are LexyBrain, an AI market intelligence system for Etsy and marketplace sellers.

Your role is to analyze keyword data, market trends, and competition metrics to provide actionable insights for online sellers.

CRITICAL RULES:
1. Return ONLY valid JSON - no explanations, no markdown, no code fences
2. Follow the exact schema provided
3. Base recommendations on the provided data
4. Be concise and actionable
5. All numeric scores must be within specified ranges`;

// =====================================================
// Core Prompt Builder
// =====================================================

/**
 * Build a complete prompt for LexyBrain LLM
 */
export function buildLexyBrainPrompt(
  type: LexyBrainOutputType,
  context: LexyBrainContext,
  promptConfig?: PromptConfig
): string {
  const sections: string[] = [];

  // 1. System Instructions
  sections.push("=== SYSTEM INSTRUCTIONS ===");
  sections.push("");
  if (promptConfig?.system_instructions) {
    sections.push(promptConfig.system_instructions);
  } else {
    sections.push(BASE_SYSTEM_INSTRUCTIONS);
  }
  sections.push("");

  // 2. Type-Specific Instructions
  sections.push("=== TASK ===");
  sections.push("");
  sections.push(getTypeSpecificInstructions(type, promptConfig?.constraints));
  sections.push("");

  // 3. Schema Definition
  sections.push("=== OUTPUT SCHEMA ===");
  sections.push("");
  sections.push(getSchemaDescription(type));
  sections.push("");

  // 4. Context Data
  sections.push("=== CONTEXT DATA ===");
  sections.push("");
  sections.push(formatContextData(type, context));
  sections.push("");

  // 5. Final Instruction
  sections.push("=== OUTPUT ===");
  sections.push("");
  sections.push("Return ONLY the JSON object. No additional text.");
  sections.push("");

  return sections.join("\n");
}

// =====================================================
// Type-Specific Instructions
// =====================================================

function getTypeSpecificInstructions(
  type: LexyBrainOutputType,
  constraints?: Record<string, unknown>
): string {
  const maxItems = (constraints?.max_items as number) || null;
  const maxOpportunities = (constraints?.max_opportunities as number) || 5;
  const maxRisks = (constraints?.max_risks as number) || 3;
  const maxActions = (constraints?.max_actions as number) || 5;
  const maxAlerts = (constraints?.max_alerts as number) || 5;
  const minConfidence = (constraints?.min_confidence as number) || 0.0;

  switch (type) {
    case "market_brief":
      return `Generate a comprehensive market brief for the provided niche.

FOCUS AREAS:
- Identify ${maxOpportunities} top keyword opportunities with high potential
- Highlight ${maxRisks} key risks or challenges
- Provide ${maxActions} specific actionable recommendations
- Assess overall market confidence (${minConfidence} to 1.0)
- **CRITICAL**: Factor in seasonal opportunities and timing

ANALYSIS APPROACH:
- High demand + low competition = strong opportunity
- High trend momentum = growing market
- High competition + declining trends = risk
- Consider engagement scores for seller viability
- **Account for current and upcoming seasonal periods** (weight multipliers affect demand)
- Prioritize opportunities aligned with upcoming peak seasons

OUTPUT:
Comprehensive market brief in the specified JSON format.`;

    case "radar":
      return `Analyze keywords and score each across 5 dimensions.

SCORING DIMENSIONS:
1. demand (0-1): How much search/buyer interest exists
2. momentum (0-1): Is the trend growing or declining
3. competition (0-1): Market saturation (LOWER is better)
4. novelty (0-1): How unique/fresh is this opportunity
5. profit (0-1): Estimated profit potential

SCORING GUIDELINES:
- Use provided metrics (demand_index, competition_score, trend_momentum)
- Balance all dimensions for overall opportunity assessment
- **Boost scores for keywords aligned with active or upcoming seasonal periods**
- Consider seasonal weight multipliers when assessing demand
- Include brief comment explaining the scoring (mention seasonal relevance when applicable)
${maxItems ? `- Return up to ${maxItems} top opportunities` : ""}

OUTPUT:
OpportunityRadar JSON with scored keyword items.`;

    case "ad_insight":
      return `Generate advertising budget recommendations.

TASK:
Allocate the provided budget across keywords to maximize ROI.

FACTORS TO CONSIDER:
- Keywords with high demand deserve more budget
- Lower competition keywords typically have lower CPC
- Growing trends (momentum) indicate good ad performance
- Balance coverage across multiple terms vs. concentration

BUDGET ALLOCATION:
- Split total budget across recommended terms
- Estimate realistic CPC based on competition
- Calculate expected daily clicks
- Provide strategic notes

OUTPUT:
AdInsight JSON with budget split recommendations.`;

    case "risk":
      return `Identify market risks and challenges.

FOCUS AREAS:
- Oversaturated markets (high competition)
- Declining trends (negative momentum)
- Low engagement despite high competition
- Terms with poor opportunity scores
${maxAlerts ? `- Report up to ${maxAlerts} critical alerts` : ""}

SEVERITY ASSESSMENT:
- high: Immediate action required, significant impact
- medium: Monitor closely, moderate concern
- low: Minor issue, awareness level

REQUIREMENTS:
- Provide specific evidence from the data
- Suggest concrete actions to mitigate
- Prioritize actionable risks

OUTPUT:
RiskSentinel JSON with risk alerts.`;
  }
}

// =====================================================
// Context Formatting
// =====================================================

function formatContextData(
  type: LexyBrainOutputType,
  context: LexyBrainContext
): string {
  const sections: string[] = [];

  // Market and Niche
  sections.push(`Market: ${context.market}`);
  sections.push(
    `Niche Terms: ${context.niche_terms.length > 0 ? context.niche_terms.join(", ") : "General market analysis"}`
  );
  sections.push("");

  // Budget (for ad_insight only)
  if (type === "ad_insight" && "budget_cents" in context) {
    const budgetDollars = (context.budget_cents / 100).toFixed(2);
    sections.push(`Daily Budget: $${budgetDollars}`);
    sections.push("");
  }

  // Keywords Data
  sections.push(`Keywords (${context.keywords.length} total):`);
  sections.push("");

  if (context.keywords.length === 0) {
    sections.push("No keyword data available.");
  } else {
    // Limit to top 50 keywords to avoid token overflow
    const keywordsToShow = context.keywords.slice(0, 50);

    sections.push("```json");
    sections.push(JSON.stringify(keywordsToShow, null, 2));
    sections.push("```");

    if (context.keywords.length > 50) {
      sections.push("");
      sections.push(
        `Note: Showing top 50 of ${context.keywords.length} keywords. Focus on these highest-priority terms.`
      );
    }
  }

  // Seasonal Context
  if ("seasonal_context" in context && context.seasonal_context) {
    sections.push("");
    sections.push("=== SEASONAL OPPORTUNITIES (CRITICAL FOR SELLERS) ===");
    sections.push("");

    const { current_periods, upcoming_periods } = context.seasonal_context;

    if (current_periods && current_periods.length > 0) {
      sections.push("🎯 ACTIVE NOW:");
      current_periods.forEach((period) => {
        sections.push(
          `  • ${period.name} (${period.days_remaining} days left) - Weight: ${period.weight}x`
        );
        if (period.description) {
          sections.push(`    ${period.description}`);
        }
      });
      sections.push("");
    }

    if (upcoming_periods && upcoming_periods.length > 0) {
      sections.push("📅 UPCOMING (Prepare Now):");
      upcoming_periods.forEach((period) => {
        sections.push(
          `  • ${period.name} (in ${period.days_until} days) - Weight: ${period.weight}x`
        );
        if (period.description) {
          sections.push(`    ${period.description}`);
        }
      });
      sections.push("");
    }

    if (
      (current_periods && current_periods.length > 0) ||
      (upcoming_periods && upcoming_periods.length > 0)
    ) {
      sections.push(
        "⚠️ IMPORTANT: Factor these seasonal opportunities into your analysis."
      );
      sections.push(
        "   Sellers should optimize listings and prepare inventory for upcoming peak periods."
      );
      sections.push("");
    }
  }

  // Additional Metadata
  if (context.metadata && Object.keys(context.metadata).length > 0) {
    sections.push("");
    sections.push("Additional Context:");
    sections.push("```json");
    sections.push(JSON.stringify(context.metadata, null, 2));
    sections.push("```");
  }

  return sections.join("\n");
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Estimate token count for a prompt (rough approximation)
 * Used for cost estimation and monitoring
 */
export function estimatePromptTokens(prompt: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(prompt.length / 4);
}

/**
 * Get default prompt config for a type
 */
export function getDefaultPromptConfig(
  type: LexyBrainOutputType
): PromptConfig {
  const baseConfig = {
    system_instructions: BASE_SYSTEM_INSTRUCTIONS,
    constraints: {},
  };

  switch (type) {
    case "market_brief":
      return {
        ...baseConfig,
        constraints: {
          max_opportunities: 5,
          max_risks: 3,
          max_actions: 5,
          min_confidence: 0.7,
        },
      };

    case "radar":
      return {
        ...baseConfig,
        constraints: {
          max_items: 10,
          score_range: [0, 1],
          require_comment: true,
        },
      };

    case "ad_insight":
      return {
        ...baseConfig,
        constraints: {
          max_terms: 8,
          min_daily_cents: 100,
          max_daily_cents: 50000,
        },
      };

    case "risk":
      return {
        ...baseConfig,
        constraints: {
          max_alerts: 5,
          severity_levels: ["low", "medium", "high"],
        },
      };
  }
}

/**
 * Validate that context has required fields for the type
 */
export function validateContext(
  type: LexyBrainOutputType,
  context: LexyBrainContext
): { valid: boolean; error?: string } {
  if (!context.market || context.market.trim().length === 0) {
    return { valid: false, error: "Market is required" };
  }

  if (!Array.isArray(context.niche_terms)) {
    return { valid: false, error: "niche_terms must be an array" };
  }

  if (!Array.isArray(context.keywords)) {
    return { valid: false, error: "keywords must be an array" };
  }

  if (type === "ad_insight") {
    const adContext = context as AdInsightContext;
    if (
      typeof adContext.budget_cents !== "number" ||
      adContext.budget_cents <= 0
    ) {
      return {
        valid: false,
        error: "budget_cents must be a positive number for ad_insight",
      };
    }
  }

  return { valid: true };
}
