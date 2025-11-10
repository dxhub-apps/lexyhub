/**
 * Pricing tier types and utilities for LexyHub billing system
 */

export type PlanCode = 'free' | 'free_extension' | 'basic' | 'pro' | 'growth';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'unpaid';

export interface PlanLimits {
  plan_code: PlanCode;
  display_name: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  searches_per_month: number;
  niches_max: number;
  ai_opportunities_per_month: number;
  keywords_storage_max: number;
  features: string[];
  is_hidden: boolean;
  sort_order: number;
}

export interface StripePriceMapping {
  plan_code: PlanCode;
  billing_cycle: BillingCycle;
  stripe_price_id: string;
  environment: 'test' | 'production';
  is_active: boolean;
}

export interface UsageWarning {
  id: string;
  user_id: string;
  quota_key: string;
  threshold_percent: number;
  warning_sent_at: string;
  period_start: string;
  usage_at_warning: number;
  limit_at_warning: number;
}

export interface UpsellTrigger {
  id: string;
  user_id: string;
  trigger_type: 'quota_exceeded' | 'feature_locked' | 'heavy_usage' | 'admin_offer';
  target_plan: PlanCode;
  trigger_context: Record<string, unknown>;
  shown_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface PricingAnalytics {
  id: number;
  user_id: string | null;
  session_id: string | null;
  event_type: 'page_view' | 'tier_clicked' | 'checkout_started' | 'checkout_completed' | 'checkout_abandoned';
  plan_code: PlanCode | null;
  billing_cycle: BillingCycle | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserSubscription {
  user_id: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_expires_at: string | null;
  extension_free_plus_expires_at: string | null;
}

/**
 * Plan tier hierarchy for upgrade/downgrade logic
 */
export const PLAN_HIERARCHY: Record<PlanCode, number> = {
  free: 0,
  free_extension: 0, // Same tier as free, just with boosted limits
  basic: 1,
  pro: 2,
  growth: 3,
};

/**
 * Check if a plan is an upgrade from current plan
 */
export function isUpgrade(currentPlan: PlanCode, targetPlan: PlanCode): boolean {
  return PLAN_HIERARCHY[targetPlan] > PLAN_HIERARCHY[currentPlan];
}

/**
 * Check if a plan is a downgrade from current plan
 */
export function isDowngrade(currentPlan: PlanCode, targetPlan: PlanCode): boolean {
  return PLAN_HIERARCHY[targetPlan] < PLAN_HIERARCHY[currentPlan];
}

/**
 * Get next upgrade tier from current plan
 */
export function getNextUpgradeTier(currentPlan: PlanCode): PlanCode | null {
  const current = PLAN_HIERARCHY[currentPlan];
  const upgrades = Object.entries(PLAN_HIERARCHY)
    .filter(([_, value]) => value === current + 1)
    .map(([key]) => key as PlanCode);

  return upgrades[0] ?? null;
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number, cycle?: BillingCycle): string {
  const dollars = cents / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(dollars);

  if (cycle === 'annual') {
    return `${formatted}/year`;
  } else if (cycle === 'monthly') {
    return `${formatted}/mo`;
  }

  return formatted;
}

/**
 * Calculate savings percentage for annual billing
 */
export function calculateAnnualSavings(monthlyPrice: number, annualPrice: number): number {
  const monthlyTotal = monthlyPrice * 12;
  const savings = ((monthlyTotal - annualPrice) / monthlyTotal) * 100;
  return Math.round(savings);
}

/**
 * Check if usage is at or exceeds warning threshold
 */
export function shouldWarnUsage(used: number, limit: number, threshold: number = 80): boolean {
  if (limit === -1) return false; // Unlimited
  const percentage = (used / limit) * 100;
  return percentage >= threshold;
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(used: number, limit: number): number {
  if (limit === -1) return 0; // Unlimited
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Format limit for display (handles -1 as unlimited)
 */
export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toLocaleString();
}

/**
 * Get recommended upgrade plan based on usage patterns
 */
export function getRecommendedUpgrade(
  currentPlan: PlanCode,
  usage: { searches: number; niches: number; ai_opportunities: number }
): PlanCode | null {
  // If already on Growth, no upgrade needed
  if (currentPlan === 'growth') return null;

  // Heavy users (consistently hitting limits) should upgrade to Growth
  const totalUsageScore = usage.searches + usage.niches + usage.ai_opportunities;
  if (totalUsageScore > 1000 && currentPlan === 'pro') {
    return 'growth';
  }

  // Otherwise, suggest next tier
  return getNextUpgradeTier(currentPlan);
}

/**
 * Check if user has active Free+ extension boost
 */
export function hasActiveFreePlus(extensionFreePlusExpiresAt: string | null): boolean {
  if (!extensionFreePlusExpiresAt) return false;
  return new Date(extensionFreePlusExpiresAt) > new Date();
}

/**
 * Check if user is in trial period
 */
export function isInTrial(trialExpiresAt: string | null): boolean {
  if (!trialExpiresAt) return false;
  return new Date(trialExpiresAt) > new Date();
}

/**
 * Get days remaining in trial or Free+ boost
 */
export function getDaysRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
