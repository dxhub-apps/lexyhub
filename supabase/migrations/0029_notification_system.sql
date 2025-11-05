-- ===========================================
-- 0029_notification_system.sql
-- ===========================================
-- Comprehensive notification system supporting:
-- - Top banner (urgent/critical alerts)
-- - In-app feed and toasts
-- - Email notifications via Resend
-- - Admin console for creation, targeting, and analytics
-- migrate:up

-- ===========================
-- 1. NOTIFICATION SEGMENTS
-- ===========================
-- Reusable audience definitions for targeting
create table if not exists public.notification_segments (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    filters jsonb not null default '{}'::jsonb,
    -- Example filters:
    -- {
    --   "plan_codes": ["growth", "scale"],
    --   "has_extension": true,
    --   "watched_markets": ["etsy"],
    --   "min_quota_usage_pct": 50,
    --   "active_since_days": 30
    -- }
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists notification_segments_name_idx
    on public.notification_segments(lower(name));

comment on table public.notification_segments is 'Reusable audience segments for notification targeting.';

-- ===========================
-- 2. NOTIFICATIONS
-- ===========================
-- Central notification definition table
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),

    -- Classification
    kind text not null check (kind in ('banner', 'inapp', 'email', 'mixed')),
    source text not null default 'system' check (source in ('system', 'admin')),
    category text not null check (category in ('keyword', 'watchlist', 'ai', 'account', 'system', 'collab')),

    -- Content
    title text not null,
    body text,
    cta_text text,
    cta_url text,

    -- Presentation
    severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
    priority integer not null default 50 check (priority >= 0 and priority <= 100),
    icon text, -- icon name or emoji

    -- Audience targeting
    audience_scope text not null default 'all' check (audience_scope in ('all', 'plan', 'user_ids', 'segment', 'workspace')),
    audience_filter jsonb default '{}'::jsonb,
    -- Example for scope=plan: {"plan_codes": ["growth"]}
    -- Example for scope=user_ids: {"user_ids": ["uuid1", "uuid2"]}
    -- Example for scope=segment: {"segment_id": "uuid"}
    segment_id uuid references public.notification_segments(id) on delete set null,

    -- Schedule
    schedule_start_at timestamptz,
    schedule_end_at timestamptz,
    recurrence text default 'none' check (recurrence in ('none', 'daily', 'weekly')),
    timezone text default 'UTC',

    -- Delivery controls
    show_once_per_user boolean default false,
    max_impressions_per_user integer,

    -- Channel flags
    show_banner boolean default false,
    create_inapp boolean default true,
    send_email boolean default false,

    -- Email specific
    email_template_key text,
    -- Templates: 'brief_ready', 'keyword_highlights', 'watchlist_digest', 'billing_event', 'system_announcement'

    -- Status
    status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'paused', 'ended')),

    -- Audit
    created_by uuid references auth.users(id) on delete set null,
    approved_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz,
    paused_at timestamptz,
    ended_at timestamptz,

    -- Metadata and audit trail
    meta jsonb default '{}'::jsonb,
    audit jsonb default '[]'::jsonb
);

create index if not exists notifications_kind_idx on public.notifications(kind);
create index if not exists notifications_source_idx on public.notifications(source);
create index if not exists notifications_category_idx on public.notifications(category);
create index if not exists notifications_status_idx on public.notifications(status);
create index if not exists notifications_severity_idx on public.notifications(severity);
create index if not exists notifications_schedule_idx on public.notifications(schedule_start_at, schedule_end_at);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

comment on table public.notifications is 'Central notification definitions for banner, in-app, and email channels.';

-- ===========================
-- 3. NOTIFICATION DELIVERY
-- ===========================
-- Per-user delivery tracking
create table if not exists public.notification_delivery (
    id uuid primary key default gen_random_uuid(),
    notification_id uuid not null references public.notifications(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,

    -- Delivery channels attempted
    channels text[] not null default '{}'::text[],
    -- ['banner', 'inapp', 'email']

    -- State tracking
    state text not null default 'pending' check (state in ('pending', 'shown', 'clicked', 'dismissed', 'emailed', 'failed')),

    -- Timestamps
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    clicked_at timestamptz,
    dismissed_at timestamptz,
    emailed_at timestamptz,

    -- Error tracking
    attempts integer not null default 0,
    error text,

    -- Email specific
    email_message_id text, -- Resend message ID
    email_opened_at timestamptz,
    email_clicked_at timestamptz,

    -- Metadata
    meta jsonb default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint notification_delivery_user_notification_unique unique (notification_id, user_id)
);

create index if not exists notification_delivery_notification_idx on public.notification_delivery(notification_id);
create index if not exists notification_delivery_user_idx on public.notification_delivery(user_id);
create index if not exists notification_delivery_state_idx on public.notification_delivery(state);
create index if not exists notification_delivery_created_at_idx on public.notification_delivery(created_at desc);
create index if not exists notification_delivery_user_state_idx on public.notification_delivery(user_id, state);

comment on table public.notification_delivery is 'Per-user delivery tracking for all notification channels.';

-- ===========================
-- 4. USER NOTIFICATION PREFERENCES
-- ===========================
-- User-level notification preferences per category
create table if not exists public.user_notification_prefs (
    user_id uuid not null references auth.users(id) on delete cascade,
    category text not null check (category in ('keyword', 'watchlist', 'ai', 'account', 'system', 'collab')),

    -- Channel toggles
    inapp_enabled boolean not null default true,
    email_enabled boolean not null default true,

    -- Email frequency
    email_frequency text not null default 'instant' check (email_frequency in ('instant', 'daily', 'weekly', 'disabled')),

    -- Metadata
    meta jsonb default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_notification_prefs_pk primary key (user_id, category)
);

create index if not exists user_notification_prefs_user_idx on public.user_notification_prefs(user_id);

comment on table public.user_notification_prefs is 'User preferences for notification channels and frequency per category.';

-- ===========================
-- 5. DEFAULT PREFERENCES
-- ===========================
-- Insert default preferences for existing users
insert into public.user_notification_prefs (user_id, category, inapp_enabled, email_enabled, email_frequency)
select
    u.id as user_id,
    cat.category,
    true as inapp_enabled,
    case
        when cat.category in ('account', 'system') then true
        else true
    end as email_enabled,
    case
        when cat.category = 'account' then 'instant'
        when cat.category = 'keyword' then 'daily'
        when cat.category = 'watchlist' then 'weekly'
        when cat.category = 'ai' then 'instant'
        when cat.category = 'system' then 'instant'
        when cat.category = 'collab' then 'instant'
        else 'daily'
    end as email_frequency
from
    auth.users u
    cross join (
        select unnest(array['keyword', 'watchlist', 'ai', 'account', 'system', 'collab']) as category
    ) cat
where not exists (
    select 1 from public.user_notification_prefs existing
    where existing.user_id = u.id and existing.category = cat.category
)
on conflict (user_id, category) do nothing;

-- ===========================
-- 6. HELPER FUNCTIONS
-- ===========================

-- Function to get active banner for a user
create or replace function public.get_active_banner_for_user(p_user_id uuid)
returns table (
    id uuid,
    title text,
    body text,
    cta_text text,
    cta_url text,
    severity text,
    priority integer,
    icon text
)
language plpgsql
security definer
as $$
begin
    return query
    select
        n.id,
        n.title,
        n.body,
        n.cta_text,
        n.cta_url,
        n.severity,
        n.priority,
        n.icon
    from public.notifications n
    left join public.notification_delivery nd on nd.notification_id = n.id and nd.user_id = p_user_id
    where
        n.status = 'live'
        and n.show_banner = true
        and (n.schedule_start_at is null or n.schedule_start_at <= now())
        and (n.schedule_end_at is null or n.schedule_end_at > now())
        and (nd.id is null or (n.show_once_per_user = false and (n.max_impressions_per_user is null or nd.attempts < n.max_impressions_per_user)))
        and (nd.state is null or nd.state != 'dismissed')
    order by
        n.priority desc,
        n.schedule_start_at asc,
        n.created_at desc
    limit 1;
end;
$$;

comment on function public.get_active_banner_for_user is 'Returns the highest priority active banner for a user, respecting dismissal and impression limits.';

-- Function to get unread notification count for a user
create or replace function public.get_unread_notification_count(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
    v_count integer;
begin
    select count(*)
    into v_count
    from public.notification_delivery nd
    join public.notifications n on n.id = nd.notification_id
    where
        nd.user_id = p_user_id
        and nd.state = 'pending'
        and n.create_inapp = true
        and n.status = 'live';

    return v_count;
end;
$$;

comment on function public.get_unread_notification_count is 'Returns count of unread in-app notifications for a user.';

-- Function to mark notification as read
create or replace function public.mark_notification_read(p_notification_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.notification_delivery (notification_id, user_id, channels, state, first_seen_at, last_seen_at)
    values (p_notification_id, p_user_id, array['inapp'], 'shown', now(), now())
    on conflict (notification_id, user_id)
    do update set
        state = case when notification_delivery.state = 'pending' then 'shown' else notification_delivery.state end,
        last_seen_at = now(),
        updated_at = now();
end;
$$;

comment on function public.mark_notification_read is 'Marks a notification as read/shown for a user.';

-- Function to track notification action (click/dismiss)
create or replace function public.track_notification_action(
    p_notification_id uuid,
    p_user_id uuid,
    p_action text
)
returns void
language plpgsql
security definer
as $$
begin
    insert into public.notification_delivery (notification_id, user_id, channels, state)
    values (p_notification_id, p_user_id, array['inapp'], p_action)
    on conflict (notification_id, user_id)
    do update set
        state = p_action,
        clicked_at = case when p_action = 'clicked' then now() else notification_delivery.clicked_at end,
        dismissed_at = case when p_action = 'dismissed' then now() else notification_delivery.dismissed_at end,
        updated_at = now();
end;
$$;

comment on function public.track_notification_action is 'Tracks user actions on notifications (clicked, dismissed).';

-- ===========================
-- 7. ROW LEVEL SECURITY
-- ===========================
-- Enable RLS on all tables
alter table public.notification_segments enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_delivery enable row level security;
alter table public.user_notification_prefs enable row level security;

-- Segments: Admin only
create policy "Admins can view segments"
    on public.notification_segments for select
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can create segments"
    on public.notification_segments for insert
    with check (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can update segments"
    on public.notification_segments for update
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can delete segments"
    on public.notification_segments for delete
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

-- Notifications: Admin can CRUD, users can view their eligible ones
create policy "Admins can view all notifications"
    on public.notifications for select
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can create notifications"
    on public.notifications for insert
    with check (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can update notifications"
    on public.notifications for update
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

create policy "Admins can delete notifications"
    on public.notifications for delete
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

-- Delivery: Users can view/update their own, admins can view all
create policy "Users can view own delivery records"
    on public.notification_delivery for select
    using (user_id = auth.uid());

create policy "Users can insert own delivery records"
    on public.notification_delivery for insert
    with check (user_id = auth.uid());

create policy "Users can update own delivery records"
    on public.notification_delivery for update
    using (user_id = auth.uid());

create policy "Admins can view all delivery records"
    on public.notification_delivery for select
    using (exists (
        select 1 from public.user_profiles
        where user_profiles.user_id = auth.uid()
        and user_profiles.plan = 'admin'
    ));

-- Preferences: Users can CRUD their own
create policy "Users can view own preferences"
    on public.user_notification_prefs for select
    using (user_id = auth.uid());

create policy "Users can insert own preferences"
    on public.user_notification_prefs for insert
    with check (user_id = auth.uid());

create policy "Users can update own preferences"
    on public.user_notification_prefs for update
    using (user_id = auth.uid());

create policy "Users can delete own preferences"
    on public.user_notification_prefs for delete
    using (user_id = auth.uid());

-- ===========================
-- 8. TRIGGERS
-- ===========================
-- Update updated_at timestamps
create or replace function public.update_notification_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger notification_segments_updated_at
    before update on public.notification_segments
    for each row execute function public.update_notification_updated_at();

create trigger notifications_updated_at
    before update on public.notifications
    for each row execute function public.update_notification_updated_at();

create trigger notification_delivery_updated_at
    before update on public.notification_delivery
    for each row execute function public.update_notification_updated_at();

create trigger user_notification_prefs_updated_at
    before update on public.user_notification_prefs
    for each row execute function public.update_notification_updated_at();

-- ===========================
-- 9. INDEXES FOR PERFORMANCE
-- ===========================
-- Composite indexes for common queries
create index if not exists notifications_status_kind_idx on public.notifications(status, kind);
create index if not exists notifications_live_banner_idx on public.notifications(status, show_banner) where status = 'live' and show_banner = true;
create index if not exists notification_delivery_pending_idx on public.notification_delivery(user_id, state) where state = 'pending';

-- migrate:down
drop function if exists public.track_notification_action cascade;
drop function if exists public.mark_notification_read cascade;
drop function if exists public.get_unread_notification_count cascade;
drop function if exists public.get_active_banner_for_user cascade;
drop function if exists public.update_notification_updated_at cascade;
drop table if exists public.user_notification_prefs cascade;
drop table if exists public.notification_delivery cascade;
drop table if exists public.notifications cascade;
drop table if exists public.notification_segments cascade;
