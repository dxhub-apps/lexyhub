# Backoffice Risk Register Reference

The risk management workspace now mirrors the actual operational state captured in Supabase. Rather than
showing placeholder rows, we derive appetites, controls, metrics, and register entries from live telemetry
(crawler runs, keyword corpus health, integrations, background jobs, API health, and billing compliance).

> **Need structured delivery tracking?** See `docs/backoffice-task-tracker.md` for the complementary Jira-style
> task workspace and schema introduced alongside this risk tooling.

## Synchronizing from Supabase

Run the admin-only sync endpoint whenever you want to refresh the backoffice dataset from the current
application state:

```bash
curl -X POST \
  -H "x-user-role: admin" \
  https://<your-app-host>/api/admin/backoffice/risk-sync
```

The endpoint recalculates health metrics, upserts the canonical risk appetites and controls, and then
updates the register entries so the dashboard reflects real incidents (missing crawler telemetry, stale
keyword seeds, or missing AI credentials).

## Risk appetites

The Supabase migration `0014_seed_risk_appetites.sql` seeds the canonical appetite statements so a fresh environment starts with the correct baseline.

| ID | Label | Category | Owner | Notes |
| --- | --- | --- | --- | --- |
| `b9effbf9-9dc7-469c-bda2-da2ecebd2e4f` | Data pipeline reliability | Operations | Platform Operations | Tracks failing or stale crawler sources against the 6-hour telemetry SLO. |
| `519ce5f9-070a-41e6-b165-5471d6eff1e4` | Market intelligence coverage | Product | Product Insights | Ensures at least 200 keywords across markets with no more than five pending/stale seeds. |
| `f03569e9-a809-4b3c-be09-6cea0ec8f1d1` | AI readiness | AI Platform | AI Platform | Requires a configured `OPENAI_API_KEY` before enabling generative workflows. |
| `99c16f8f-4aa5-4e03-b19b-2d604c7d8b3a` | Marketplace integration resilience | Partner Engineering | Partner Engineering | Watches account connectivity, provider enablement, and sync freshness. |
| `cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4` | Automation uptime | Operations | Platform Operations | Governs background job health and API error/latency tolerances. |
| `03b6f0dc-8d1a-4ee5-9f7f-f9fb00aabf8c` | Billing and compliance | Finance | Finance Operations | Caps outstanding invoice exposure and webhook processing lag. |

## Risk controls

| ID | Control | Owner | Status signal |
| --- | --- | --- | --- |
| `f122a20a-1a42-4c76-ba28-4a38344a9534` | Crawler telemetry observability | Data Platform | Marks the control as `blocked`, `degraded`, or `warning` when crawler rows are missing, failing, or stale. |
| `4cdca7c9-3120-4a37-b240-883f5b945bb4` | Seed rotation pipeline | Marketplace Operations | Surfaces pending or stale keyword seeds that exceed the 12-hour freshness budget. |
| `a8e17080-7ef7-4357-a9ac-785579ab39a3` | AI integration readiness | AI Platform | Flags environments without the OpenAI credential so AI routes stay gated. |
| `2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2` | Marketplace sync monitoring | Partner Engineering | Highlights failing or stale provider syncs, disabled providers, and saturated watchlists. |
| `c91bf4e9-3f19-4a37-9c5f-8f4a15e25671` | Background job runbook | Platform Operations | Signals when scheduled jobs fail or haven't reported within the 12-hour freshness window. |
| `c64a9ba7-48f3-4708-b308-8b417be3f5ce` | API guardrails | Platform Operations | Monitors rolling API error rate and slow requests within the six-hour health window. |
| `9b4c9153-7f73-4e7c-a98f-5348f859dd5f` | Billing incident response | Finance Operations | Escalates outstanding invoices, webhook backlogs, and payment webhook errors. |

## Automated register entries

Every sync evaluates the current telemetry and updates the managed risks:

- **Crawler telemetry gaps** (`01c8f68d-0ecb-451e-a19a-e26eb97d9803`) – Opens when crawler sources fail, stop
  reporting within six hours, or when no telemetry has been captured yet. Metadata lists the affected sources
  so the data platform team can re-run the jobs.
- **Keyword corpus coverage** (`11c85cf4-f0a3-4357-a521-cbfbb4170ba9`) – Triggers when the Supabase corpus
  holds fewer than 200 keywords, or when the seed backlog contains stale entries. The risk metadata includes
  the pending/stale counts, the oldest pending timestamp, and the most recent keyword refresh time.
- **AI integration configuration** (`a7a3f46c-587d-443a-af7e-49222ee23d91`) – Stays open until
  `OPENAI_API_KEY` is set in the environment so AI workflows can execute.
- **Marketplace sync degradation** (`73ddc3ab-725f-4a46-9b18-9a63a1bfb35c`) – Fires when marketplace accounts
  are disconnected, provider sync jobs fail or age past 12 hours, or when integrations are disabled.
- **Background job backlog** (`c7b9c9df-f8b4-4c3e-94cf-62e5d108f7b6`) – Tracks failing or overdue background
  jobs so automation SLOs stay intact.
- **API error rate spike** (`65c0de81-388b-46d2-867b-9de91c796c8e`) – Watches the rolling six-hour API error
  rate and escalates when failures or slow requests exceed thresholds.
- **Billing and webhook exceptions** (`870280c0-9918-4a75-9e35-8e8cf0a3fde9`) – Opens when invoices exceed the
  warning threshold or payment/webhook queues accumulate stale or errored events.

Because the register is driven by Supabase, the backoffice dashboard metrics (total, open, mitigated, and
overdue) and the new likelihood/severity heat map now reflect the genuine operational posture rather than
demo scenarios.

## Heat map overlay

The Backoffice overview page renders a severity vs. likelihood matrix that counts open risks per bucket.
Hover any cell to see the titles contributing to that count. The grid is populated directly from the
`risk_register_entries` table so it always reflects the current operational posture after a sync.
