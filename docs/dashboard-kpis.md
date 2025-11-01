# Dashboard KPI Overview

The dashboard now highlights the usage signals that matter most to subscribers. Each KPI card blends the current tally with a short explanation and a progress bar so teams can act before hitting plan ceilings.

## KPI cards

| Card | What it shows | Why it matters |
| ---- | -------------- | -------------- |
| **Plan overview** | Current plan tier and momentum label, along with a reminder that momentum influences allowance replenishment. | Helps customer success teams explain why allowances may feel faster or slower to refresh. |
| **Daily keyword queries** | Count of keyword searches made today, the daily limit, and remaining queries. | Marketing and research teams can watch how close they are to exhausting search capacity. |
| **AI suggestions** | Number of AI tag suggestions generated today versus the limit, plus remaining suggestions. | Enables teams to budget assisted tagging output across campaigns. |
| **Watchlist additions** | Daily watchlist additions compared to the per-day capacity, including remaining spots. | Gives visibility into list hygiene and signals when to archive or upgrade. |

Each card uses color-coded progress states:

- **Positive (≤60%)** — ample headroom remains.
- **Caution (61–85%)** — limits are approaching, consider pausing or upgrading.
- **Critical (>85%)** — limits are nearly exhausted for the day.

The values refresh automatically from `/api/usage/summary`, ensuring KPIs stay in sync with Supabase usage events.

### Visual refinements

- KPI progress captions now render as inline indicators with luminous status dots instead of pill badges, which keeps the usage narrative readable while matching the simplified chrome.
- The fixed sidebar and topbar free the main canvas to stretch edge-to-edge with only subtle padding across the top and sides, giving KPI sections more room on dense dashboards.
- Shared pill treatments (environment and keyword tags) use soft gradients and halo glows so status cues pop without resorting to heavy card frames.

## PopTrade visual treatment

The dashboard container now follows the PopTrade-inspired 12-column card grid. The hero banner anchors the left eight columns with the “LexyHub Control Center” copy, while the right four columns summarize the active plan and quota rows. Downstream rows render four KPI cards in parallel on desktop, collapsing to two cards on medium screens and a single column on small screens. Area health and quick actions each live in their own cards, mirroring the trading terminal feel while keeping existing data bindings intact.

## Momentum & connectors

- The **Keyword momentum** analytics card spans two-thirds of the grid and provides the staging area for a real chart feed. Until live telemetry lands, a placeholder communicates that the card will render once marketplace data syncs.
- Connection management has moved to the **Settings → Connect your data sources** panel so operators can manage credentials alongside environment configuration. The dashboard now focuses solely on usage signals and quick actions.
- The **Operations status** table now lives on the settings page next to connection management, keeping health checks and connector readiness in the same workflow while the dashboard continues to surface "Next best actions".
