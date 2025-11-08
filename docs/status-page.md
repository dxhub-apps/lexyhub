# LexyHub Status Page

The status page provides a centralized, real-time view of the health of the LexyHub
platform. It is available in the application navigation under **Status** and can also be
queried programmatically through the `/api/status` endpoint. The page now mirrors the
compact look-and-feel of the core app, pairing the new typography scale with condensed
cards for quicker scanning.

## What the page reports

- **Runtime diagnostics** – Node.js version, hosting platform, uptime, and request
  region (when deployed to Vercel). Displayed as a compact card grid at the top of the
  page.
- **API surface** – Verifies that all shipped API handlers are registered and exported.
  Missing exports surface as warnings and module load failures appear as critical alerts.
- **Service integrations** – Confirms that Supabase credentials can open a server-side
  connection and performs a lightweight query against the `keywords` table. The OpenAI
  API check verifies that an API key is present on the server.
- **Background workers** – Validates that the automation endpoints (embedding backfill,
  trend aggregation, intent classification, and cluster rebuild) are exported and ready
  to run. These workers must be scheduled for trend and intent data to appear.
- **Configuration variables** – Still computed and returned from the API response, but
  intentionally omitted from the UI for a cleaner surface. Consumers that need these
  signals can continue to poll the JSON endpoint.

## Programmatic access

Clients may call `GET /api/status` to retrieve the status report as JSON. The payload is
identical to what drives the UI and is safe to poll for monitoring purposes.

```
GET /api/status
200 OK
{
  "generatedAt": "2024-06-16T18:24:14.301Z",
  "environment": "development",
  "runtime": {
    "node": "v20.12.2",
    "platform": "linux",
    "release": "6.5.0-1016-azure",
    "uptimeSeconds": 1245
  },
  "variables": [
    {
      "key": "OPENAI_API_KEY",
      "status": "warning",
      "preview": "not set"
    }
  ],
  "apis": [
    { "id": "listings-api", "status": "operational" },
    { "id": "trends-api", "status": "warning" }
  ],
  "services": [
    { "id": "database", "status": "warning" }
  ],
  "workers": [
    { "id": "trend-aggregation-worker", "status": "critical" }
  ]
}
```

The endpoint is marked as `force-dynamic` to ensure fresh data on every request. When
trend or intent data is missing, the corresponding APIs now return `503` errors with
guidance to configure provider keys and run the background workers against live data.

## Testing the endpoint contract

The integration suite (`tests/integration/api-status.test.ts`) exercises the endpoint to
ensure the runtime diagnostics include `runtime.node`, `runtime.platform`, and
`runtime.uptimeSeconds`, and to confirm that the API, service, and worker collections are
materialized as arrays of status objects. The suite also guards that the environment
variable summary enumerates the required keys so that regressions in the payload shape are
caught automatically.
