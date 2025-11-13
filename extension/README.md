# LexyHub Browser Extension

Free cross-browser extension for keyword research on e-commerce marketplaces.

## Features

- 🔍 **Keyword Capture**: One-click "Add to Watchlist" or "Send to Brief"
- ✨ **On-Page Highlights**: Visual highlights for watchlisted keywords
- 📊 **Live Metrics**: Hover tooltips showing demand, competition, AI score, and trends
- 🎯 **Multi-Platform**: Supports Etsy, Amazon, Shopify, and more
- ⚡ **Extension Boost**: Enhanced free tier quotas for extension users

## Supported Domains (v1)

- **Etsy**: `https://www.etsy.com/*`
- **Amazon**: `https://www.amazon.*/*`
- **Shopify**: `https://*/collections/*`, `https://*/products/*`, `https://*/search*`
- **Google**: `https://www.google.com/search*` (optional)
- **Pinterest**: `https://www.pinterest.*/*` (optional)
- **Reddit**: `https://www.reddit.com/*` (optional)

## Architecture

### Manifest V3 Components

- **Background Service Worker**: Authentication, API batching, storage, remote config
- **Content Scripts**: Domain-specific parsers, highlight engine, tooltips
- **Popup**: Quick access to Discover, Session, Briefs, Settings
- **Options Page**: Advanced settings, privacy controls

### API Endpoints

All extension endpoints are prefixed with `/api/ext/`:

- `POST /ext/watchlist/add` - Add keyword to watchlist
- `GET /ext/watchlist` - Fetch user's watchlist
- `POST /ext/metrics/batch` - Get metrics for multiple keywords
- `POST /ext/brief` - Create keyword brief
- `POST /ext/capture` - Capture analytics events (optional)
- `GET /ext/remote-config` - Remote kill-switch + feature flags consumed by the extension

### Authentication Flow

- The browser action "Connect LexyHub" button now opens `https://app.lexyhub.com/auth/extension`, which is the only page that issues extension-scoped tokens.
- After the user finishes signing in, the page stores `lexyhub_ext_token` and `lexyhub_ext_user` in `localStorage` and broadcasts a `LEXYHUB_AUTH_SUCCESS` message. The background service worker polls for those values and persists them to `chrome.storage.sync`.
- Existing installations that are still pointing at `/api/ext/config` are supported through `/api/ext/config` → `/api/ext/remote-config` forwarding, but new builds fetch `GET /api/ext/remote-config` directly and gracefully handle either response shape (`{ ... }` or `{ config: ... }`).

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd extension
npm install
```

### Build

```bash
# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Build for Safari
npm run build:safari

# Build all browsers
npm run build
```

Output: `extension/dist/{chrome|firefox|safari}/`

### Watch Mode

```bash
npm run watch
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Installation

### Chrome/Edge

1. Build the extension: `npm run build:chrome`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `extension/dist/chrome/`

### Firefox

1. Build the extension: `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `extension/dist/firefox/manifest.json`

## Database Schema

### Extension-Specific Tables

```sql
-- User watchlist terms (raw, not FK to keywords)
CREATE TABLE user_watchlist_terms (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  term TEXT NOT NULL,
  market TEXT NOT NULL,
  normalized_term TEXT GENERATED,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, market, normalized_term)
);

-- Upsert queue for golden source
CREATE TABLE ext_watchlist_upsert_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  market TEXT NOT NULL,
  term TEXT NOT NULL,
  normalized_term TEXT GENERATED,
  source_url TEXT,
  enqueued_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Extension boost entitlements
CREATE TABLE plan_entitlements_extension (
  plan_code TEXT PRIMARY KEY,
  searches_per_month INT NOT NULL,
  niches_max INT NOT NULL,
  ai_opportunities_per_month INT NOT NULL
);
```

## Background Worker

The golden-source upsert worker runs periodically to process the queue:

```bash
# Trigger manually via API
curl -X POST https://app.lexyhub.com/api/jobs/ext-watchlist-upsert \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

## Extension Boost

Authenticated free-tier users get boosted entitlements:

| Quota | Standard Free | Extension Boost |
|-------|---------------|-----------------|
| Searches/month | 10 | 25 |
| Niches | 1 | 3 |
| AI Opportunities | 2 | 8 |

## Security & Privacy

- Only operates on allowed domains
- Does not capture PII or page content
- Only sends extracted terms and metadata
- Rate-limited API calls
- Remote kill-switch for emergency shutdowns

## Testing

### QA Checklist

See `QA_CHECKLIST.md` for full testing procedures.

## Release

### Store Submission

1. Build for target browser
2. Zip the dist folder
3. Create store listing
4. Upload build + screenshots
5. Submit for review

### Post-Install

New users are redirected to: `https://lexyhub.com/ext/welcome`

## Support

- [Documentation](https://docs.lexyhub.com)
- [Report Issue](https://github.com/dxhub-apps/lexyhub/issues)
- [Contact Support](https://lexyhub.com/support)

## License

MIT
