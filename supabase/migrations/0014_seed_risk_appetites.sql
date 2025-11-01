-- ===========================================
-- 0014_seed_risk_appetites.sql
-- ===========================================
-- migrate:up
insert into public.risk_appetites (id, label, category, appetite_level, owner, tolerance, notes)
values
  (
    'b9effbf9-9dc7-469c-bda2-da2ecebd2e4f',
    'Data pipeline reliability',
    'Operations',
    'conservative',
    'Platform Operations',
    jsonb_build_object(
      'maxFailingCrawlers', 0,
      'staleThresholdHours', 6
    ),
    'Tracks failing or stale crawler sources against the 6-hour telemetry SLO.'
  ),
  (
    '519ce5f9-070a-41e6-b165-5471d6eff1e4',
    'Market intelligence coverage',
    'Product',
    'balanced',
    'Product Insights',
    jsonb_build_object(
      'minimumKeywordCorpus', 200,
      'maximumPendingSeeds', 5,
      'staleSeedThresholdHours', 12
    ),
    'Ensures at least 200 keywords across markets with limited pending or stale seeds.'
  ),
  (
    'f03569e9-a809-4b3c-be09-6cea0ec8f1d1',
    'AI readiness',
    'AI Platform',
    'balanced',
    'AI Platform',
    jsonb_build_object(
      'requireOpenAIKey', true
    ),
    'Requires a configured OPENAI_API_KEY before enabling generative workflows.'
  ),
  (
    '99c16f8f-4aa5-4e03-b19b-2d604c7d8b3a',
    'Marketplace integration resilience',
    'Partner Engineering',
    'balanced',
    'Partner Engineering',
    jsonb_build_object(
      'minimumActiveAccounts', 1,
      'maximumFailingSyncs', 0,
      'maximumStaleSyncs', 0
    ),
    'Watches account connectivity, provider enablement, and sync freshness.'
  ),
  (
    'cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4',
    'Automation uptime',
    'Operations',
    'balanced',
    'Platform Operations',
    jsonb_build_object(
      'maximumFailingJobs', 0,
      'maximumStaleJobs', 0,
      'jobFreshnessHours', 12
    ),
    'Governs background job health and API error or latency tolerances.'
  ),
  (
    '03b6f0dc-8d1a-4ee5-9f7f-f9fb00aabf8c',
    'Billing and compliance',
    'Finance',
    'balanced',
    'Finance Operations',
    jsonb_build_object(
      'maximumOutstandingCents', 10000,
      'maximumWebhookBacklog', 0,
      'webhookStaleMinutes', 45
    ),
    'Caps outstanding invoice exposure and webhook processing lag.'
  )
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  appetite_level = excluded.appetite_level,
  owner = excluded.owner,
  tolerance = excluded.tolerance,
  notes = excluded.notes,
  updated_at = now();

-- migrate:down
delete from public.risk_appetites
where id in (
  'b9effbf9-9dc7-469c-bda2-da2ecebd2e4f',
  '519ce5f9-070a-41e6-b165-5471d6eff1e4',
  'f03569e9-a809-4b3c-be09-6cea0ec8f1d1',
  '99c16f8f-4aa5-4e03-b19b-2d604c7d8b3a',
  'cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4',
  '03b6f0dc-8d1a-4ee5-9f7f-f9fb00aabf8c'
);
