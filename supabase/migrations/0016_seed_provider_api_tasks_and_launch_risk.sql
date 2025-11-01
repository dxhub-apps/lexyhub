-- ===========================================
-- 0016_seed_provider_api_tasks_and_launch_risk.sql
-- ===========================================
-- migrate:up
insert into public.backoffice_tasks (
    id,
    title,
    description,
    owner,
    status_id,
    start_date,
    due_date,
    priority,
    metadata
)
select * from (
    select
        '6d3d2a8c-6e59-4cf1-9fb1-d82b3e7aa4f0'::uuid as id,
        'Wire Google Ads keyword API'::text as title,
        'Stand up the Google Ads Keyword Plan integration so trend ingestion can hydrate the dashboard momentum tile.'::text as description,
        'Data Integrations'::text as owner,
        status_in_progress.id as status_id,
        (current_date - interval '2 days')::date as start_date,
        (current_date + interval '5 days')::date as due_date,
        'high'::text as priority,
        jsonb_build_object(
            'provider', 'google_ads',
            'deliverable', 'Streaming keyword volume + momentum payloads to Supabase',
            'dependencies', jsonb_build_array('service-account-setup', 'quota-validation')
        ) as metadata
    from public.backoffice_task_statuses status_in_progress
    where status_in_progress.name = 'In Progress'
    union all
    select
        '4f1b3c52-8ae7-4d75-8b7e-0efc2c4d86e8'::uuid,
        'Complete Etsy keyword ingestion API',
        'Finalize the Etsy keyword ingestion connector with pagination + auth guardrails for merchant telemetry.',
        'Data Integrations',
        status_in_progress.id,
        (current_date - interval '1 day')::date,
        (current_date + interval '7 days')::date,
        'high',
        jsonb_build_object(
            'provider', 'etsy',
            'deliverable', 'Fetch keyword search analytics for Etsy listings',
            'notes', 'Scraper stub exists; finish auth + response normalization'
        )
    from public.backoffice_task_statuses status_in_progress
    where status_in_progress.name = 'In Progress'
    union all
    select
        'a73434f6-2c27-4527-93d9-21bb5a6510f4'::uuid,
        'Kick off Pinterest trends API discovery',
        'Document Pinterest trends endpoints, auth, and rate limits before wiring ingestion jobs.',
        'Product Insights',
        status_todo.id,
        NULL,
        (current_date + interval '10 days')::date,
        'medium',
        jsonb_build_object(
            'provider', 'pinterest',
            'next_steps', jsonb_build_array('contact-partner-manager', 'collect-sample-payloads'),
            'ownerTeam', 'Product Research'
        )
    from public.backoffice_task_statuses status_todo
    where status_todo.name = 'To Do'
    union all
    select
        'b4ac19e6-2998-4ce2-96fb-585c9f87a01a'::uuid,
        'Stand up Reddit signal ingestion',
        'Plan Reddit API usage for keyword chatter monitoring and build the ingestion Lambda.',
        'Product Insights',
        status_todo.id,
        NULL,
        (current_date + interval '14 days')::date,
        'medium',
        jsonb_build_object(
            'provider', 'reddit',
            'next_steps', jsonb_build_array('register-app', 'define-subreddits', 'prototype-sentiment-pipeline'),
            'ownerTeam', 'Listening Squad'
        )
    from public.backoffice_task_statuses status_todo
    where status_todo.name = 'To Do'
) as upserts
on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    owner = excluded.owner,
    status_id = excluded.status_id,
    start_date = excluded.start_date,
    due_date = excluded.due_date,
    priority = excluded.priority,
    metadata = excluded.metadata,
    updated_at = now();

insert into public.risk_register_entries (
    id,
    title,
    summary,
    status,
    severity,
    likelihood,
    impact,
    owner,
    appetite_id,
    control_id,
    mitigation,
    follow_up,
    raised_by,
    raised_at,
    due_at,
    resolved_at,
    metadata,
    updated_at
)
values (
    'c0a4bf73-8f5d-4f44-8a8d-8f2d2f71808d',
    'Provider APIs missing blocks launch',
    'Backoffice launch is blocked until Google Ads, Etsy, Pinterest, and Reddit API connectors deliver keyword momentum feeds.',
    'open',
    'critical',
    'likely',
    'major',
    'Data Integrations',
    '519ce5f9-070a-41e6-b165-5471d6eff1e4',
    NULL,
    'Finish the four provider integrations, add smoke tests, and validate Supabase ingestion before GA.',
    'Report weekly on connector status and fail launch readiness reviews until data is flowing.',
    'system',
    now(),
    (current_date + interval '14 days')::timestamptz,
    NULL,
    jsonb_build_object(
        'providersPending', jsonb_build_array('google_ads', 'etsy', 'pinterest', 'reddit'),
        'launchDependency', true,
        'linkedTasks', jsonb_build_array(
            '6d3d2a8c-6e59-4cf1-9fb1-d82b3e7aa4f0',
            '4f1b3c52-8ae7-4d75-8b7e-0efc2c4d86e8',
            'a73434f6-2c27-4527-93d9-21bb5a6510f4',
            'b4ac19e6-2998-4ce2-96fb-585c9f87a01a'
        )
    ),
    now()
)
on conflict (id) do update set
    title = excluded.title,
    summary = excluded.summary,
    status = excluded.status,
    severity = excluded.severity,
    likelihood = excluded.likelihood,
    impact = excluded.impact,
    owner = excluded.owner,
    appetite_id = excluded.appetite_id,
    control_id = excluded.control_id,
    mitigation = excluded.mitigation,
    follow_up = excluded.follow_up,
    due_at = excluded.due_at,
    resolved_at = excluded.resolved_at,
    metadata = excluded.metadata,
    updated_at = now();

-- migrate:down
delete from public.risk_register_entries
where id = 'c0a4bf73-8f5d-4f44-8a8d-8f2d2f71808d';

delete from public.backoffice_tasks
where id in (
    '6d3d2a8c-6e59-4cf1-9fb1-d82b3e7aa4f0',
    '4f1b3c52-8ae7-4d75-8b7e-0efc2c4d86e8',
    'a73434f6-2c27-4527-93d9-21bb5a6510f4',
    'b4ac19e6-2998-4ce2-96fb-585c9f87a01a'
);
