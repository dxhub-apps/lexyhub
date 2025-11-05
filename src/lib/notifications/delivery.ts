/**
 * Notification delivery service - Handles delivery tracking and feed retrieval
 */

import { getSupabaseServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type {
  Notification,
  NotificationDelivery,
  DeliveryState,
  GetNotificationFeedRequest,
  PaginatedResponse,
  TrackDeliveryRequest,
} from './types';

const log = logger.child({ module: 'notifications/delivery' });

/**
 * Get active banner for a user
 * Uses the database function for priority resolution
 */
export async function getActiveBanner(userId: string): Promise<Notification | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.rpc('get_active_banner_for_user', {
    p_user_id: userId,
  });

  if (error) {
    log.error({ error, user_id: userId }, 'Failed to fetch active banner');
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * Get notification feed for a user with pagination
 */
export async function getNotificationFeed(
  userId: string,
  params: GetNotificationFeedRequest
): Promise<PaginatedResponse<Notification & { delivery?: NotificationDelivery }>> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  // Build query to get notifications with delivery state
  let query = supabase
    .from('notifications')
    .select(
      `
      *,
      notification_delivery!left (*)
    `,
      { count: 'exact' }
    )
    .eq('status', 'live')
    .eq('create_inapp', true);

  // Filter by unread if requested
  if (params.unread) {
    query = query.or('notification_delivery.state.is.null,notification_delivery.state.eq.pending');
  }

  // Check schedule
  const now = new Date().toISOString();
  query = query.or(`schedule_start_at.is.null,schedule_start_at.lte.${now}`);
  query = query.or(`schedule_end_at.is.null,schedule_end_at.gt.${now}`);

  // Sort by created_at desc
  query = query.order('created_at', { ascending: false });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    log.error({ error, user_id: userId, params }, 'Failed to fetch notification feed');
    throw new Error(`Failed to fetch notification feed: ${error.message}`);
  }

  // Transform data to include delivery as a property
  const notifications = (data || []).map((item: any) => {
    const { notification_delivery, ...notification } = item;
    return {
      ...notification,
      delivery: notification_delivery && notification_delivery.length > 0 ? notification_delivery[0] : undefined,
    };
  });

  return {
    data: notifications,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { data, error } = await supabase.rpc('get_unread_notification_count', {
    p_user_id: userId,
  });

  if (error) {
    log.error({ error, user_id: userId }, 'Failed to fetch unread count');
    return 0;
  }

  return data || 0;
}

/**
 * Track delivery action (view, click, dismiss)
 */
export async function trackDelivery(userId: string, request: TrackDeliveryRequest): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const { notification_id, action } = request;

  // Map action to delivery state
  const stateMap: Record<string, DeliveryState> = {
    view: 'shown',
    click: 'clicked',
    dismiss: 'dismissed',
  };

  const state = stateMap[action];
  if (!state) {
    throw new Error(`Invalid action: ${action}`);
  }

  // Check if delivery record exists
  const { data: existing, error: fetchError } = await supabase
    .from('notification_delivery')
    .select('*')
    .eq('notification_id', notification_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    log.error({ error: fetchError, notification_id, user_id: userId }, 'Failed to fetch delivery record');
    throw new Error(`Failed to track delivery: ${fetchError.message}`);
  }

  const now = new Date().toISOString();

  if (existing) {
    // Update existing record
    const updates: Partial<NotificationDelivery> = {
      state,
      last_seen_at: now,
      attempts: existing.attempts + 1,
    };

    if (action === 'view' && !existing.first_seen_at) {
      updates.first_seen_at = now;
    }
    if (action === 'click') {
      updates.clicked_at = now;
    }
    if (action === 'dismiss') {
      updates.dismissed_at = now;
    }

    const { error: updateError } = await supabase
      .from('notification_delivery')
      .update(updates)
      .eq('id', existing.id);

    if (updateError) {
      log.error({ error: updateError, delivery_id: existing.id }, 'Failed to update delivery');
      throw new Error(`Failed to track delivery: ${updateError.message}`);
    }
  } else {
    // Create new record
    const delivery: Partial<NotificationDelivery> = {
      notification_id,
      user_id: userId,
      channels: ['inapp'],
      state,
      attempts: 1,
      first_seen_at: action === 'view' ? now : undefined,
      last_seen_at: now,
      clicked_at: action === 'click' ? now : undefined,
      dismissed_at: action === 'dismiss' ? now : undefined,
      meta: {},
    };

    const { error: insertError } = await supabase.from('notification_delivery').insert(delivery);

    if (insertError) {
      log.error({ error: insertError, notification_id, user_id: userId }, 'Failed to create delivery record');
      throw new Error(`Failed to track delivery: ${insertError.message}`);
    }
  }

  log.info({ notification_id, user_id: userId, action, state }, 'Tracked delivery action');
}

/**
 * Mark notification as read/shown
 */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
    p_user_id: userId,
  });

  if (error) {
    log.error({ error, notification_id: notificationId, user_id: userId }, 'Failed to mark as read');
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  log.info({ notification_id: notificationId, user_id: userId }, 'Marked notification as read');
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Get all pending notifications
  const { data: pending, error: fetchError } = await supabase
    .from('notification_delivery')
    .select('notification_id')
    .eq('user_id', userId)
    .eq('state', 'pending');

  if (fetchError) {
    log.error({ error: fetchError, user_id: userId }, 'Failed to fetch pending notifications');
    throw new Error(`Failed to mark all as read: ${fetchError.message}`);
  }

  if (!pending || pending.length === 0) {
    return;
  }

  // Update all to shown
  const { error: updateError } = await supabase
    .from('notification_delivery')
    .update({
      state: 'shown',
      last_seen_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('state', 'pending');

  if (updateError) {
    log.error({ error: updateError, user_id: userId }, 'Failed to update notifications');
    throw new Error(`Failed to mark all as read: ${updateError.message}`);
  }

  log.info({ user_id: userId, count: pending.length }, 'Marked all notifications as read');
}

/**
 * Create delivery records for a notification to eligible users
 * This is typically called when a notification is published or scheduled
 */
export async function createDeliveryRecords(
  notificationId: string,
  userIds: string[],
  channels: string[]
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  if (userIds.length === 0) {
    log.warn({ notification_id: notificationId }, 'No users to deliver notification to');
    return;
  }

  const deliveries: Partial<NotificationDelivery>[] = userIds.map((userId) => ({
    notification_id: notificationId,
    user_id: userId,
    channels,
    state: 'pending',
    attempts: 0,
    meta: {},
  }));

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < deliveries.length; i += batchSize) {
    const batch = deliveries.slice(i, i + batchSize);
    const { error } = await supabase.from('notification_delivery').insert(batch);

    if (error) {
      log.error({ error, notification_id: notificationId, batch_start: i }, 'Failed to create delivery records');
      throw new Error(`Failed to create delivery records: ${error.message}`);
    }
  }

  log.info(
    { notification_id: notificationId, user_count: userIds.length, channels },
    'Created delivery records'
  );
}

/**
 * Get delivery records for a notification (for analytics)
 */
export async function getDeliveryRecords(
  notificationId: string,
  page = 1,
  limit = 100
): Promise<PaginatedResponse<NotificationDelivery>> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('notification_delivery')
    .select('*', { count: 'exact' })
    .eq('notification_id', notificationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    log.error({ error, notification_id: notificationId }, 'Failed to fetch delivery records');
    throw new Error(`Failed to fetch delivery records: ${error.message}`);
  }

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * Update email delivery status (for webhook callbacks from Resend)
 */
export async function updateEmailDeliveryStatus(
  notificationId: string,
  userId: string,
  status: {
    message_id?: string;
    sent?: boolean;
    opened?: boolean;
    clicked?: boolean;
    error?: string;
  }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const updates: Partial<NotificationDelivery> = {};

  if (status.message_id) {
    updates.email_message_id = status.message_id;
  }
  if (status.sent) {
    updates.state = 'emailed';
    updates.emailed_at = new Date().toISOString();
  }
  if (status.opened) {
    updates.email_opened_at = new Date().toISOString();
  }
  if (status.clicked) {
    updates.email_clicked_at = new Date().toISOString();
  }
  if (status.error) {
    updates.state = 'failed';
    updates.error = status.error;
  }

  const { error } = await supabase
    .from('notification_delivery')
    .update(updates)
    .eq('notification_id', notificationId)
    .eq('user_id', userId);

  if (error) {
    log.error({ error, notification_id: notificationId, user_id: userId }, 'Failed to update email status');
    throw new Error(`Failed to update email delivery status: ${error.message}`);
  }

  log.info({ notification_id: notificationId, user_id: userId, status }, 'Updated email delivery status');
}
