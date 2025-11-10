/**
 * Pricing plan definitions and Stripe configuration
 * These constants match the plan_limits table in the database
 */

import type { PlanCode, PlanLimits } from './types';

/**
 * Plan configurations
 * IMPORTANT: Stripe price IDs should be stored in database (stripe_price_mappings table)
 * and fetched dynamically. These are defaults for type safety.
 *
 * UPDATED: Aligned with new quota strategy (v1)
 * - KS = keyword searches
 * - LB = LexyBrain/RAG calls (tracked separately, see plan_entitlements.rag_messages_per_month)
 * - WL = watchlist keywords (niches_max)
 * - BR = briefs (tracked separately, see plan_entitlements.briefs_per_month)
 */
export const PLAN_CONFIGS: Record<PlanCode, PlanLimits> = {
  free: {
    plan_code: 'free',
    display_name: 'Free',
    price_monthly_cents: 0,
    price_annual_cents: 0,
    searches_per_month: 50,          // KS
    niches_max: 10,                   // WL
    ai_opportunities_per_month: 50,   // Legacy field (kept for compatibility)
    keywords_storage_max: 100,
    features: [
      '50 monthly searches',
      '10 watchlist keywords',
      '20 LexyBrain calls',
      'Basic insights',
      'Extension support',
      'Community support',
    ],
    is_hidden: false,
    sort_order: 1,
  },
  free_extension: {
    plan_code: 'free_extension',
    display_name: 'Free+',
    price_monthly_cents: 0,
    price_annual_cents: 0,
    searches_per_month: 200,          // KS
    niches_max: 30,                   // WL
    ai_opportunities_per_month: 200,  // Legacy field
    keywords_storage_max: 300,
    features: [
      '200 monthly searches',
      '30 watchlist keywords',
      '80 LexyBrain calls',
      '1 brief per month',
      'Extension boost',
      'Community support',
    ],
    is_hidden: false,
    sort_order: 2,
  },
  basic: {
    plan_code: 'basic',
    display_name: 'Basic',
    price_monthly_cents: 699, // $6.99
    price_annual_cents: 6990, // $69.90 (save ~17%)
    searches_per_month: 1000,         // KS
    niches_max: 150,                  // WL
    ai_opportunities_per_month: 1000, // Legacy field
    keywords_storage_max: 1500,
    features: [
      '1,000 monthly searches',
      '150 watchlist keywords',
      '300 LexyBrain calls',
      '4 briefs per month',
      'Advanced insights',
      'Trend analysis',
      'Email support',
    ],
    is_hidden: false,
    sort_order: 3,
  },
  pro: {
    plan_code: 'pro',
    display_name: 'Pro',
    price_monthly_cents: 1299, // $12.99
    price_annual_cents: 12990, // $129.90 (save ~17%)
    searches_per_month: 10000,        // KS
    niches_max: 1000,                 // WL
    ai_opportunities_per_month: 10000, // Legacy field
    keywords_storage_max: 10000,
    features: [
      '10,000 monthly searches',
      '1,000 watchlist keywords',
      '1,000 LexyBrain calls',
      '12 briefs per month',
      'Market Twin simulator',
      'Advanced analytics',
      'Priority support',
      'Export capabilities',
    ],
    is_hidden: false,
    sort_order: 4,
  },
  growth: {
    plan_code: 'growth',
    display_name: 'Growth',
    price_monthly_cents: 5500, // $55.00
    price_annual_cents: 55000, // $550.00 (save ~17%)
    searches_per_month: 50000,        // KS
    niches_max: 5000,                 // WL
    ai_opportunities_per_month: 50000, // Legacy field
    keywords_storage_max: 50000,
    features: [
      '50,000 monthly searches',
      '5,000 watchlist keywords',
      '5,000 LexyBrain calls',
      '30 briefs per month',
      'Unlimited simulators',
      'White-glove support',
      'API access',
      'Team collaboration',
      'Advanced reporting',
    ],
    is_hidden: false, // Now visible
    sort_order: 5,
  },
};

/**
 * Extension trial configuration
 */
export const EXTENSION_TRIAL_DURATION_DAYS = 14;
export const EXTENSION_TRIAL_PLAN = 'pro';

/**
 * Referral rewards configuration
 */
export const REFERRAL_REWARDS = {
  BASIC: {
    referrals_required: 1,
    plan: 'basic' as const,
    duration_months: 3,
  },
  PRO: {
    referrals_required: 3,
    plan: 'pro' as const,
    duration_months: 3,
  },
};

/**
 * Usage warning thresholds (percentages)
 */
export const USAGE_WARNING_THRESHOLDS = {
  WARNING: 80, // Show warning at 80%
  CRITICAL: 90, // Show critical warning at 90%
  BLOCKED: 100, // Block at 100%
};

/**
 * Get plan configuration by code
 */
export function getPlanConfig(planCode: PlanCode): PlanLimits {
  return PLAN_CONFIGS[planCode];
}

/**
 * Get all visible plans (not hidden)
 */
export function getVisiblePlans(): PlanLimits[] {
  return Object.values(PLAN_CONFIGS)
    .filter(plan => !plan.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Get all plans including hidden
 */
export function getAllPlans(): PlanLimits[] {
  return Object.values(PLAN_CONFIGS)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Check if plan code is valid
 */
export function isValidPlanCode(code: string): code is PlanCode {
  return code in PLAN_CONFIGS;
}
