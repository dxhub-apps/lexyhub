# LexyHub Browser Extension

The browser extension captures Etsy keyword activity and forwards events to the LexyHub API.

## Prerequisites

Set the following environment variables before building:

- `BROWSER_EXTENSION_API_BASE_URL` – Base URL for the LexyHub API (for example `https://app.lexyhub.com`).
- `BROWSER_EXTENSION_ALLOW_USER_TELEMETRY_DEFAULT` – Optional flag (`true`/`false`) that controls whether telemetry is enabled when the user has not made an explicit choice.

## Building the bundle

Run the extension build script from the repository root:

```bash
npm run extension:build
```

The script copies the manifest and scripts into `apps/browser-extension/dist/`, writes a `config.json` file sourced from the environment, and produces a distributable ZIP at `apps/browser-extension/build/lexyhub-browser-extension.zip`.

## Publishing

1. Upload the generated ZIP file to the Chrome Web Store (and any additional browsers you support).
2. When submitting updates, increment the `version` field in `apps/browser-extension/manifest.json` and rerun the build script.
3. Share the install link with users. Once the extension is installed, the LexyHub web app can communicate with it via `window.postMessage` on the `lexyhub-extension` channel.

## Event capture flow

- The content script listens on both `https://app.lexyhub.com/*` and `https://www.etsy.com/*`.
- Telemetry events detected on Etsy are forwarded to the background service worker, which sends authenticated POST requests to `/api/keyword-events` using the token provided by the LexyHub web app.
- The background worker honours the `allow_user_telemetry` preference stored in the user's profile and the default configured via environment variables.
