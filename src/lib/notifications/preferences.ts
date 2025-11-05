/**
 * Notification preferences service - Manages user notification preferences
 */

import { createServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type {
  UserNotificationPrefs,
  NotificationCategory,
  EmailFrequency,
  UpdatePreferencesRequest,
} from './types';

const log = logger.child({ module: 'notifications/preferences' });

/**
 * Get all notification preferences for a user
 */
export async function getUserPreferences(userId: string): Promise<UserNotificationPrefs[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .order('category', { ascending: true });

  if (error) {
    log.error({ error, user_id: userId }, 'Failed to fetch user preferences');
    throw new Error(`Failed to fetch preferences: ${error.message}`);
  }

  // If no preferences exist, create defaults
  if (!data || data.length === 0) {
    return await initializeDefaultPreferences(userId);
  }

  return data;
}

/**
 * Get preferences for a specific category
 */
export async function getCategoryPreference(
  userId: string,
  category: NotificationCategory
): Promise<UserNotificationPrefs | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();

  if (error) {
    log.error({ error, user_id: userId, category }, 'Failed to fetch category preference');
    throw new Error(`Failed to fetch preference: ${error.message}`);
  }

  // If preference doesn't exist, create it with defaults
  if (!data) {
    return await createDefaultPreference(userId, category);
  }

  return data;
}

/**
 * Update notification preferences for a category
 */
export async function updatePreferences(
  userId: string,
  request: UpdatePreferencesRequest
): Promise<UserNotificationPrefs> {
  const supabase = createServerClient();
  const { category, inapp_enabled, email_enabled, email_frequency } = request;

  // Check if preference exists
  const existing = await getCategoryPreference(userId, category);

  if (!existing) {
    // Create new preference with defaults
    const newPref = await createDefaultPreference(userId, category);

    // Now update it with the requested values
    return await updatePreferences(userId, request);
  }

  // Build update object
  const updates: Partial<UserNotificationPrefs> = {};

  if (inapp_enabled !== undefined) {
    updates.inapp_enabled = inapp_enabled;
  }
  if (email_enabled !== undefined) {
    // Account and billing emails cannot be disabled
    if (category === 'account' || category === 'system') {
      log.warn({ user_id: userId, category }, 'Cannot disable critical category emails');
    } else {
      updates.email_enabled = email_enabled;
    }
  }
  if (email_frequency !== undefined) {
    // Validate frequency for category
    if (category === 'account' && email_frequency !== 'instant') {
      log.warn({ user_id: userId, category }, 'Account emails must be instant');
      updates.email_frequency = 'instant';
    } else {
      updates.email_frequency = email_frequency;
    }
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .update(updates)
    .eq('user_id', userId)
    .eq('category', category)
    .select()
    .single();

  if (error) {
    log.error({ error, user_id: userId, category }, 'Failed to update preferences');
    throw new Error(`Failed to update preferences: ${error.message}`);
  }

  log.info({ user_id: userId, category, updates: Object.keys(updates) }, 'Updated notification preferences');
  return data;
}

/**
 * Initialize default preferences for all categories
 */
export async function initializeDefaultPreferences(userId: string): Promise<UserNotificationPrefs[]> {
  const categories: NotificationCategory[] = ['keyword', 'watchlist', 'ai', 'account', 'system', 'collab'];

  const preferences = await Promise.all(
    categories.map((category) => createDefaultPreference(userId, category))
  );

  log.info({ user_id: userId, count: preferences.length }, 'Initialized default preferences');
  return preferences;
}

/**
 * Create a default preference for a category
 */
async function createDefaultPreference(
  userId: string,
  category: NotificationCategory
): Promise<UserNotificationPrefs> {
  const supabase = createServerClient();

  // Default settings per category
  const defaults: Record<NotificationCategory, { email_enabled: boolean; email_frequency: EmailFrequency }> = {
    keyword: { email_enabled: true, email_frequency: 'daily' },
    watchlist: { email_enabled: true, email_frequency: 'weekly' },
    ai: { email_enabled: true, email_frequency: 'instant' },
    account: { email_enabled: true, email_frequency: 'instant' },
    system: { email_enabled: true, email_frequency: 'instant' },
    collab: { email_enabled: true, email_frequency: 'instant' },
  };

  const categoryDefaults = defaults[category];

  const preference: Partial<UserNotificationPrefs> = {
    user_id: userId,
    category,
    inapp_enabled: true,
    email_enabled: categoryDefaults.email_enabled,
    email_frequency: categoryDefaults.email_frequency,
    meta: {},
  };

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .insert(preference)
    .select()
    .single();

  if (error) {
    // If conflict, fetch existing
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .single();

      if (existing) {
        return existing;
      }
    }

    log.error({ error, user_id: userId, category }, 'Failed to create default preference');
    throw new Error(`Failed to create default preference: ${error.message}`);
  }

  return data;
}

/**
 * Check if a user has enabled a specific channel for a category
 */
export async function isChannelEnabled(
  userId: string,
  category: NotificationCategory,
  channel: 'inapp' | 'email'
): Promise<boolean> {
  const prefs = await getCategoryPreference(userId, category);

  if (!prefs) {
    // Return defaults if no preference exists
    if (channel === 'inapp') return true;
    if (channel === 'email') {
      return category === 'account' || category === 'system';
    }
    return false;
  }

  if (channel === 'inapp') {
    return prefs.inapp_enabled;
  }
  if (channel === 'email') {
    return prefs.email_enabled && prefs.email_frequency !== 'disabled';
  }

  return false;
}

/**
 * Get email frequency for a category
 */
export async function getEmailFrequency(
  userId: string,
  category: NotificationCategory
): Promise<EmailFrequency> {
  const prefs = await getCategoryPreference(userId, category);

  if (!prefs) {
    // Return defaults
    if (category === 'account' || category === 'system') return 'instant';
    if (category === 'keyword') return 'daily';
    if (category === 'watchlist') return 'weekly';
    return 'instant';
  }

  return prefs.email_frequency;
}

/**
 * Reset preferences to defaults for a user
 */
export async function resetToDefaults(userId: string): Promise<UserNotificationPrefs[]> {
  const supabase = createServerClient();

  // Delete existing preferences
  const { error: deleteError } = await supabase
    .from('user_notification_prefs')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    log.error({ error: deleteError, user_id: userId }, 'Failed to delete existing preferences');
    throw new Error(`Failed to reset preferences: ${deleteError.message}`);
  }

  // Reinitialize with defaults
  const prefs = await initializeDefaultPreferences(userId);

  log.info({ user_id: userId }, 'Reset preferences to defaults');
  return prefs;
}

/**
 * Bulk update preferences for multiple categories
 */
export async function bulkUpdatePreferences(
  userId: string,
  updates: UpdatePreferencesRequest[]
): Promise<UserNotificationPrefs[]> {
  const results = await Promise.all(
    updates.map((update) => updatePreferences(userId, update))
  );

  log.info({ user_id: userId, count: updates.length }, 'Bulk updated preferences');
  return results;
}

/**
 * Get users who have a specific email frequency for a category
 * Useful for digest aggregation
 */
export async function getUsersForDigest(
  category: NotificationCategory,
  frequency: EmailFrequency
): Promise<string[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('user_id')
    .eq('category', category)
    .eq('email_frequency', frequency)
    .eq('email_enabled', true);

  if (error) {
    log.error({ error, category, frequency }, 'Failed to fetch users for digest');
    throw new Error(`Failed to fetch users for digest: ${error.message}`);
  }

  return (data || []).map((p) => p.user_id);
}

/**
 * Export preferences for data portability
 */
export async function exportPreferences(userId: string): Promise<Record<string, any>> {
  const prefs = await getUserPreferences(userId);

  const exported = prefs.reduce((acc, pref) => {
    acc[pref.category] = {
      inapp_enabled: pref.inapp_enabled,
      email_enabled: pref.email_enabled,
      email_frequency: pref.email_frequency,
    };
    return acc;
  }, {} as Record<string, any>);

  return exported;
}

/**
 * Delete all preferences for a user (GDPR compliance)
 */
export async function deleteUserPreferences(userId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('user_notification_prefs')
    .delete()
    .eq('user_id', userId);

  if (error) {
    log.error({ error, user_id: userId }, 'Failed to delete user preferences');
    throw new Error(`Failed to delete preferences: ${error.message}`);
  }

  log.info({ user_id: userId }, 'Deleted user notification preferences');
}
