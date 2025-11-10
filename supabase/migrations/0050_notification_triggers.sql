-- 0050_notification_triggers.sql
-- Bootstrap notification triggers and helper utilities for onboarding,
-- quota, insights, extension engagement, billing, and system health events.

-- =====================================================
-- Helper tables and functions
-- =====================================================

-- Event log to prevent duplicate notifications per user/event
create table if not exists public.notification_event_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  notification_id uuid references public.notifications(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

comment on table public.notification_event_log is 'Tracks notification events per user to prevent duplicates.';

-- Reusable helper for inserting notifications + delivery rows
create or replace function public.notify_user(
  p_user_id uuid,
  p_kind text,
  p_category text,
  p_title text,
  p_body text default null,
  p_severity text default 'info',
  p_cta_url text default null,
  p_cta_text text default null,
  p_priority integer default 50,
  p_show_once boolean default false,
  p_meta jsonb default '{}'::jsonb,
  p_event_key text default null,
  p_source text default 'system',
  p_icon text default null
) returns uuid
language plpgsql
security definer
as $$
declare
  v_inapp_enabled boolean := true;
  v_email_enabled boolean := true;
  v_kind text := lower(coalesce(p_kind, 'inapp'));
  v_category text := lower(p_category);
  v_severity text := lower(coalesce(p_severity, 'info'));
  v_channels text[] := array[]::text[];
  v_send_email boolean := false;
  v_create_inapp boolean := false;
  v_notification_id uuid;
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_audience_filter jsonb;
  v_existing_prefs record;
begin
  if p_user_id is null then
    return null;
  end if;

  -- Ensure supported enums
  if v_kind not in ('banner', 'inapp', 'email', 'mixed') then
    raise exception 'Unsupported notification kind: %', v_kind;
  end if;

  if v_category not in ('keyword', 'watchlist', 'ai', 'account', 'system', 'collab') then
    raise exception 'Unsupported notification category: %', v_category;
  end if;

  if v_severity not in ('info', 'success', 'warning', 'critical') then
    raise exception 'Unsupported notification severity: %', v_severity;
  end if;

  -- Deduplicate when an event key is supplied
  if p_event_key is not null then
    if exists (
      select 1
      from public.notification_event_log nel
      where nel.user_id = p_user_id
        and nel.event_key = p_event_key
    ) then
      return null;
    end if;
    v_meta := v_meta || jsonb_build_object('event_key', p_event_key);
  end if;

  -- Fetch user preferences (defaults to enabled if missing)
  select inp.inapp_enabled, inp.email_enabled
    into v_inapp_enabled, v_email_enabled
  from public.user_notification_prefs inp
  where inp.user_id = p_user_id
    and inp.category = v_category;

  if not found then
    insert into public.user_notification_prefs (user_id, category)
    values (p_user_id, v_category)
    on conflict (user_id, category) do nothing;
    v_inapp_enabled := true;
    v_email_enabled := true;
  end if;

  -- Determine delivery channels respecting preferences
  if v_kind in ('inapp', 'mixed') and v_inapp_enabled then
    v_channels := array_append(v_channels, 'inapp');
    v_create_inapp := true;
  end if;

  if v_kind = 'banner' and v_inapp_enabled then
    v_channels := array_append(v_channels, 'banner');
  end if;

  if v_kind in ('email', 'mixed') and v_email_enabled then
    v_channels := array_append(v_channels, 'email');
    v_send_email := true;
  end if;

  -- If user disabled all relevant channels, skip notification
  if array_length(v_channels, 1) is null then
    return null;
  end if;

  v_audience_filter := jsonb_build_object(
    'user_ids', to_jsonb(array[p_user_id])
  );

  insert into public.notifications (
    kind,
    source,
    category,
    title,
    body,
    cta_text,
    cta_url,
    severity,
    priority,
    icon,
    audience_scope,
    audience_filter,
    show_once_per_user,
    create_inapp,
    show_banner,
    send_email,
    status,
    meta
  ) values (
    v_kind,
    p_source,
    v_category,
    p_title,
    p_body,
    coalesce(p_cta_text, case when p_cta_url is not null then 'View' else null end),
    p_cta_url,
    v_severity,
    coalesce(p_priority, 50),
    p_icon,
    case when v_kind = 'banner' then 'user_ids' else 'user_ids' end,
    v_audience_filter,
    p_show_once,
    v_create_inapp,
    (v_kind = 'banner'),
    v_send_email,
    'live',
    v_meta
  )
  returning id into v_notification_id;

  insert into public.notification_delivery (
    notification_id,
    user_id,
    channels,
    state
  ) values (
    v_notification_id,
    p_user_id,
    v_channels,
    'pending'
  );

  if p_event_key is not null then
    insert into public.notification_event_log (user_id, event_key, notification_id)
    values (p_user_id, p_event_key, v_notification_id)
    on conflict (user_id, event_key) do nothing;
  end if;

  return v_notification_id;
end;
$$;

comment on function public.notify_user(uuid, text, text, text, text, text, text, text, integer, boolean, jsonb, text, text, text)
  is 'Create a notification + delivery record for a specific user respecting preferences and deduplication.';

-- Ensure default notification preferences exist for all users
insert into public.user_notification_prefs (user_id, category)
select u.id, cat.category
from auth.users u
cross join (values
  ('keyword'),
  ('watchlist'),
  ('ai'),
  ('account'),
  ('system'),
  ('collab')
) as cat(category)
where not exists (
  select 1
  from public.user_notification_prefs p
  where p.user_id = u.id
    and p.category = cat.category
);

-- Helper function to determine suggested upgrade plan label
create or replace function public.next_plan_label(p_current text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_current, 'free'))
    when 'free' then 'Basic'
    when 'basic' then 'Pro'
    when 'pro' then 'Growth'
    else 'Pro'
  end;
$$;

comment on function public.next_plan_label(text) is 'Return the next recommended plan label for upgrade messaging.';

-- Helper to log upsell CTA clicks into pricing_analytics
create or replace function public.log_pricing_analytics_event(
  p_user_id uuid,
  p_event_type text,
  p_context jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.pricing_analytics (user_id, event_type, metadata)
  values (p_user_id, coalesce(p_event_type, 'cta_clicked'), coalesce(p_context, '{}'::jsonb));
exception when undefined_table then
  -- pricing_analytics may be pruned in certain environments
  null;
end;
$$;

comment on function public.log_pricing_analytics_event(uuid, text, jsonb)
  is 'Record pricing analytics events such as upsell CTA clicks.';

-- =====================================================
-- Onboarding triggers
-- =====================================================

create or replace function public.handle_user_profile_created()
returns trigger
language plpgsql
as $$
begin
  perform public.notify_user(
    new.user_id,
    'banner',
    'system',
    'Welcome to LexyHub',
    'Start by searching a product keyword to see real-time marketplace data.',
    'info',
    null,
    null,
    80,
    true,
    jsonb_build_object('trigger', 'first_login'),
    'onboarding:welcome_banner'
  );
  return new;
end;
$$;

create trigger trg_user_profile_created_notify
after insert on public.user_profiles
for each row execute function public.handle_user_profile_created();

create or replace function public.handle_extension_session_insert()
returns trigger
language plpgsql
as $$
declare
  v_event_key text := 'extension_installed';
begin
  perform public.notify_user(
    new.user_id,
    'inapp',
    'account',
    'Extension connected — enjoy higher free limits.',
    null,
    'success',
    null,
    null,
    60,
    true,
    jsonb_build_object('trigger', 'extension_installed'),
    v_event_key
  );
  return new;
end;
$$;

create trigger trg_extension_session_insert_notify
after insert on public.extension_sessions
for each row execute function public.handle_extension_session_insert();

create or replace function public.handle_keyword_first_search()
returns trigger
language plpgsql
as $$
declare
  v_existing int;
begin
  select count(*) into v_existing
  from public.keyword_search_requests ksr
  where ksr.user_id = new.user_id
    and ksr.id <> new.id;

  if coalesce(v_existing, 0) = 0 then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'keyword',
      'Your first keyword search is live.',
      null,
      'success',
      '/keywords',
      'View keyword insights.',
      65,
      true,
      jsonb_build_object('trigger', 'first_keyword_search', 'query', new.normalized_query),
      'onboarding:first_keyword_search'
    );
  end if;
  return new;
end;
$$;

create trigger trg_keyword_first_search_notify
after insert on public.keyword_search_requests
for each row execute function public.handle_keyword_first_search();

-- =====================================================
-- Quota and usage warnings
-- =====================================================

create or replace function public.handle_usage_warning_insert()
returns trigger
language plpgsql
as $$
declare
  v_plan text;
  v_next_plan text;
  v_title text;
  v_body text;
  v_severity text := 'warning';
  v_event_key text;
begin
  select plan into v_plan from public.user_profiles where user_id = new.user_id;
  v_next_plan := public.next_plan_label(v_plan);

  if new.threshold_percent >= 100 then
    v_title := 'Monthly limit reached. Upgrade to unlock more searches.';
    v_body := format('Upgrade to %s to continue uninterrupted.', v_next_plan);
    v_severity := 'critical';
    v_event_key := format('quota_exceeded:%s:%s', new.quota_key, new.period_start);
  else
    v_title := format('You''ve used %s%% of your %s quota.', new.threshold_percent, new.quota_key);
    v_body := format('Upgrade to %s to continue uninterrupted.', v_next_plan);
    v_event_key := format('quota_warning:%s:%s:%s', new.quota_key, new.threshold_percent, new.period_start);
  end if;

  perform public.notify_user(
    new.user_id,
    'mixed',
    'account',
    v_title,
    v_body,
    v_severity,
    '/pricing',
    'View Plans',
    70,
    true,
    jsonb_build_object(
      'trigger', 'usage_warning',
      'quota_key', new.quota_key,
      'threshold', new.threshold_percent,
      'period_start', new.period_start
    ),
    v_event_key
  );

  -- Log CTA availability for analytics
  perform public.log_pricing_analytics_event(
    new.user_id,
    'usage_warning_created',
    jsonb_build_object(
      'quota_key', new.quota_key,
      'threshold', new.threshold_percent
    )
  );

  return new;
end;
$$;

create trigger trg_usage_warning_insert_notify
after insert on public.usage_warnings
for each row execute function public.handle_usage_warning_insert();

-- =====================================================
-- Insight & intelligence triggers
-- =====================================================

create or replace function public.handle_ai_insight_insert()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null and new.status = 'ready' then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'ai',
      'Your new AI insight is ready.',
      null,
      'info',
      '/insights',
      'View Insight',
      60,
      false,
      jsonb_build_object('trigger', 'ai_insight_ready', 'insight_id', new.id),
      format('ai_insight:%s', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_ai_insight_insert_notify
after insert on public.ai_insights
for each row execute function public.handle_ai_insight_insert();

create or replace function public.handle_keyword_snapshot_insert()
returns trigger
language plpgsql
as $$
begin
  if new.scope = 'user' and new.created_by is not null then
    perform public.notify_user(
      new.created_by,
      'inapp',
      'keyword',
      'Keyword insights updated — check trending opportunities.',
      null,
      'info',
      '/keywords',
      'View keyword insights.',
      55,
      false,
      jsonb_build_object('trigger', 'keyword_snapshot', 'keyword_id', new.keyword_id),
      format('keyword_snapshot:%s:%s', new.created_by, new.keyword_id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_keyword_snapshot_insert_notify
after insert on public.keyword_insight_snapshots
for each row execute function public.handle_keyword_snapshot_insert();

create or replace function public.handle_risk_event_insert()
returns trigger
language plpgsql
as $$
declare
  rec record;
  v_event_key text;
begin
  for rec in
    select w.user_id, k.term
    from public.user_keyword_watchlists w
    join public.keywords k on k.id = new.keyword_id
    where w.alert_enabled = true
      and new.keyword_id is not null
  loop
    v_event_key := format('risk_event:%s:%s', new.keyword_id, rec.user_id);
    perform public.notify_user(
      rec.user_id,
      'inapp',
      'keyword',
      'Keyword flagged as risky trend.',
      format('Keyword "%s" has been flagged as a risky trend.', rec.term),
      'warning',
      '/watchlist',
      'Review keyword',
      75,
      false,
      jsonb_build_object('trigger', 'risk_event', 'keyword_id', new.keyword_id),
      v_event_key
    );
  end loop;
  return new;
end;
$$;

create trigger trg_risk_event_insert_notify
after insert on public.risk_events
for each row execute function public.handle_risk_event_insert();

create or replace function public.handle_keyword_volume_jump()
returns trigger
language plpgsql
as $$
declare
  v_prev numeric;
  v_change numeric;
  v_term text;
  v_users record;
  v_event_key text;
begin
  if new.search_volume is null then
    return new;
  end if;

  select k.term into v_term from public.keywords k where k.id = new.keyword_id;

  select avg(kmd.search_volume)::numeric into v_prev
  from public.keyword_metrics_daily kmd
  where kmd.keyword_id = new.keyword_id
    and kmd.collected_on between new.collected_on - interval '14 days' and new.collected_on - interval '7 days';

  if v_prev is null or v_prev = 0 then
    return new;
  end if;

  v_change := (new.search_volume - v_prev) / v_prev * 100;

  if v_change < 25 then
    return new;
  end if;

  for v_users in
    select distinct w.user_id
    from public.user_keyword_watchlists w
    where w.keyword_id = new.keyword_id
  loop
    v_event_key := format('keyword_volume_jump:%s:%s:%s', new.keyword_id, new.collected_on::date, v_users.user_id);
    perform public.notify_user(
      v_users.user_id,
      'inapp',
      'keyword',
      format('Search demand for "%s" is surging.', coalesce(v_term, 'your tracked keyword')),
      format('Volume increased %.1f%% compared to last week.', v_change),
      'info',
      '/watchlist',
      'View keyword trend',
      65,
      false,
      jsonb_build_object('trigger', 'volume_jump', 'keyword_id', new.keyword_id, 'change_pct', v_change),
      v_event_key
    );
  end loop;

  return new;
end;
$$;

create trigger trg_keyword_volume_jump_notify
after insert on public.keyword_metrics_daily
for each row execute function public.handle_keyword_volume_jump();

-- =====================================================
-- Extension engagement triggers
-- =====================================================

create or replace function public.handle_extension_session_update()
returns trigger
language plpgsql
as $$
declare
  v_new_terms int := coalesce(array_length(new.terms_discovered, 1), 0);
  v_old_terms int := coalesce(array_length(old.terms_discovered, 1), 0);
  v_event_key text;
begin
  if v_new_terms >= 10 and v_old_terms < 10 then
    v_event_key := format('extension_session_terms:%s', new.id);
    perform public.notify_user(
      new.user_id,
      'inapp',
      'keyword',
      'You\'ve unlocked 10+ new keywords during browsing.',
      null,
      'success',
      '/watchlist',
      'Send them to your Watchlist.',
      55,
      false,
      jsonb_build_object('trigger', 'extension_terms', 'session_id', new.id),
      v_event_key
    );
  end if;
  return new;
end;
$$;

create trigger trg_extension_session_update_notify
after update on public.extension_sessions
for each row when (new.terms_discovered is distinct from old.terms_discovered)
execute function public.handle_extension_session_update();

create or replace function public.handle_ext_watchlist_success()
returns trigger
language plpgsql
as $$
begin
  if new.processed_at is not null and new.error_message is null then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'watchlist',
      'Added to Watchlist successfully.',
      null,
      'success',
      '/watchlist',
      'View Watchlist',
      50,
      false,
      jsonb_build_object('trigger', 'extension_watchlist_success', 'term', new.term),
      format('ext_watchlist_success:%s', new.id)
    );
  elsif new.error_message is not null then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'watchlist',
      'Failed to add keyword — retry from extension.',
      new.error_message,
      'warning',
      null,
      null,
      60,
      false,
      jsonb_build_object('trigger', 'extension_watchlist_error', 'term', new.term),
      format('ext_watchlist_error:%s:%s', new.user_id, new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_ext_watchlist_upsert_notify
after update on public.ext_watchlist_upsert_queue
for each row execute function public.handle_ext_watchlist_success();

-- =====================================================
-- Feedback and failure triggers
-- =====================================================

create or replace function public.handle_ai_failure_insert()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'ai',
      'An AI request failed — we''re investigating.',
      null,
      'warning',
      null,
      null,
      70,
      false,
      jsonb_build_object('trigger', 'ai_failure', 'failure_id', new.id),
      format('ai_failure:%s', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_ai_failure_insert_notify
after insert on public.ai_failures
for each row execute function public.handle_ai_failure_insert();

create or replace function public.handle_feedback_status_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null and new.status in ('planned', 'done') and old.status is distinct from new.status then
    perform public.notify_user(
      new.user_id,
      'inapp',
      'system',
      'Your feedback has been reviewed.',
      null,
      'info',
      '/changelog',
      'View Change Log',
      50,
      false,
      jsonb_build_object('trigger', 'feedback_status', 'feedback_id', new.id, 'status', new.status),
      format('feedback_status:%s:%s', new.id, new.status)
    );
  end if;
  return new;
end;
$$;

create trigger trg_feedback_status_update_notify
after update on public.feedback
for each row execute function public.handle_feedback_status_update();

-- =====================================================
-- Plan & billing triggers
-- =====================================================

create or replace function public.handle_billing_subscription_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' then
    perform public.notify_user(
      new.user_id,
      'mixed',
      'account',
      format('Your %s plan is active.', initcap(new.plan)),
      null,
      'success',
      '/billing',
      'Manage subscription',
      65,
      true,
      jsonb_build_object('trigger', 'plan_active', 'plan', new.plan),
      format('plan_active:%s:%s', new.user_id, new.plan)
    );
  end if;
  return new;
end;
$$;

create trigger trg_billing_subscription_insert_notify
after insert on public.billing_subscriptions
for each row execute function public.handle_billing_subscription_insert();

create or replace function public.handle_billing_subscription_update()
returns trigger
language plpgsql
as $$
begin
  if new.cancel_at_period_end = true and coalesce(old.cancel_at_period_end, false) = false then
    perform public.notify_user(
      new.user_id,
      'mixed',
      'account',
      'Subscription will end soon — you can renew anytime.',
      null,
      'warning',
      '/billing',
      'Review options',
      60,
      false,
      jsonb_build_object('trigger', 'subscription_cancelled'),
      format('subscription_cancel:%s:%s', new.user_id, new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_billing_subscription_update_notify
after update on public.billing_subscriptions
for each row execute function public.handle_billing_subscription_update();

create or replace function public.handle_referral_reward_insert()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'mixed',
      'account',
      'You earned referral rewards. Extend your plan or claim payout.',
      null,
      'success',
      '/billing',
      'View rewards',
      55,
      false,
      jsonb_build_object('trigger', 'referral_reward', 'reward_id', new.id),
      format('referral_reward:%s:%s', new.user_id, new.id)
    );
  end if;
  return new;
end;
$$;

create trigger trg_referral_rewards_insert_notify
after insert on public.referral_rewards
for each row execute function public.handle_referral_reward_insert();

-- =====================================================
-- Upsell & retention triggers
-- =====================================================

create or replace function public.handle_upsell_trigger_insert()
returns trigger
language plpgsql
as $$
begin
  perform public.notify_user(
    new.user_id,
    'inapp',
    'account',
    'Upgrade to Pro to see competitor insights.',
    null,
    'info',
    '/pricing',
    'Upgrade to Pro',
    55,
    false,
    jsonb_build_object('trigger', 'upsell', 'trigger_type', new.trigger_type),
    format('upsell:%s:%s', new.user_id, new.id)
  );

  perform public.log_pricing_analytics_event(
    new.user_id,
    'upsell_triggered',
    jsonb_build_object('trigger_type', new.trigger_type)
  );

  return new;
end;
$$;

create trigger trg_upsell_triggers_insert_notify
after insert on public.upsell_triggers
for each row execute function public.handle_upsell_trigger_insert();

-- Scheduled job helper for inactive users (14 days)
create or replace function public.enqueue_inactive_user_notifications()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
  v_event_key text;
begin
  for rec in
    select u.id as user_id
    from auth.users u
    left join public.user_activity ua on ua.user_id = u.id and ua.occurred_at >= now() - interval '14 days'
    where ua.user_id is null
  loop
    v_event_key := format('user_inactive_14d:%s:%s', rec.user_id, current_date);
    perform public.notify_user(
      rec.user_id,
      'inapp',
      'account',
      'Haven’t searched in a while? Discover new trending keywords.',
      null,
      'info',
      '/keywords',
      'Start searching',
      50,
      false,
      jsonb_build_object('trigger', 'user_inactive_14d'),
      v_event_key
    );
  end loop;
end;
$$;

comment on function public.enqueue_inactive_user_notifications()
  is 'Daily task: remind users inactive for 14 days to re-engage.';

-- Watchlist capacity alert (80% of plan)
create or replace function public.enqueue_watchlist_capacity_alerts()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
  v_limit int;
  v_event_key text;
begin
  for rec in
    select up.user_id,
           coalesce(pl.niches_max, 0) as plan_limit,
           count(w.id) as watchlist_count
    from public.user_profiles up
    left join public.plan_limits pl on lower(pl.plan_code) = lower(up.plan)
    left join public.user_keyword_watchlists w on w.user_id = up.user_id
    group by up.user_id, plan_limit
    having coalesce(pl.niches_max, 0) > 0
       and count(w.id) >= coalesce(pl.niches_max, 0) * 0.8
  loop
    v_event_key := format('watchlist_capacity:%s:%s', rec.user_id, current_date);
    perform public.notify_user(
      rec.user_id,
      'inapp',
      'watchlist',
      'Your watchlist is almost full. Increase capacity with Pro.',
      format('You are tracking %s keywords out of %s available on your plan.', rec.watchlist_count, rec.plan_limit),
      'warning',
      '/pricing',
      'Upgrade for more capacity',
      60,
      false,
      jsonb_build_object('trigger', 'watchlist_capacity', 'watchlist_count', rec.watchlist_count, 'plan_limit', rec.plan_limit),
      v_event_key
    );
  end loop;
end;
$$;

comment on function public.enqueue_watchlist_capacity_alerts()
  is 'Weekly task: warn users when watchlist usage exceeds 80% of plan capacity.';

-- Register cron jobs for the scheduled functions
select cron.schedule(
  'notify_inactive_users_daily',
  '0 12 * * *',
  $$select public.enqueue_inactive_user_notifications();$$
)
where not exists (
  select 1 from cron.job where jobname = 'notify_inactive_users_daily'
);

select cron.schedule(
  'notify_watchlist_capacity_weekly',
  '0 9 * * MON',
  $$select public.enqueue_watchlist_capacity_alerts();$$
)
where not exists (
  select 1 from cron.job where jobname = 'notify_watchlist_capacity_weekly'
);

-- =====================================================
-- System health / admin triggers
-- =====================================================

create or replace function public.handle_system_health_metric()
returns trigger
language plpgsql
security definer
as $$
declare
  rec record;
  v_event_key text := format('system_health:%s:%s:%s', new.category, new.metric_key, new.captured_at::date);
  v_admins refcursor;
  v_admin_id uuid;
begin
  if new.status = 'ok' then
    return new;
  end if;

  for rec in
    select id
    from auth.users
    where coalesce(raw_app_meta_data->>'is_admin', 'false') in ('true', '1', 'yes')
       or coalesce(raw_user_meta_data->>'is_admin', 'false') in ('true', '1', 'yes')
  loop
    perform public.notify_user(
      rec.id,
      'inapp',
      'system',
      'Crawler or ingestion degraded.',
      format('%s: %s status is %s', new.category, new.metric_label, new.status),
      'warning',
      null,
      null,
      90,
      false,
      jsonb_build_object('trigger', 'system_health', 'metric_key', new.metric_key),
      v_event_key
    );
  end loop;

  return new;
end;
$$;

create trigger trg_system_health_metric_notify
after insert or update on public.system_health_metrics
for each row execute function public.handle_system_health_metric();

create or replace function public.handle_data_provider_disabled()
returns trigger
language plpgsql
as $$
declare
  rec record;
  v_event_key text;
begin
  if new.is_enabled then
    return new;
  end if;

  for rec in
    select distinct ma.user_id
    from public.marketplace_accounts ma
    where ma.provider_id = new.id
  loop
    v_event_key := format('provider_disabled:%s:%s', rec.user_id, new.id);
    perform public.notify_user(
      rec.user_id,
      'inapp',
      'system',
      format('Temporary maintenance on %s. Data may be delayed.', new.display_name),
      null,
      'warning',
      null,
      null,
      70,
      false,
      jsonb_build_object('trigger', 'provider_disabled', 'provider_id', new.id),
      v_event_key
    );
  end loop;

  return new;
end;
$$;

create trigger trg_data_provider_update_notify
after update on public.data_providers
for each row execute function public.handle_data_provider_disabled();

-- =====================================================
-- migrate:down cleanup (partial)
-- =====================================================

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in ('notify_inactive_users_daily', 'notify_watchlist_capacity_weekly');
exception when undefined_table then
  null;
end; $$;

