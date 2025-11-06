/**
 * Pricing plan definitions and Stripe configuration
 * These constants match the plan_limits table in the database
 */

import type { PlanCode, PlanLimits } from './types';

/**
 * Plan configurations
 * IMPORTANT: Stripe price IDs should be stored in database (stripe_price_mappings table)
 * and fetched dynamically. These are defaults for type safety.
 */
export const PLAN_CONFIGS: Record<PlanCode, PlanLimits> = {
  free: {
    plan_code: 'free',
    display_name: 'Free',
    price_monthly_cents: 0,
    price_annual_cents: 0,
    searches_per_month: 10,
    niches_max: 1,
    ai_opportunities_per_month: 10,
    keywords_storage_max: 50,
    features: [
      'Basic keyword research',
      '10 monthly searches',
      '1 niche tracking',
      '10 AI opportunities',
      'Extension support',
      'Community support',
    ],
    is_hidden: false,
    sort_order: 1,
  },
  basic: {
    plan_code: 'basic',
    display_name: 'Basic',
    price_monthly_cents: 699, // $6.99
    price_annual_cents: 6990, // $69.90 (save ~17%)
    searches_per_month: 100,
    niches_max: 10,
    ai_opportunities_per_month: 100,
    keywords_storage_max: 500,
    features: [
      '100 monthly searches',
      '10 niche projects',
      '100 AI opportunities',
      'Advanced keyword insights',
      'Trend analysis',
      'Email support',
      'Chrome extension boost',
    ],
    is_hidden: false,
    sort_order: 2,
  },
  pro: {
    plan_code: 'pro',
    display_name: 'Pro',
    price_monthly_cents: 1299, // $12.99
    price_annual_cents: 12990, // $129.90 (save ~17%)
    searches_per_month: 500,
    niches_max: 50,
    ai_opportunities_per_month: 500,
    keywords_storage_max: 5000,
    features: [
      '500 monthly searches',
      '50 niche projects',
      '500 AI opportunities',
      'Advanced analytics dashboard',
      'Market Twin simulator',
      'Trend forecasting',
      'Priority support',
      'Export capabilities',
    ],
    is_hidden: false,
    sort_order: 3,
  },
  growth: {
    plan_code: 'growth',
    display_name: 'Growth',
    price_monthly_cents: 2499, // $24.99
    price_annual_cents: 24990, // $249.90 (save ~17%)
    searches_per_month: -1, // Unlimited
    niches_max: -1, // Unlimited
    ai_opportunities_per_month: -1, // Unlimited
    keywords_storage_max: -1, // Unlimited
    features: [
      'Unlimited searches',
      'Unlimited niche projects',
      'Unlimited AI opportunities',
      'Unlimited keyword storage',
      'White-glove support',
      'Custom integrations',
      'API access',
      'Team collaboration',
      'Advanced reporting',
    ],
    is_hidden: true, // Hidden from public pricing page
    sort_order: 4,
  },
};

/**
 * Extension Free+ boost multipliers
 */
export const EXTENSION_FREE_PLUS_MULTIPLIER = 2.5;
export const EXTENSION_FREE_PLUS_DURATION_DAYS = 30;

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
