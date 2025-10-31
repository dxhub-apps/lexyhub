# Background Jobs Operations Guide

LexyHub ships a collection of background automation endpoints that hydrate dashboards, keyword metrics, and market intelligence. This guide explains how to run each job manually and how to automate execution with the provided GitHub Actions workflow.

## Available job endpoints

| Endpoint | Purpose | Typical cadence |
| --- | --- | --- |
| `POST /api/jobs/trend-aggregation` | Aggregates external and synthetic trend signals into `trend_series` and updates `keywords.trend_momentum`. | Every 6 hours |
| `POST /api/jobs/intent-classify` | Classifies keywords and listings into purchase intent categories for targeting workflows. | Daily |
| `POST /api/jobs/rebuild-clusters` | Recomputes semantic clusters so that related keywords stay grouped as new data arrives. | Daily |
| `POST /api/jobs/embed-missing` | Generates 3,072-dimensional vector embeddings (using `text-embedding-3-large`) for keywords or listings that do not yet have embeddings stored. | Hourly |

The Etsy sync job is temporarily disabled in automation until the upstream API contract is finalized. You can still invoke it manually while testing the integration.

All active endpoints live inside the Next.js application and rely on the Supabase service role credentials configured in the deployment. Requests should be authenticated via an internal bearer token or a restricted network path (e.g., Vercel cron jobs).

## Running jobs manually

Use `curl` (or an HTTP client of your choice) to invoke a job endpoint. The example below triggers the trend aggregation worker and passes an internal bearer token for authorization.

```bash
APP_BASE_URL="https://your.lexyhub.domain"
SERVICE_TOKEN="<internal-bearer-token>"

curl -X POST "${APP_BASE_URL}/api/jobs/trend-aggregation" \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  -H "Content-Type: application/json"
```

The JSON response includes either a success payload (`processed`, `keywordsUpdated`, etc.) or an `error` field describing what failed. Repeat the request for each job you want to run.

## Automating with GitHub Actions

This repository now includes `.github/workflows/background-jobs.yml`, a reusable workflow that can run every automation endpoint on a schedule or on demand.

### Secrets required

Create the following repository secrets so the workflow can reach your deployment:

- `LEXYHUB_APP_URL` – The fully qualified base URL of the deployed LexyHub application (e.g., `https://app.lexyhub.ai`).
- `LEXYHUB_SERVICE_TOKEN` – A bearer token recognized by your API routes (the workflow sends it in the `Authorization` header).

### Triggering the workflow

The workflow supports two triggers:

- **Scheduled runs:** By default it executes nightly at 03:30 UTC. Adjust the cron expression in `background-jobs.yml` to match your cadence.
- **Manual runs:** Use the *Run workflow* button in the GitHub Actions tab to launch all jobs immediately.

### What the workflow does

1. Iterates through the list of job endpoints (`trend-aggregation`, `intent-classify`, `rebuild-clusters`, `embed-missing`).
2. Posts to each `/api/jobs/{endpoint}` URL with the configured secrets.
3. Captures the HTTP status code and response body for auditing and uploads them as an artifact named `background-job-logs`.
4. Fails the workflow if any endpoint returns a non-2xx response so the team is alerted in GitHub.

### Customizing the job list

Edit the `JOB_ENDPOINTS` environment variable inside `background-jobs.yml` if you want to add, remove, or reorder tasks. Each endpoint should be the path segment that follows `/api/jobs/`. Re-introduce `etsy-sync` here once the production API is ready to accept automated traffic again.

## Troubleshooting

- **401 Unauthorized:** Confirm the `LEXYHUB_SERVICE_TOKEN` secret matches the token expected by your deployment and that the API routes validate the header.
- **5xx response:** Inspect the uploaded artifact for the error payload. Run the endpoint locally with `npm run dev` and the same HTTP request to reproduce.
- **Supabase credential errors:** Ensure the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured in your hosting platform; the jobs rely on the service role.

Keep this guide close to your runbooks so that on-call engineers can restore background automation quickly.
