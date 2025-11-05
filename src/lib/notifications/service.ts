/**
 * Notification service - Core CRUD operations for notifications
 */

import { createServerClient } from '@/lib/supabase-server';
import { logger } from '@/lib/logger';
import type {
  Notification,
  NotificationSegment,
  CreateNotificationRequest,
  UpdateNotificationRequest,
  GetNotificationsRequest,
  NotificationMetrics,
  PaginatedResponse,
  AuditEntry,
} from './types';

const log = logger.child({ module: 'notifications/service' });

/**
 * Create a new notification
 */
export async function createNotification(
  data: CreateNotificationRequest,
  userId: string
): Promise<Notification> {
  const supabase = createServerClient();

  const notification: Partial<Notification> = {
    kind: data.kind,
    source: 'admin',
    category: data.category,
    title: data.title,
    body: data.body,
    cta_text: data.cta_text,
    cta_url: data.cta_url,
    severity: data.severity || 'info',
    priority: data.priority !== undefined ? data.priority : 50,
    icon: data.icon,
    audience_scope: data.audience_scope || 'all',
    audience_filter: data.audience_filter || {},
    segment_id: data.segment_id,
    schedule_start_at: data.schedule_start_at,
    schedule_end_at: data.schedule_end_at,
    recurrence: data.recurrence || 'none',
    timezone: data.timezone || 'UTC',
    show_once_per_user: data.show_once_per_user !== undefined ? data.show_once_per_user : false,
    max_impressions_per_user: data.max_impressions_per_user,
    show_banner: data.show_banner !== undefined ? data.show_banner : false,
    create_inapp: data.create_inapp !== undefined ? data.create_inapp : true,
    send_email: data.send_email !== undefined ? data.send_email : false,
    email_template_key: data.email_template_key,
    status: 'draft',
    created_by: userId,
    meta: data.meta || {},
    audit: [
      {
        timestamp: new Date().toISOString(),
        user_id: userId,
        action: 'created',
        details: { initial_data: data },
      },
    ],
  };

  const { data: result, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();

  if (error) {
    log.error({ error }, 'Failed to create notification');
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  log.info({ notification_id: result.id }, 'Created notification');
  return result;
}

/**
 * Update an existing notification
 */
export async function updateNotification(
  data: UpdateNotificationRequest,
  userId: string
): Promise<Notification> {
  const supabase = createServerClient();

  // Get existing notification to append to audit log
  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', data.id)
    .single();

  if (fetchError || !existing) {
    log.error({ error: fetchError, id: data.id }, 'Notification not found');
    throw new Error('Notification not found');
  }

  // Build update object
  const updates: Partial<Notification> = {};
  const changedFields: Record<string, any> = {};

  // Track changed fields
  const fields = [
    'kind',
    'category',
    'title',
    'body',
    'cta_text',
    'cta_url',
    'severity',
    'priority',
    'icon',
    'audience_scope',
    'audience_filter',
    'segment_id',
    'schedule_start_at',
    'schedule_end_at',
    'recurrence',
    'timezone',
    'show_once_per_user',
    'max_impressions_per_user',
    'show_banner',
    'create_inapp',
    'send_email',
    'email_template_key',
    'meta',
  ] as const;

  fields.forEach((field) => {
    if (data[field] !== undefined && data[field] !== existing[field]) {
      updates[field] = data[field] as any;
      changedFields[field] = { from: existing[field], to: data[field] };
    }
  });

  if (Object.keys(updates).length === 0) {
    log.info({ notification_id: data.id }, 'No changes to update');
    return existing;
  }

  // Append to audit log
  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    action: 'updated',
    details: { changed_fields: changedFields },
  };

  updates.audit = [...(existing.audit || []), auditEntry];

  const { data: result, error } = await supabase
    .from('notifications')
    .update(updates)
    .eq('id', data.id)
    .select()
    .single();

  if (error) {
    log.error({ error, id: data.id }, 'Failed to update notification');
    throw new Error(`Failed to update notification: ${error.message}`);
  }

  log.info({ notification_id: result.id, changes: Object.keys(changedFields) }, 'Updated notification');
  return result;
}

/**
 * Publish a notification (change status from draft/scheduled to live)
 */
export async function publishNotification(notificationId: string, userId: string): Promise<Notification> {
  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Notification not found');
  }

  if (existing.status === 'live') {
    log.info({ notification_id: notificationId }, 'Notification already live');
    return existing;
  }

  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    action: 'published',
  };

  const { data: result, error } = await supabase
    .from('notifications')
    .update({
      status: 'live',
      published_at: new Date().toISOString(),
      audit: [...(existing.audit || []), auditEntry],
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    log.error({ error, id: notificationId }, 'Failed to publish notification');
    throw new Error(`Failed to publish notification: ${error.message}`);
  }

  log.info({ notification_id: notificationId }, 'Published notification');
  return result;
}

/**
 * Pause a live notification
 */
export async function pauseNotification(notificationId: string, userId: string): Promise<Notification> {
  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Notification not found');
  }

  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    action: 'paused',
  };

  const { data: result, error } = await supabase
    .from('notifications')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      audit: [...(existing.audit || []), auditEntry],
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    log.error({ error, id: notificationId }, 'Failed to pause notification');
    throw new Error(`Failed to pause notification: ${error.message}`);
  }

  log.info({ notification_id: notificationId }, 'Paused notification');
  return result;
}

/**
 * End a notification (terminal state)
 */
export async function endNotification(notificationId: string, userId: string): Promise<Notification> {
  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Notification not found');
  }

  const auditEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    action: 'ended',
  };

  const { data: result, error } = await supabase
    .from('notifications')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      audit: [...(existing.audit || []), auditEntry],
    })
    .eq('id', notificationId)
    .select()
    .single();

  if (error) {
    log.error({ error, id: notificationId }, 'Failed to end notification');
    throw new Error(`Failed to end notification: ${error.message}`);
  }

  log.info({ notification_id: notificationId }, 'Ended notification');
  return result;
}

/**
 * Get a notification by ID
 */
export async function getNotification(notificationId: string): Promise<Notification | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    log.error({ error, id: notificationId }, 'Failed to fetch notification');
    throw new Error(`Failed to fetch notification: ${error.message}`);
  }

  return data;
}

/**
 * List notifications with filters and pagination
 */
export async function listNotifications(
  params: GetNotificationsRequest
): Promise<PaginatedResponse<Notification>> {
  const supabase = createServerClient();
  const page = params.page || 1;
  const limit = params.limit || 25;
  const offset = (page - 1) * limit;

  let query = supabase.from('notifications').select('*', { count: 'exact' });

  // Apply filters
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.kind) {
    query = query.eq('kind', params.kind);
  }
  if (params.severity) {
    query = query.eq('severity', params.severity);
  }
  if (params.category) {
    query = query.eq('category', params.category);
  }
  if (params.source) {
    query = query.eq('source', params.source);
  }
  if (params.q) {
    query = query.or(`title.ilike.%${params.q}%,body.ilike.%${params.q}%`);
  }

  // Sort by created_at desc
  query = query.order('created_at', { ascending: false });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    log.error({ error, params }, 'Failed to list notifications');
    throw new Error(`Failed to list notifications: ${error.message}`);
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
 * Delete a notification (soft delete by setting status to ended)
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  await endNotification(notificationId, userId);
}

/**
 * Get metrics for a notification
 */
export async function getNotificationMetrics(notificationId: string): Promise<NotificationMetrics> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notification_delivery')
    .select('state, email_opened_at, email_clicked_at')
    .eq('notification_id', notificationId);

  if (error) {
    log.error({ error, id: notificationId }, 'Failed to fetch metrics');
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }

  const deliveries = data || [];
  const impressions = deliveries.filter((d) => ['shown', 'clicked', 'dismissed', 'emailed'].includes(d.state)).length;
  const clicks = deliveries.filter((d) => d.state === 'clicked').length;
  const dismissals = deliveries.filter((d) => d.state === 'dismissed').length;
  const emails_sent = deliveries.filter((d) => d.state === 'emailed' || d.email_opened_at || d.email_clicked_at).length;
  const emails_opened = deliveries.filter((d) => d.email_opened_at).length;
  const emails_clicked = deliveries.filter((d) => d.email_clicked_at).length;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const dismiss_rate = impressions > 0 ? (dismissals / impressions) * 100 : 0;
  const open_rate = emails_sent > 0 ? (emails_opened / emails_sent) * 100 : 0;

  return {
    notification_id: notificationId,
    impressions,
    clicks,
    dismissals,
    emails_sent,
    emails_opened,
    emails_clicked,
    ctr: Math.round(ctr * 100) / 100,
    dismiss_rate: Math.round(dismiss_rate * 100) / 100,
    open_rate: Math.round(open_rate * 100) / 100,
  };
}

/**
 * Create a notification segment
 */
export async function createSegment(
  name: string,
  description: string,
  filters: Record<string, any>,
  userId: string
): Promise<NotificationSegment> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notification_segments')
    .insert({
      name,
      description,
      filters,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    log.error({ error }, 'Failed to create segment');
    throw new Error(`Failed to create segment: ${error.message}`);
  }

  log.info({ segment_id: data.id, name }, 'Created notification segment');
  return data;
}

/**
 * List notification segments
 */
export async function listSegments(): Promise<NotificationSegment[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notification_segments')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    log.error({ error }, 'Failed to list segments');
    throw new Error(`Failed to list segments: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a segment by ID
 */
export async function getSegment(segmentId: string): Promise<NotificationSegment | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notification_segments')
    .select('*')
    .eq('id', segmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    log.error({ error, id: segmentId }, 'Failed to fetch segment');
    throw new Error(`Failed to fetch segment: ${error.message}`);
  }

  return data;
}

/**
 * Update a segment
 */
export async function updateSegment(
  segmentId: string,
  updates: Partial<Pick<NotificationSegment, 'name' | 'description' | 'filters'>>
): Promise<NotificationSegment> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notification_segments')
    .update(updates)
    .eq('id', segmentId)
    .select()
    .single();

  if (error) {
    log.error({ error, id: segmentId }, 'Failed to update segment');
    throw new Error(`Failed to update segment: ${error.message}`);
  }

  log.info({ segment_id: segmentId }, 'Updated segment');
  return data;
}

/**
 * Delete a segment
 */
export async function deleteSegment(segmentId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.from('notification_segments').delete().eq('id', segmentId);

  if (error) {
    log.error({ error, id: segmentId }, 'Failed to delete segment');
    throw new Error(`Failed to delete segment: ${error.message}`);
  }

  log.info({ segment_id: segmentId }, 'Deleted segment');
}
