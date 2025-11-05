/**
 * Type definitions for the Lexyhub notification system
 */

// ===========================
// ENUMS
// ===========================

export type NotificationKind = 'banner' | 'inapp' | 'email' | 'mixed';
export type NotificationSource = 'system' | 'admin';
export type NotificationCategory = 'keyword' | 'watchlist' | 'ai' | 'account' | 'system' | 'collab';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';
export type NotificationStatus = 'draft' | 'scheduled' | 'live' | 'paused' | 'ended';
export type NotificationRecurrence = 'none' | 'daily' | 'weekly';
export type AudienceScope = 'all' | 'plan' | 'user_ids' | 'segment' | 'workspace';
export type DeliveryState = 'pending' | 'shown' | 'clicked' | 'dismissed' | 'emailed' | 'failed';
export type EmailFrequency = 'instant' | 'daily' | 'weekly' | 'disabled';
export type EmailTemplateKey = 'brief_ready' | 'keyword_highlights' | 'watchlist_digest' | 'billing_event' | 'system_announcement';

// ===========================
// DATABASE MODELS
// ===========================

export interface NotificationSegment {
  id: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;

  // Classification
  kind: NotificationKind;
  source: NotificationSource;
  category: NotificationCategory;

  // Content
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;

  // Presentation
  severity: NotificationSeverity;
  priority: number;
  icon?: string;

  // Audience targeting
  audience_scope: AudienceScope;
  audience_filter: Record<string, any>;
  segment_id?: string;

  // Schedule
  schedule_start_at?: string;
  schedule_end_at?: string;
  recurrence: NotificationRecurrence;
  timezone: string;

  // Delivery controls
  show_once_per_user: boolean;
  max_impressions_per_user?: number;

  // Channel flags
  show_banner: boolean;
  create_inapp: boolean;
  send_email: boolean;

  // Email specific
  email_template_key?: EmailTemplateKey;

  // Status
  status: NotificationStatus;

  // Audit
  created_by?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  paused_at?: string;
  ended_at?: string;

  // Metadata
  meta: Record<string, any>;
  audit: Array<AuditEntry>;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  user_id: string;

  // Delivery channels
  channels: string[];

  // State
  state: DeliveryState;

  // Timestamps
  first_seen_at?: string;
  last_seen_at?: string;
  clicked_at?: string;
  dismissed_at?: string;
  emailed_at?: string;

  // Error tracking
  attempts: number;
  error?: string;

  // Email specific
  email_message_id?: string;
  email_opened_at?: string;
  email_clicked_at?: string;

  // Metadata
  meta: Record<string, any>;

  created_at: string;
  updated_at: string;
}

export interface UserNotificationPrefs {
  user_id: string;
  category: NotificationCategory;

  // Channel toggles
  inapp_enabled: boolean;
  email_enabled: boolean;

  // Email frequency
  email_frequency: EmailFrequency;

  // Metadata
  meta: Record<string, any>;

  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  timestamp: string;
  user_id?: string;
  action: string;
  details?: Record<string, any>;
}

// ===========================
// API REQUEST/RESPONSE TYPES
// ===========================

export interface CreateNotificationRequest {
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  severity?: NotificationSeverity;
  priority?: number;
  icon?: string;
  audience_scope?: AudienceScope;
  audience_filter?: Record<string, any>;
  segment_id?: string;
  schedule_start_at?: string;
  schedule_end_at?: string;
  recurrence?: NotificationRecurrence;
  timezone?: string;
  show_once_per_user?: boolean;
  max_impressions_per_user?: number;
  show_banner?: boolean;
  create_inapp?: boolean;
  send_email?: boolean;
  email_template_key?: EmailTemplateKey;
  meta?: Record<string, any>;
}

export interface UpdateNotificationRequest extends Partial<CreateNotificationRequest> {
  id: string;
}

export interface GetNotificationsRequest {
  status?: NotificationStatus;
  kind?: NotificationKind;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  source?: NotificationSource;
  q?: string;
  page?: number;
  limit?: number;
}

export interface GetNotificationFeedRequest {
  page?: number;
  limit?: number;
  unread?: boolean;
}

export interface TrackDeliveryRequest {
  notification_id: string;
  action: 'view' | 'click' | 'dismiss';
}

export interface UpdatePreferencesRequest {
  category: NotificationCategory;
  inapp_enabled?: boolean;
  email_enabled?: boolean;
  email_frequency?: EmailFrequency;
}

export interface NotificationMetrics {
  notification_id: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  ctr: number; // Click-through rate
  dismiss_rate: number;
  open_rate: number; // Email open rate
}

// ===========================
// TARGETING FILTERS
// ===========================

export interface AudienceFilter {
  plan_codes?: string[];
  has_extension?: boolean;
  watched_markets?: string[];
  min_quota_usage_pct?: number;
  max_quota_usage_pct?: number;
  active_since_days?: number;
  inactive_since_days?: number;
  has_active_subscription?: boolean;
  extension_boost_active?: boolean;
  user_ids?: string[];
}

// ===========================
// EMAIL TEMPLATES
// ===========================

export interface EmailContext {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  notification: Notification;
  preferences_url: string;
  unsubscribe_url?: string;
  [key: string]: any; // Additional context per template
}

export interface EmailTemplate {
  key: EmailTemplateKey;
  subject: string;
  from_name: string;
  from_email: string;
  render: (context: EmailContext) => string;
}

// ===========================
// BANNER RESOLUTION
// ===========================

export interface BannerResolutionResult {
  notification: Notification | null;
  reason?: string;
}

// ===========================
// VALIDATION SCHEMAS
// ===========================

export const VALID_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  critical: 'red',
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  keyword: 'Keywords & Trends',
  watchlist: 'Watchlists',
  ai: 'AI Insights',
  account: 'Account & Billing',
  system: 'System Updates',
  collab: 'Collaboration',
};

// ===========================
// UTILITY TYPES
// ===========================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
