-- ===========================================
-- 0060_seasonal_periods_notifications.sql
-- Enhanced seasonal periods with seller notifications and lexybrain context
-- ===========================================
-- migrate:up

-- =====================================================
-- 1. Extend seasonal_periods schema
-- =====================================================

-- Add new columns for notifications and context
alter table public.seasonal_periods
  add column if not exists description text,
  add column if not exists notification_enabled boolean not null default true,
  add column if not exists notification_weeks_before integer not null default 4,
  add column if not exists updated_at timestamptz not null default now();

-- Update trigger for updated_at
create or replace function public.update_seasonal_periods_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger seasonal_periods_updated_at
  before update on public.seasonal_periods
  for each row execute function public.update_seasonal_periods_updated_at();

-- Add index for notification lookups
create index if not exists seasonal_periods_notification_enabled_idx
  on public.seasonal_periods(notification_enabled)
  where notification_enabled = true;

comment on column public.seasonal_periods.description is 'Detailed description of the seasonal period for seller context and AI insights';
comment on column public.seasonal_periods.notification_enabled is 'Enable notifications for this seasonal period';
comment on column public.seasonal_periods.notification_weeks_before is 'Number of weeks before start_date to send notification';

-- =====================================================
-- 2. Clear existing data and populate with comprehensive holidays
-- =====================================================

-- Truncate existing seasonal periods
truncate table public.seasonal_periods;

-- Insert comprehensive US and EU holidays and key seller dates
-- Note: Using recurring dates that work for multiple years

-- ========== Q1: January - March ==========

insert into public.seasonal_periods (name, country_code, start_date, end_date, weight, tags, description, notification_enabled, notification_weeks_before) values
  -- New Year
  ('New Year', 'global', '2025-12-26', '2026-01-07', 1.6,
   array['holiday', 'retail', 'party', 'celebration'],
   'New Year celebrations drive demand for party supplies, decorations, home organization, fitness products, and fresh start items. Peak shopping: Dec 26-Jan 7. Key categories: home decor, fitness, planners, organizational products.',
   true, 4),

  -- Martin Luther King Jr. Day (US)
  ('Martin Luther King Jr. Day', 'US', '2025-01-20', '2025-01-20', 1.1,
   array['holiday', 'us_federal'],
   'Federal holiday in the US. Minor retail impact but many sales events occur. Good for educational materials and diversity-focused products.',
   true, 3),

  -- Chinese New Year
  ('Chinese New Year', 'global', '2025-01-29', '2025-02-12', 1.5,
   array['holiday', 'cultural', 'retail'],
   'Lunar New Year celebrations create high demand for red decorations, gift items, traditional clothing, and celebration supplies. Major shopping period globally.',
   true, 4),

  -- Valentine''s Day
  ('Valentine''s Day', 'global', '2025-01-25', '2025-02-14', 1.7,
   array['holiday', 'retail', 'gifts', 'romance'],
   'Major retail event for gifts, jewelry, cards, flowers, chocolate, romantic items, and personalized products. Shopping peaks 2-3 weeks before. Key categories: jewelry, personalized gifts, home decor, apparel, beauty products.',
   true, 4),

  -- Presidents Day (US)
  ('Presidents Day', 'US', '2025-02-17', '2025-02-17', 1.2,
   array['holiday', 'us_federal', 'sales'],
   'Major sales weekend in the US. Good for furniture, mattresses, appliances, and home goods.',
   true, 3),

-- ========== Q2: April - June ==========

  -- Easter (varies by year, using typical range)
  ('Easter', 'global', '2025-03-25', '2025-04-20', 1.4,
   array['holiday', 'retail', 'spring'],
   'Easter drives sales of decorations, baskets, candy, spring clothing, and religious items. Shopping begins 4 weeks before. Key categories: crafts, home decor, children''s items, apparel.',
   true, 4),

  -- Earth Day
  ('Earth Day', 'global', '2025-04-22', '2025-04-22', 1.2,
   array['environmental', 'awareness'],
   'Growing interest in eco-friendly, sustainable, and green products. Good for reusable items, natural products, and environmental awareness merchandise.',
   true, 3),

  -- Mother''s Day (US/CA/AU)
  ('Mother''s Day', 'US', '2025-05-11', '2025-05-11', 1.8,
   array['holiday', 'retail', 'gifts'],
   'One of the biggest retail holidays. High demand for personalized gifts, jewelry, spa items, home decor, and sentimental products. Shopping peaks 3-4 weeks before. Second only to Christmas for gift-giving.',
   true, 5),

  ('Mother''s Day', 'GB', '2025-03-30', '2025-03-30', 1.8,
   array['holiday', 'retail', 'gifts'],
   'UK Mother''s Day (Mothering Sunday) - falls earlier than US version. Major gift-giving occasion for jewelry, flowers, cards, and personalized items.',
   true, 5),

  -- Memorial Day (US)
  ('Memorial Day Weekend', 'US', '2025-05-26', '2025-05-26', 1.4,
   array['holiday', 'us_federal', 'summer', 'outdoor'],
   'Unofficial start of summer in US. High demand for outdoor furniture, grilling supplies, camping gear, beach items, and patriotic decorations.',
   true, 4),

  -- Graduation Season
  ('Graduation Season', 'US', '2025-05-01', '2025-06-15', 1.5,
   array['seasonal', 'gifts', 'education'],
   'Peak graduation season for high school and college. Strong demand for gifts, party supplies, decorations, cards, and grad-themed items.',
   true, 4),

  -- Father''s Day
  ('Father''s Day', 'global', '2025-06-01', '2025-06-15', 1.5,
   array['holiday', 'retail', 'gifts'],
   'Major gift-giving holiday for tools, tech accessories, sporting goods, grilling items, and personalized products. Shopping peaks 2-3 weeks before.',
   true, 4),

  -- Juneteenth (US)
  ('Juneteenth', 'US', '2025-06-19', '2025-06-19', 1.2,
   array['holiday', 'us_federal', 'cultural'],
   'Federal holiday since 2021. Growing market for cultural items, educational materials, and celebration supplies.',
   true, 3),

-- ========== Q3: July - September ==========

  -- Independence Day (US)
  ('Independence Day', 'US', '2025-06-25', '2025-07-07', 1.6,
   array['holiday', 'us_federal', 'patriotic', 'summer'],
   '4th of July is major US holiday. Peak demand for patriotic decorations, outdoor party supplies, BBQ items, fireworks accessories, and summer products.',
   true, 4),

  -- Prime Day (Amazon, typically mid-July)
  ('Prime Day Season', 'global', '2025-07-10', '2025-07-20', 1.4,
   array['ecommerce', 'sales', 'retail'],
   'Amazon Prime Day creates competitive pressure. Many marketplaces see increased shopping activity. Good time for promotions and competitive pricing.',
   true, 3),

  -- Summer Sales Peak
  ('Summer Peak Season', 'global', '2025-07-01', '2025-08-15', 1.3,
   array['seasonal', 'summer', 'retail'],
   'Peak summer shopping for vacation items, outdoor gear, beach products, summer fashion, and travel accessories. Strong sales period for seasonal goods.',
   true, 4),

  -- Back to School (US)
  ('Back to School', 'US', '2025-07-15', '2025-09-15', 1.7,
   array['seasonal', 'education', 'retail'],
   'Second largest retail season after holidays. Massive demand for school supplies, clothing, backpacks, dorm items, and organizational products. Shopping begins in late July.',
   true, 5),

  -- Labor Day (US)
  ('Labor Day Weekend', 'US', '2025-09-01', '2025-09-01', 1.4,
   array['holiday', 'us_federal', 'sales'],
   'End of summer sales event in US. Good for furniture, appliances, clothing clearance, and outdoor items. Major shopping weekend.',
   true, 3),

-- ========== Q4: October - December (THE GOLDEN QUARTER) ==========

  -- Halloween
  ('Halloween', 'US', '2025-09-15', '2025-10-31', 1.8,
   array['holiday', 'retail', 'costumes', 'decor'],
   'Major retail holiday. High demand for costumes, decorations, candy, party supplies, and spooky-themed items. Shopping begins 6 weeks early. One of top 5 retail holidays.',
   true, 6),

  ('Halloween', 'GB', '2025-10-01', '2025-10-31', 1.5,
   array['holiday', 'retail', 'costumes', 'decor'],
   'Growing holiday in UK. Increasing demand for costumes, decorations, and party supplies.',
   true, 4),

  -- Singles'' Day / 11.11 (China, but global impact)
  ('Singles'' Day', 'global', '2025-11-01', '2025-11-11', 1.7,
   array['ecommerce', 'sales', 'global'],
   'World''s biggest shopping day (11/11). Originated in China but impacts global ecommerce. Massive sales and promotional activity worldwide.',
   true, 4),

  -- Veterans Day (US)
  ('Veterans Day', 'US', '2025-11-11', '2025-11-11', 1.2,
   array['holiday', 'us_federal', 'patriotic'],
   'Federal holiday with retail sales. Good for patriotic items, military-themed products, and general promotions.',
   true, 3),

  -- Thanksgiving (US)
  ('Thanksgiving Week', 'US', '2025-11-20', '2025-11-27', 1.6,
   array['holiday', 'us_federal', 'autumn'],
   'Major US holiday. High demand for home decor, kitchen items, hosting supplies, and autumn-themed products. Leads directly into Black Friday.',
   true, 4),

  -- Black Friday / Cyber Monday
  ('Black Friday', 'global', '2025-11-28', '2025-11-28', 2.0,
   array['ecommerce', 'sales', 'retail', 'holiday'],
   'BIGGEST shopping day of the year globally. Maximum demand across all categories. Sellers must be prepared weeks in advance. Critical preparation period for inventory, promotions, and listings.',
   true, 6),

  ('Cyber Monday', 'global', '2025-12-01', '2025-12-01', 1.9,
   array['ecommerce', 'sales', 'online'],
   'Biggest online shopping day. Second only to Black Friday. Online-focused sales and promotions. Critical for ecommerce sellers.',
   true, 6),

  -- Hanukkah (varies by year, using typical range)
  ('Hanukkah', 'global', '2025-12-14', '2025-12-22', 1.5,
   array['holiday', 'cultural', 'gifts'],
   'Eight-day Jewish holiday. Demand for menorahs, dreidels, decorations, gifts, and Judaica. Gift-giving throughout the festival.',
   true, 4),

  -- Christmas Season
  ('Christmas Shopping Season', 'global', '2025-11-25', '2025-12-25', 2.0,
   array['holiday', 'retail', 'gifts', 'decor'],
   'THE BIGGEST retail season of the year. Peak demand for gifts, decorations, apparel, toys, and virtually all product categories. Shopping begins right after Thanksgiving. Sellers should prepare 8+ weeks in advance. Accounts for 20-30% of annual retail sales.',
   true, 8),

  -- Kwanzaa
  ('Kwanzaa', 'US', '2025-12-26', '2026-01-01', 1.3,
   array['holiday', 'cultural', 'celebration'],
   'Seven-day African American cultural celebration. Growing market for cultural items, decorations, and traditional items.',
   true, 3),

-- ========== Additional Important Periods ==========

  -- Spring Cleaning Season
  ('Spring Cleaning Season', 'global', '2025-03-01', '2025-04-30', 1.3,
   array['seasonal', 'home', 'organization'],
   'Traditional spring cleaning period. High demand for organizational products, cleaning supplies, storage solutions, and home improvement items.',
   true, 4),

  -- Wedding Season
  ('Wedding Season Peak', 'global', '2025-05-01', '2025-10-31', 1.4,
   array['seasonal', 'events', 'gifts'],
   'Peak wedding season (May-October). Strong demand for wedding-related items, gifts, decorations, and bridal party supplies.',
   true, 6),

  -- Q4 Holiday Prep Period
  ('Q4 Holiday Preparation', 'global', '2025-10-01', '2025-11-15', 1.5,
   array['retail', 'planning', 'ecommerce'],
   'CRITICAL preparation period for Q4 holidays. Sellers must optimize listings, build inventory, plan promotions, and prepare for peak season. Early holiday shoppers begin browsing.',
   true, 4)

on conflict do nothing;

-- =====================================================
-- 3. Function to check and notify users about upcoming seasonal periods
-- =====================================================

create or replace function public.notify_upcoming_seasonal_periods()
returns void
language plpgsql
security definer
as $$
declare
  v_period record;
  v_user record;
  v_notification_date date;
  v_days_until int;
  v_weeks_until numeric;
  v_event_key text;
  v_body text;
  v_priority int;
begin
  -- Loop through all notification-enabled seasonal periods
  for v_period in
    select
      sp.id,
      sp.name,
      sp.description,
      sp.country_code,
      sp.start_date,
      sp.end_date,
      sp.notification_weeks_before,
      sp.weight
    from public.seasonal_periods sp
    where sp.notification_enabled = true
      and sp.start_date > current_date
      and sp.start_date <= current_date + interval '12 months'
  loop
    -- Calculate notification trigger date
    v_notification_date := v_period.start_date - (v_period.notification_weeks_before || ' weeks')::interval;

    -- Check if we should send notification today (within 1 day tolerance)
    if current_date between v_notification_date - 1 and v_notification_date + 1 then

      v_days_until := v_period.start_date - current_date;
      v_weeks_until := round(v_days_until / 7.0, 1);

      -- Build notification body
      v_body := format(
        '%s starts in %s weeks (%s days) on %s. %s',
        v_period.name,
        v_weeks_until,
        v_days_until,
        to_char(v_period.start_date, 'Mon DD, YYYY'),
        coalesce(v_period.description, 'Prepare your listings and inventory now!')
      );

      -- Priority based on weight (higher weight = higher priority)
      v_priority := case
        when v_period.weight >= 2.0 then 90  -- Critical (Christmas, Black Friday)
        when v_period.weight >= 1.7 then 80  -- High (Major holidays)
        when v_period.weight >= 1.4 then 70  -- Medium
        else 60                              -- Standard
      end;

      -- Notify all active sellers (users with user_profiles)
      for v_user in
        select distinct up.user_id
        from public.user_profiles up
        where up.user_id is not null
          -- Optional: Filter by country if period is country-specific
          and (v_period.country_code is null
               or v_period.country_code = 'global'
               or up.extras->>'country' = v_period.country_code)
      loop
        v_event_key := format('seasonal_period:%s:%s:%s',
                             v_user.user_id,
                             v_period.id,
                             v_period.start_date);

        perform public.notify_user(
          v_user.user_id,
          'inapp',
          'keyword',
          format('🎯 %s is coming! Prepare now', v_period.name),
          v_body,
          case
            when v_period.weight >= 2.0 then 'warning'
            else 'info'
          end,
          '/keywords',
          'Optimize your listings',
          v_priority,
          true,  -- show_once_per_user
          jsonb_build_object(
            'trigger', 'seasonal_period_upcoming',
            'period_id', v_period.id,
            'period_name', v_period.name,
            'start_date', v_period.start_date,
            'days_until', v_days_until,
            'weight', v_period.weight
          ),
          v_event_key,
          'system',
          '📅'
        );
      end loop;
    end if;
  end loop;
end;
$$;

comment on function public.notify_upcoming_seasonal_periods()
  is 'Daily cron job: Check for seasonal periods approaching notification threshold and alert sellers';

-- =====================================================
-- 4. Function to get current and upcoming seasonal context for LexyBrain
-- =====================================================

create or replace function public.get_seasonal_context(
  p_as_of date default current_date,
  p_country_code text default 'global',
  p_lookahead_days int default 60
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_current jsonb;
  v_upcoming jsonb;
  v_result jsonb;
begin
  -- Get current active periods
  select jsonb_agg(
    jsonb_build_object(
      'name', sp.name,
      'description', sp.description,
      'start_date', sp.start_date,
      'end_date', sp.end_date,
      'weight', sp.weight,
      'tags', sp.tags,
      'days_remaining', sp.end_date - p_as_of
    )
  )
  into v_current
  from public.seasonal_periods sp
  where p_as_of between sp.start_date and sp.end_date
    and (sp.country_code = p_country_code
         or sp.country_code is null
         or sp.country_code = 'global'
         or p_country_code = 'global')
  order by sp.weight desc;

  -- Get upcoming periods within lookahead window
  select jsonb_agg(
    jsonb_build_object(
      'name', sp.name,
      'description', sp.description,
      'start_date', sp.start_date,
      'end_date', sp.end_date,
      'weight', sp.weight,
      'tags', sp.tags,
      'days_until', sp.start_date - p_as_of
    )
  )
  into v_upcoming
  from public.seasonal_periods sp
  where sp.start_date > p_as_of
    and sp.start_date <= p_as_of + p_lookahead_days
    and (sp.country_code = p_country_code
         or sp.country_code is null
         or sp.country_code = 'global'
         or p_country_code = 'global')
  order by sp.start_date asc
  limit 10;

  -- Build result
  v_result := jsonb_build_object(
    'as_of', p_as_of,
    'country', p_country_code,
    'current_periods', coalesce(v_current, '[]'::jsonb),
    'upcoming_periods', coalesce(v_upcoming, '[]'::jsonb)
  );

  return v_result;
end;
$$;

comment on function public.get_seasonal_context(date, text, int)
  is 'Returns current and upcoming seasonal periods for LexyBrain context enrichment';

-- =====================================================
-- 5. Schedule daily cron job for seasonal notifications
-- =====================================================

select cron.schedule(
  'notify_seasonal_periods_daily',
  '0 10 * * *',  -- Run at 10 AM UTC daily
  $$select public.notify_upcoming_seasonal_periods();$$
)
where not exists (
  select 1 from cron.job where jobname = 'notify_seasonal_periods_daily'
);

-- =====================================================
-- 6. Grant permissions
-- =====================================================

grant execute on function public.get_seasonal_context(date, text, int) to anon, authenticated, service_role;
grant execute on function public.notify_upcoming_seasonal_periods() to service_role;

-- =====================================================
-- migrate:down
-- =====================================================

-- Remove cron job
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'notify_seasonal_periods_daily';
exception when undefined_table then
  null;
end; $$;

-- Drop functions
drop function if exists public.get_seasonal_context(date, text, int);
drop function if exists public.notify_upcoming_seasonal_periods();

-- Drop trigger and function
drop trigger if exists seasonal_periods_updated_at on public.seasonal_periods;
drop function if exists public.update_seasonal_periods_updated_at();

-- Remove columns
alter table public.seasonal_periods
  drop column if exists updated_at,
  drop column if exists notification_weeks_before,
  drop column if exists notification_enabled,
  drop column if exists description;

-- Drop indexes
drop index if exists public.seasonal_periods_notification_enabled_idx;
