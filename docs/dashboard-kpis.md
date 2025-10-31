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
