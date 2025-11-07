/**
 * LexyBrain Output Schemas
 *
 * Defines TypeScript types and runtime validators (Zod) for all LexyBrain outputs.
 * All LexyBrain model responses must conform to these strict JSON schemas.
 */

import { z } from "zod";

// =====================================================
// Market Brief Schema
// =====================================================

export const MarketBriefOpportunitySchema = z.object({
  term: z.string().min(1),
  why: z.string().min(1),
});

export const MarketBriefRiskSchema = z.object({
  term: z.string().min(1),
  why: z.string().min(1),
});

export const MarketBriefSchema = z.object({
  niche: z.string().min(1),
  summary: z.string().min(1),
  top_opportunities: z.array(MarketBriefOpportunitySchema).max(10),
  risks: z.array(MarketBriefRiskSchema).max(10),
  actions: z.array(z.string().min(1)).max(10),
  confidence: z.number().min(0).max(1),
});

export type MarketBrief = z.infer<typeof MarketBriefSchema>;
export type MarketBriefOpportunity = z.infer<
  typeof MarketBriefOpportunitySchema
>;
export type MarketBriefRisk = z.infer<typeof MarketBriefRiskSchema>;

// =====================================================
// Opportunity Radar Schema
// =====================================================

export const OpportunityRadarScoresSchema = z.object({
  demand: z.number().min(0).max(1),
  momentum: z.number().min(0).max(1),
  competition: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  profit: z.number().min(0).max(1),
});

export const OpportunityRadarItemSchema = z.object({
  term: z.string().min(1),
  scores: OpportunityRadarScoresSchema,
  comment: z.string().min(1),
});

export const OpportunityRadarSchema = z.object({
  items: z.array(OpportunityRadarItemSchema).max(20),
});

export type OpportunityRadar = z.infer<typeof OpportunityRadarSchema>;
export type OpportunityRadarItem = z.infer<typeof OpportunityRadarItemSchema>;
export type OpportunityRadarScores = z.infer<
  typeof OpportunityRadarScoresSchema
>;

// =====================================================
// Ad Insight Schema
// =====================================================

export const AdInsightBudgetSplitSchema = z.object({
  term: z.string().min(1),
  daily_cents: z.number().int().min(0),
  expected_cpc_cents: z.number().int().min(0),
  expected_clicks: z.number().int().min(0),
});

export const AdInsightSchema = z.object({
  budget_split: z.array(AdInsightBudgetSplitSchema).max(20),
  notes: z.string(),
});

export type AdInsight = z.infer<typeof AdInsightSchema>;
export type AdInsightBudgetSplit = z.infer<typeof AdInsightBudgetSplitSchema>;

// =====================================================
// Risk Sentinel Schema
// =====================================================

export const RiskSeveritySchema = z.enum(["low", "medium", "high"]);

export const RiskSentinelAlertSchema = z.object({
  term: z.string().min(1),
  issue: z.string().min(1),
  severity: RiskSeveritySchema,
  evidence: z.string().min(1),
  action: z.string().min(1),
});

export const RiskSentinelSchema = z.object({
  alerts: z.array(RiskSentinelAlertSchema).max(20),
});

export type RiskSentinel = z.infer<typeof RiskSentinelSchema>;
export type RiskSentinelAlert = z.infer<typeof RiskSentinelAlertSchema>;
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

// =====================================================
// Union Type for All Outputs
// =====================================================

export type LexyBrainOutput =
  | MarketBrief
  | OpportunityRadar
  | AdInsight
  | RiskSentinel;

export type LexyBrainOutputType = "market_brief" | "radar" | "ad_insight" | "risk";

// =====================================================
// Schema Helpers
// =====================================================

/**
 * Get the Zod schema for a given output type
 */
export function getLexyBrainSchema(
  type: LexyBrainOutputType
): z.ZodType<LexyBrainOutput> {
  switch (type) {
    case "market_brief":
      return MarketBriefSchema as z.ZodType<LexyBrainOutput>;
    case "radar":
      return OpportunityRadarSchema as z.ZodType<LexyBrainOutput>;
    case "ad_insight":
      return AdInsightSchema as z.ZodType<LexyBrainOutput>;
    case "risk":
      return RiskSentinelSchema as z.ZodType<LexyBrainOutput>;
  }
}

/**
 * Get a human-readable description of the schema for prompt engineering
 */
export function getSchemaDescription(type: LexyBrainOutputType): string {
  switch (type) {
    case "market_brief":
      return `
OUTPUT SCHEMA (MarketBrief):
{
  "niche": "string (required, the niche/market being analyzed)",
  "summary": "string (required, 2-4 sentence overview)",
  "top_opportunities": [
    {
      "term": "string (required, keyword)",
      "why": "string (required, explain the opportunity)"
    }
  ],
  "risks": [
    {
      "term": "string (required, keyword)",
      "why": "string (required, explain the risk)"
    }
  ],
  "actions": ["string (required, actionable recommendation)"],
  "confidence": number (required, 0.0 to 1.0)
}

REQUIREMENTS:
- Return ONLY valid JSON
- No markdown formatting, no code fences
- top_opportunities: max 10 items
- risks: max 10 items
- actions: max 10 items
- confidence must be between 0 and 1
`.trim();

    case "radar":
      return `
OUTPUT SCHEMA (OpportunityRadar):
{
  "items": [
    {
      "term": "string (required, keyword)",
      "scores": {
        "demand": number (required, 0.0 to 1.0),
        "momentum": number (required, 0.0 to 1.0),
        "competition": number (required, 0.0 to 1.0, lower is better),
        "novelty": number (required, 0.0 to 1.0),
        "profit": number (required, 0.0 to 1.0)
      },
      "comment": "string (required, brief insight)"
    }
  ]
}

REQUIREMENTS:
- Return ONLY valid JSON
- No markdown formatting, no code fences
- items: max 20 entries
- All scores must be between 0 and 1
- Higher scores are better except for competition (lower is better)
`.trim();

    case "ad_insight":
      return `
OUTPUT SCHEMA (AdInsight):
{
  "budget_split": [
    {
      "term": "string (required, keyword)",
      "daily_cents": integer (required, cents per day for this term, min 0),
      "expected_cpc_cents": integer (required, expected cost-per-click in cents),
      "expected_clicks": integer (required, estimated daily clicks)
    }
  ],
  "notes": "string (additional recommendations)"
}

REQUIREMENTS:
- Return ONLY valid JSON
- No markdown formatting, no code fences
- budget_split: max 20 items
- All monetary values in cents (integer)
- daily_cents sum should approximately match total budget
`.trim();

    case "risk":
      return `
OUTPUT SCHEMA (RiskSentinel):
{
  "alerts": [
    {
      "term": "string (required, keyword)",
      "issue": "string (required, description of the risk)",
      "severity": "low" | "medium" | "high" (required),
      "evidence": "string (required, data supporting this risk)",
      "action": "string (required, recommended action)"
    }
  ]
}

REQUIREMENTS:
- Return ONLY valid JSON
- No markdown formatting, no code fences
- alerts: max 20 items
- severity must be exactly "low", "medium", or "high"
- Focus on actionable risks
`.trim();
  }
}

/**
 * Validate LexyBrain output against its schema
 * Throws ZodError if validation fails
 */
export function validateLexyBrainOutput(
  type: LexyBrainOutputType,
  data: unknown
): LexyBrainOutput {
  const schema = getLexyBrainSchema(type);
  return schema.parse(data);
}

/**
 * Safely validate LexyBrain output, returning success/error result
 */
export function safeValidateLexyBrainOutput(
  type: LexyBrainOutputType,
  data: unknown
): { success: true; data: LexyBrainOutput } | { success: false; error: string } {
  const schema = getLexyBrainSchema(type);
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
  };
}

// =====================================================
// Example Data (for Testing)
// =====================================================

export const EXAMPLE_MARKET_BRIEF: MarketBrief = {
  niche: "Handmade Jewelry",
  summary:
    "The handmade jewelry market shows strong demand with moderate competition. Growing interest in personalized and sustainable products creates opportunities.",
  top_opportunities: [
    { term: "custom birthstone rings", why: "High demand, low competition" },
    { term: "eco friendly necklaces", why: "Growing sustainability trend" },
  ],
  risks: [
    {
      term: "generic jewelry",
      why: "Oversaturated market with price competition",
    },
  ],
  actions: [
    "Focus on personalization and custom orders",
    "Emphasize sustainable materials in listings",
  ],
  confidence: 0.85,
};

export const EXAMPLE_OPPORTUNITY_RADAR: OpportunityRadar = {
  items: [
    {
      term: "custom birthstone rings",
      scores: {
        demand: 0.85,
        momentum: 0.72,
        competition: 0.35,
        novelty: 0.68,
        profit: 0.79,
      },
      comment: "Strong opportunity with growing interest",
    },
  ],
};

export const EXAMPLE_AD_INSIGHT: AdInsight = {
  budget_split: [
    {
      term: "custom birthstone rings",
      daily_cents: 500,
      expected_cpc_cents: 45,
      expected_clicks: 11,
    },
  ],
  notes: "Focus budget on high-converting custom terms",
};

export const EXAMPLE_RISK_SENTINEL: RiskSentinel = {
  alerts: [
    {
      term: "generic jewelry",
      issue: "Market saturation detected",
      severity: "high",
      evidence: "Competition score 0.92, declining trend momentum",
      action: "Differentiate with unique designs or pivot to specific niche",
    },
  ],
};
