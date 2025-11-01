-- ===========================================
-- 0015_seed_risk_controls_and_register.sql
-- ===========================================
-- migrate:up

insert into public.risk_controls (id, name, description, owner, status, coverage_area, metadata, updated_at)
values
  (
    'f122a20a-1a42-4c76-ba28-4a38344a9534',
    'Crawler telemetry observability',
    'Monitors crawler_statuses for failures and stale telemetry windows.',
    'Data Platform',
    'blocked',
    'Crawler ingestion',
    jsonb_build_object(
      'failingSources', jsonb_build_array(),
      'staleSources', jsonb_build_array(),
      'telemetryMissing', true,
      'staleThresholdHours', 6,
      'mostRecentRun', NULL
    ),
    now()
  ),
  (
    '4cdca7c9-3120-4a37-b240-883f5b945bb4',
    'Seed rotation pipeline',
    'Schedules keyword seed refresh jobs and tracks pending backlog.',
    'Marketplace Operations',
    'blocked',
    'Keyword ingestion',
    jsonb_build_object(
      'pendingSeeds', 0,
      'staleSeedTerms', jsonb_build_array(),
      'staleSeedThresholdHours', 12,
      'oldestPendingSeedAt', NULL
    ),
    now()
  ),
  (
    'a8e17080-7ef7-4357-a9ac-785579ab39a3',
    'AI integration readiness',
    'Validates AI credentials and toggles workflow availability.',
    'AI Platform',
    'blocked',
    'AI platform',
    jsonb_build_object('openAIConfigured', false),
    now()
  ),
  (
    '2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2',
    'Marketplace sync monitoring',
    'Watches marketplace accounts and sync jobs for failures or stale runs.',
    'Partner Engineering',
    'blocked',
    'Marketplace integrations',
    jsonb_build_object(
      'enabledProviders', 1,
      'providerCount', 1,
      'activeAccounts', 0,
      'accountCount', 0,
      'failingSyncs', jsonb_build_array(),
      'staleSyncs', jsonb_build_array(),
      'suspendedAccounts', jsonb_build_array(),
      'disabledProviders', jsonb_build_array(),
      'latestSyncAt', NULL,
      'watchlistUtilization', 0
    ),
    now()
  ),
  (
    'c91bf4e9-3f19-4a37-9c5f-8f4a15e25671',
    'Background job runbook',
    'Tracks background job executions and flags failures or stale runs.',
    'Platform Operations',
    'blocked',
    'Automation',
    jsonb_build_object(
      'failingJobs', jsonb_build_array(),
      'staleJobs', jsonb_build_array(),
      'jobCount', 0,
      'jobStaleThresholdHours', 12
    ),
    now()
  ),
  (
    'c64a9ba7-48f3-4708-b308-8b417be3f5ce',
    'API guardrails',
    'Monitors rolling API error rate and slow requests within the six-hour health window.',
    'Platform Operations',
    'active',
    'API platform',
    jsonb_build_object(
      'totalApiRequests', 0,
      'apiErrorRate', 0,
      'errorCount', 0,
      'slowRequests', 0,
      'windowHours', 6
    ),
    now()
  ),
  (
    '9b4c9153-7f73-4e7c-a98f-5348f859dd5f',
    'Billing incident response',
    'Escalates outstanding invoices, webhook backlogs, and payment exceptions.',
    'Finance Operations',
    'active',
    'Billing',
    jsonb_build_object(
      'outstandingInvoices', 0,
      'outstandingTotalCents', 0,
      'oldestOutstandingAt', NULL,
      'webhookBacklog', 0,
      'staleWebhookEvents', 0,
      'erroredWebhooks', 0
    ),
    now()
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  owner = excluded.owner,
  status = excluded.status,
  coverage_area = excluded.coverage_area,
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
values
  (
    '01c8f68d-0ecb-451e-a19a-e26eb97d9803',
    'Crawler telemetry gaps',
    'No crawler telemetry has been recorded yet.',
    'open',
    'high',
    'likely',
    'major',
    'Data Platform',
    'b9effbf9-9dc7-469c-bda2-da2ecebd2e4f',
    'f122a20a-1a42-4c76-ba28-4a38344a9534',
    'Re-run failing crawler jobs, inspect error payloads, and ensure telemetry webhooks are delivering updates.',
    'Verify each crawler\'s scheduling metadata after remediation and capture a post-mortem summary.',
    'system',
    now(),
    now() + interval '1 day',
    NULL,
    jsonb_build_object(
      'failingSources', jsonb_build_array(),
      'staleSources', jsonb_build_array(),
      'telemetryMissing', true,
      'totalSources', jsonb_build_array(),
      'staleThresholdHours', 6,
      'mostRecentRun', NULL
    ),
    now()
  ),
  (
    '11c85cf4-f0a3-4357-a521-cbfbb4170ba9',
    'Keyword corpus coverage',
    'Corpus contains 0 keywords across 0 markets (target 200). 0 seeds pending, 0 stale beyond 12h.',
    'open',
    'high',
    'likely',
    'major',
    'Product Insights',
    '519ce5f9-070a-41e6-b165-5471d6eff1e4',
    '4cdca7c9-3120-4a37-b240-883f5b945bb4',
    'Run the seed rotation job, prioritize stale terms, and backfill missing keyword records for high-priority markets.',
    'Audit the seed backlog after refresh, confirm coverage against the corpus target, and document remaining gaps.',
    'system',
    now(),
    now() + interval '1 day',
    NULL,
    jsonb_build_object(
      'keywordCount', 0,
      'keywordTarget', 200,
      'uniqueMarkets', 0,
      'pendingSeeds', 0,
      'staleSeedCount', 0,
      'staleSeedTerms', jsonb_build_array(),
      'staleSeedThresholdHours', 12,
      'oldestPendingSeedAt', NULL,
      'latestKeywordAt', NULL,
      'hoursSinceKeywordUpdate', NULL
    ),
    now()
  ),
  (
    'a7a3f46c-587d-443a-af7e-49222ee23d91',
    'AI integration configuration',
    'OPENAI_API_KEY is not configured; generative workflows and AI scoring remain disabled.',
    'open',
    'medium',
    'likely',
    'moderate',
    'AI Platform',
    'f03569e9-a809-4b3c-be09-6cea0ec8f1d1',
    'a8e17080-7ef7-4357-a9ac-785579ab39a3',
    'Provision the OpenAI API key in the runtime environment and re-run smoke tests.',
    'Document the credential rotation policy and verify model availability after the key is applied.',
    'system',
    now(),
    now() + interval '2 day',
    NULL,
    jsonb_build_object('openAIConfigured', false, 'required', true),
    now()
  ),
  (
    '73ddc3ab-725f-4a46-9b18-9a63a1bfb35c',
    'Marketplace sync degradation',
    '0/0 marketplace accounts active; 1/1 providers enabled. No sync runs recorded; link an Etsy shop and schedule the ingestion jobs.',
    'open',
    'high',
    'likely',
    'major',
    'Partner Engineering',
    '99c16f8f-4aa5-4e03-b19b-2d604c7d8b3a',
    '2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2',
    'Audit failing sync jobs, re-authorize suspended accounts, and coordinate provider enablement.',
    'Confirm sync jobs resume within the freshness window and update integration runbooks.',
    'system',
    now(),
    now() + interval '2 day',
    NULL,
    jsonb_build_object(
      'activeAccounts', 0,
      'accountCount', 0,
      'enabledProviders', 1,
      'providerCount', 1,
      'failingSyncs', jsonb_build_array(),
      'staleSyncs', jsonb_build_array(),
      'suspendedAccounts', jsonb_build_array(),
      'disabledProviders', jsonb_build_array(),
      'latestSyncAt', NULL,
      'watchlistUtilization', 0
    ),
    now()
  ),
  (
    'c7b9c9df-f8b4-4c3e-94cf-62e5d108f7b6',
    'Background job backlog',
    'No job executions recorded yet. Trend, intent, cluster, and embedding workers must be scheduled.',
    'open',
    'high',
    'likely',
    'major',
    'Platform Operations',
    'cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4',
    'c91bf4e9-3f19-4a37-9c5f-8f4a15e25671',
    'Investigate job logs, replay failed runs, and ensure schedules are restored.',
    'Document remediation, capture error context, and validate downstream data completeness.',
    'system',
    now(),
    now() + interval '1 day',
    NULL,
    jsonb_build_object(
      'failingJobs', jsonb_build_array(),
      'staleJobs', jsonb_build_array(),
      'jobCount', 0,
      'jobStaleThresholdHours', 12
    ),
    now()
  ),
  (
    '65c0de81-388b-46d2-867b-9de91c796c8e',
    'API error rate spike',
    'API error rate 0% over 0 requests.',
    'closed',
    'low',
    'unlikely',
    'minor',
    'Platform Operations',
    'cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4',
    'c64a9ba7-48f3-4708-b308-8b417be3f5ce',
    'Inspect failing API routes, roll back breaking changes, and add regression tests.',
    'Publish a post-incident summary with error rates and confirm latency has normalized.',
    'system',
    now(),
    NULL,
    now(),
    jsonb_build_object(
      'totalApiRequests', 0,
      'apiErrorRate', 0,
      'errorCount', 0,
      'slowRequests', 0,
      'windowHours', 6
    ),
    now()
  ),
  (
    '870280c0-9918-4a75-9e35-8e8cf0a3fde9',
    'Billing and webhook exceptions',
    '0 invoices outstanding totaling 0 cents (oldest no invoice date). Webhook backlog 0 (0 stale, 0 errors).',
    'closed',
    'low',
    'unlikely',
    'minor',
    'Finance Operations',
    '03b6f0dc-8d1a-4ee5-9f7f-f9fb00aabf8c',
    '9b4c9153-7f73-4e7c-a98f-5348f859dd5f',
    'Settle outstanding invoices, replay webhook deliveries, and coordinate with providers on failures.',
    'Reconcile invoice ledger after remediation and confirm webhook queue is empty.',
    'system',
    now(),
    NULL,
    now(),
    jsonb_build_object(
      'outstandingInvoices', 0,
      'outstandingTotalCents', 0,
      'oldestOutstandingAt', NULL,
      'webhookBacklog', 0,
      'staleWebhookEvents', 0,
      'erroredWebhooks', 0
    ),
    now()
  )
on conflict (id) do update
set
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
  raised_by = excluded.raised_by,
  raised_at = excluded.raised_at,
  due_at = excluded.due_at,
  resolved_at = excluded.resolved_at,
  metadata = excluded.metadata,
  updated_at = now();

-- migrate:down

delete from public.risk_register_entries
where id in (
  '01c8f68d-0ecb-451e-a19a-e26eb97d9803',
  '11c85cf4-f0a3-4357-a521-cbfbb4170ba9',
  'a7a3f46c-587d-443a-af7e-49222ee23d91',
  '73ddc3ab-725f-4a46-9b18-9a63a1bfb35c',
  'c7b9c9df-f8b4-4c3e-94cf-62e5d108f7b6',
  '65c0de81-388b-46d2-867b-9de91c796c8e',
  '870280c0-9918-4a75-9e35-8e8cf0a3fde9'
);

delete from public.risk_controls
where id in (
  'f122a20a-1a42-4c76-ba28-4a38344a9534',
  '4cdca7c9-3120-4a37-b240-883f5b945bb4',
  'a8e17080-7ef7-4357-a9ac-785579ab39a3',
  '2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2',
  'c91bf4e9-3f19-4a37-9c5f-8f4a15e25671',
  'c64a9ba7-48f3-4708-b308-8b417be3f5ce',
  '9b4c9153-7f73-4e7c-a98f-5348f859dd5f'
);
