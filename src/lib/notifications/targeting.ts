/**
 * Notification targeting service - Handles audience filtering and user matching
 */

import { getSupabaseServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type { Notification, AudienceFilter } from './types';

const log = logger.child({ module: 'notifications/targeting' });

/**
 * Get eligible user IDs for a notification based on targeting rules
 */
export async function getEligibleUsers(notification: Notification): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const { audience_scope, audience_filter, segment_id } = notification;

  let userIds: string[] = [];

  switch (audience_scope) {
    case 'all':
      userIds = await getAllUsers();
      break;

    case 'plan':
      userIds = await getUsersByPlanCodes(audience_filter.plan_codes || []);
      break;

    case 'user_ids':
      userIds = audience_filter.user_ids || [];
      break;

    case 'segment':
      if (segment_id) {
        userIds = await getUsersBySegment(segment_id);
      } else {
        log.warn({ notification_id: notification.id }, 'Segment ID is missing for segment scope');
      }
      break;

    case 'workspace':
      // Future: workspace-based targeting
      log.warn({ notification_id: notification.id }, 'Workspace targeting not yet implemented');
      break;

    default:
      log.error({ notification_id: notification.id, scope: audience_scope }, 'Unknown audience scope');
  }

  // Apply additional filters if specified
  if (Object.keys(audience_filter).length > 0 && audience_scope !== 'user_ids') {
    userIds = await applyFilters(userIds, audience_filter);
  }

  log.info(
    {
      notification_id: notification.id,
      scope: audience_scope,
      eligible_count: userIds.length,
    },
    'Resolved eligible users'
  );

  return userIds;
}

/**
 * Get all active user IDs
 */
async function getAllUsers(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.from('user_profiles').select('user_id');

  if (error) {
    log.error({ error }, 'Failed to fetch all users');
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data || []).map((u) => u.user_id);
}

/**
 * Get user IDs by plan codes
 */
async function getUsersByPlanCodes(planCodes: string[]): Promise<string[]> {
  if (planCodes.length === 0) {
    return [];
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .in('plan', planCodes);

  if (error) {
    log.error({ error, plan_codes: planCodes }, 'Failed to fetch users by plan');
    throw new Error(`Failed to fetch users by plan: ${error.message}`);
  }

  return (data || []).map((u) => u.user_id);
}

/**
 * Get user IDs by segment
 */
async function getUsersBySegment(segmentId: string): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Get segment filters
  const { data: segment, error: segmentError } = await supabase
    .from('notification_segments')
    .select('filters')
    .eq('id', segmentId)
    .single();

  if (segmentError || !segment) {
    log.error({ error: segmentError, segment_id: segmentId }, 'Failed to fetch segment');
    throw new Error('Segment not found');
  }

  // Start with all users and apply filters
  const allUsers = await getAllUsers();
  return await applyFilters(allUsers, segment.filters);
}

/**
 * Apply filters to a list of user IDs
 */
async function applyFilters(userIds: string[], filters: Record<string, any>): Promise<string[]> {
  if (userIds.length === 0 || Object.keys(filters).length === 0) {
    return userIds;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const filter = filters as AudienceFilter;

  let query = supabase.from('user_profiles').select('user_id').in('user_id', userIds);

  // Apply plan filter
  if (filter.plan_codes && filter.plan_codes.length > 0) {
    query = query.in('plan', filter.plan_codes);
  }

  // Apply extension filter
  if (filter.has_extension !== undefined) {
    query = query.eq('has_extension', filter.has_extension);
  }

  // Apply extension boost filter
  if (filter.extension_boost_active !== undefined) {
    query = query.eq('extension_boost_active', filter.extension_boost_active);
  }

  // Apply subscription filter
  if (filter.has_active_subscription !== undefined) {
    // This would require a join with billing_subscriptions
    // For now, we'll check if the plan is not 'free'
    if (filter.has_active_subscription) {
      query = query.neq('plan', 'free');
    } else {
      query = query.eq('plan', 'free');
    }
  }

  // Execute the query
  const { data, error } = await query;

  if (error) {
    log.error({ error, filters }, 'Failed to apply filters');
    throw new Error(`Failed to apply filters: ${error.message}`);
  }

  let filteredIds = (data || []).map((u) => u.user_id);

  // Apply watched markets filter (requires checking watchlists)
  if (filter.watched_markets && filter.watched_markets.length > 0) {
    filteredIds = await filterByWatchedMarkets(filteredIds, filter.watched_markets);
  }

  // Apply quota usage filter
  if (filter.min_quota_usage_pct !== undefined || filter.max_quota_usage_pct !== undefined) {
    filteredIds = await filterByQuotaUsage(filteredIds, filter.min_quota_usage_pct, filter.max_quota_usage_pct);
  }

  // Apply activity filters
  if (filter.active_since_days !== undefined) {
    filteredIds = await filterByActivity(filteredIds, filter.active_since_days, true);
  }
  if (filter.inactive_since_days !== undefined) {
    filteredIds = await filterByActivity(filteredIds, filter.inactive_since_days, false);
  }

  log.info(
    {
      original_count: userIds.length,
      filtered_count: filteredIds.length,
      filters: Object.keys(filter),
    },
    'Applied audience filters'
  );

  return filteredIds;
}

/**
 * Filter users by watched markets
 */
async function filterByWatchedMarkets(userIds: string[], markets: string[]): Promise<string[]> {
  if (userIds.length === 0 || markets.length === 0) {
    return userIds;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase
    .from('watchlists')
    .select('user_id')
    .in('user_id', userIds)
    .in('provider', markets);

  if (error) {
    log.error({ error, markets }, 'Failed to filter by watched markets');
    return userIds; // Return original list on error
  }

  // Return unique user IDs
  return [...new Set((data || []).map((w) => w.user_id))];
}

/**
 * Filter users by quota usage percentage
 */
async function filterByQuotaUsage(
  userIds: string[],
  minPct?: number,
  maxPct?: number
): Promise<string[]> {
  if (userIds.length === 0 || (minPct === undefined && maxPct === undefined)) {
    return userIds;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Get user profiles with quota info
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, plan, daily_query_usage')
    .in('user_id', userIds);

  if (error) {
    log.error({ error }, 'Failed to fetch quota usage');
    return userIds;
  }

  // Calculate quota usage percentage for each user
  const quotaLimits: Record<string, number> = {
    free: 10,
    growth: 100,
    scale: 1000,
    admin: 999999,
  };

  const filtered = (data || []).filter((user) => {
    const limit = quotaLimits[user.plan as string] || 10;
    const usage = user.daily_query_usage || 0;
    const usagePct = (usage / limit) * 100;

    if (minPct !== undefined && usagePct < minPct) {
      return false;
    }
    if (maxPct !== undefined && usagePct > maxPct) {
      return false;
    }

    return true;
  });

  return filtered.map((u) => u.user_id);
}

/**
 * Filter users by activity recency
 */
async function filterByActivity(
  userIds: string[],
  days: number,
  isActive: boolean
): Promise<string[]> {
  if (userIds.length === 0) {
    return userIds;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Check for recent keyword searches as a proxy for activity
  const { data, error } = await supabase
    .from('keyword_search_requests')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', cutoffDate.toISOString());

  if (error) {
    log.error({ error, days, is_active: isActive }, 'Failed to filter by activity');
    return userIds;
  }

  const activeUserIds = new Set((data || []).map((r) => r.user_id));

  if (isActive) {
    // Return users who have been active
    return userIds.filter((id) => activeUserIds.has(id));
  } else {
    // Return users who have NOT been active
    return userIds.filter((id) => !activeUserIds.has(id));
  }
}

/**
 * Check if a user is eligible for a notification
 */
export async function isUserEligible(userId: string, notification: Notification): Promise<boolean> {
  const eligibleUsers = await getEligibleUsers(notification);
  return eligibleUsers.includes(userId);
}

/**
 * Get count of eligible users without fetching all IDs
 */
export async function getEligibleUserCount(notification: Notification): Promise<number> {
  const userIds = await getEligibleUsers(notification);
  return userIds.length;
}
