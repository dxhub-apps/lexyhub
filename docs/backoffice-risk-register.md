# Backoffice Risk Register Reference

The risk management workspace now mirrors the actual operational state captured in Supabase. Rather than
showing placeholder rows, we derive appetites, controls, metrics, and register entries from live telemetry
(crawler runs, keyword corpus health, and integration checks).

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

| ID | Label | Category | Owner | Notes |
| --- | --- | --- | --- | --- |
| `b9effbf9-9dc7-469c-bda2-da2ecebd2e4f` | Data pipeline reliability | Operations | Platform Operations | Tracks failing or stale crawler sources against the 6-hour telemetry SLO. |
| `519ce5f9-070a-41e6-b165-5471d6eff1e4` | Market intelligence coverage | Product | Product Insights | Ensures at least 200 keywords across markets with no more than five pending/stale seeds. |
| `f03569e9-a809-4b3c-be09-6cea0ec8f1d1` | AI readiness | AI Platform | AI Platform | Requires a configured `OPENAI_API_KEY` before enabling generative workflows. |

## Risk controls

| ID | Control | Owner | Status signal |
| --- | --- | --- | --- |
| `f122a20a-1a42-4c76-ba28-4a38344a9534` | Crawler telemetry observability | Data Platform | Marks the control as `blocked`, `degraded`, or `warning` when crawler rows are missing, failing, or stale. |
| `4cdca7c9-3120-4a37-b240-883f5b945bb4` | Seed rotation pipeline | Marketplace Operations | Surfaces pending or stale keyword seeds that exceed the 12-hour freshness budget. |
| `a8e17080-7ef7-4357-a9ac-785579ab39a3` | AI integration readiness | AI Platform | Flags environments without the OpenAI credential so AI routes stay gated. |

## Automated register entries

Every sync evaluates the current telemetry and updates three managed risks:

- **Crawler telemetry gaps** (`01c8f68d-0ecb-451e-a19a-e26eb97d9803`) – Opens when crawler sources fail, stop
  reporting within six hours, or when no telemetry has been captured yet. Metadata lists the affected sources
  so the data platform team can re-run the jobs.
- **Keyword corpus coverage** (`11c85cf4-f0a3-4357-a521-cbfbb4170ba9`) – Triggers when the Supabase corpus
  holds fewer than 200 keywords, or when the seed backlog contains stale entries. The risk metadata includes
  the pending/stale counts, the oldest pending timestamp, and the most recent keyword refresh time.
- **AI integration configuration** (`a7a3f46c-587d-443a-af7e-49222ee23d91`) – Stays open until
  `OPENAI_API_KEY` is set in the environment so AI workflows can execute.

Because the register is driven by Supabase, the backoffice dashboard metrics (total, open, mitigated, and
overdue) now reflect the genuine operational posture rather than demo scenarios.
