# LexyHub Status Page

The status page provides a centralized, real-time view of the health of the LexyHub
platform. It is available in the application navigation under **Status** and can also be
queried programmatically through the `/api/status` endpoint.

## What the page reports

- **Runtime diagnostics** – Node.js version, hosting platform, uptime, and request
  region (when deployed to Vercel).
- **Environment variables** – Presence and confidence level for the core configuration
  variables. Sensitive keys are masked and defaults (for example
  `LEXYHUB_JWT_SECRET=change-me-change-me`) are highlighted as warnings.
- **API surface** – Verifies that all shipped API handlers are registered and exported.
  Missing exports surface as warnings and module load failures appear as critical alerts.
- **Service integrations** – Confirms that Supabase credentials can open a server-side
  connection and performs a lightweight query against the `keywords` table. The OpenAI
  API check verifies that an API key is present on the server.

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
    { "id": "listings-api", "status": "operational" }
  ],
  "services": [
    { "id": "database", "status": "warning" }
  ]
}
```

The endpoint is marked as `force-dynamic` to ensure fresh data on every request.
