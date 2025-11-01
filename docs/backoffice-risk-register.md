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

The Supabase migration `0015_seed_risk_controls_and_register.sql` seeds each control with the real
operational posture captured at the close of Sprint 4 so the admin workspace has meaningful data
before the first sync runs.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L6-L126】

| ID | Control | Owner | Status signal |
| --- | --- | --- | --- |
| `f122a20a-1a42-4c76-ba28-4a38344a9534` | Crawler telemetry observability | Data Platform | Marks the control as `blocked`, `degraded`, or `warning` when crawler rows are missing, failing, or stale. |
| `4cdca7c9-3120-4a37-b240-883f5b945bb4` | Seed rotation pipeline | Marketplace Operations | Surfaces pending or stale keyword seeds that exceed the 12-hour freshness budget. |
| `a8e17080-7ef7-4357-a9ac-785579ab39a3` | AI integration readiness | AI Platform | Flags environments without the OpenAI credential so AI routes stay gated. |
| `2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2` | Marketplace sync monitoring | Partner Engineering | Highlights failing or stale provider syncs, disabled providers, and saturated watchlists. |
| `c91bf4e9-3f19-4a37-9c5f-8f4a15e25671` | Background job runbook | Platform Operations | Signals when scheduled jobs fail or haven't reported within the 12-hour freshness window. |
| `c64a9ba7-48f3-4708-b308-8b417be3f5ce` | API guardrails | Platform Operations | Monitors rolling API error rate and slow requests within the six-hour health window. |
| `9b4c9153-7f73-4e7c-a98f-5348f859dd5f` | Billing incident response | Finance Operations | Escalates outstanding invoices, webhook backlogs, and payment webhook errors. |

### Seeded control baseline

| Control | Owner | Status | Key seeded signals |
| --- | --- | --- | --- |
| Crawler telemetry observability | Data Platform | `blocked` | No crawler telemetry recorded yet (`telemetryMissing=true`, `staleThresholdHours=6`).【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L8-L23】 |
| Seed rotation pipeline | Marketplace Operations | `blocked` | Zero pending or stale seeds while the corpus still needs to be imported (`pendingSeeds=0`).【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L24-L38】【F:docs/background-jobs.md†L5-L24】 |
| AI integration readiness | AI Platform | `blocked` | `OPENAI_API_KEY` is not configured, so AI routes remain disabled until credentials land.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L39-L48】【F:docs/status-page.md†L22-L38】 |
| Marketplace sync monitoring | Partner Engineering | `blocked` | Etsy is the only enabled provider and no marketplace accounts have linked yet (`activeAccounts=0`).【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L49-L69】【F:docs/etsy-integration.md†L1-L44】 |
| Background job runbook | Platform Operations | `blocked` | No automation runs are stored yet; all jobs require scheduling before telemetry flows.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L70-L84】【F:docs/background-jobs.md†L1-L44】 |
| API guardrails | Platform Operations | `active` | Baseline reports show zero requests and zero errors inside the six-hour window.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L85-L100】 |
| Billing incident response | Finance Operations | `active` | No invoices or webhook backlog exist yet (`outstandingInvoices=0`).【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L101-L116】 |

These seed values mirror the current delivery reality: ingestion and automation paths still rely on
manual execution while connectors and credentials are being finalized, whereas API and billing
guardrails already have the necessary wiring in place.【F:docs/background-jobs.md†L1-L44】【F:docs/etsy-integration.md†L1-L60】

## Initial risk register snapshot

The same migration seeds the seven managed risk entries so the backoffice dashboard opens with the
authentic posture from Supabase, matching the logic used by the `syncRiskDataFromState` routine.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L128-L335】【F:src/lib/risk/state-sync.ts†L993-L1214】

| Risk | Status | Severity / Likelihood | Due / Resolved | Seeded summary |
| --- | --- | --- | --- | --- |
| Crawler telemetry gaps | `open` | `high` / `likely` | Due in 1 day | No crawler telemetry has been recorded; operations must bootstrap the scrapers.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L149-L175】 |
| Keyword corpus coverage | `open` | `high` / `likely` | Due in 1 day | Corpus still empty (0 keywords, 0 markets) so seed rotation has to run immediately.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L176-L206】 |
| AI integration configuration | `open` | `medium` / `likely` | Due in 2 days | `OPENAI_API_KEY` absent keeps generative workflows offline until credentials are applied.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L207-L225】【F:docs/status-page.md†L22-L38】 |
| Marketplace sync degradation | `open` | `high` / `likely` | Due in 2 days | No seller accounts have linked to the single enabled provider; ingestion jobs have never run.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L226-L257】【F:docs/etsy-integration.md†L1-L44】 |
| Background job backlog | `open` | `high` / `likely` | Due in 1 day | Trend, intent, cluster, and embedding jobs have zero recorded runs and must be scheduled.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L258-L282】【F:docs/background-jobs.md†L1-L44】 |
| API error rate spike | `closed` | `low` / `unlikely` | Resolved now | Baseline error rate is 0% across 0 requests, so the incident stays closed unless telemetry changes.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L283-L308】 |
| Billing and webhook exceptions | `closed` | `low` / `unlikely` | Resolved now | No invoices or webhook backlog exist, keeping the finance posture green by default.【F:supabase/migrations/0015_seed_risk_controls_and_register.sql†L309-L335】 |

### Automated register entries

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
