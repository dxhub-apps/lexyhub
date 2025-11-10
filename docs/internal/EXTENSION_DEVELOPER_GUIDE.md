# LexyHub Extension - Developer Guide

Technical documentation for maintaining and extending the LexyHub Keyword Collector Extension.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Development Setup](#development-setup)
5. [Core Components](#core-components)
6. [Message Passing Protocol](#message-passing-protocol)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Adding New Domain Parsers](#adding-new-domain-parsers)
10. [Build & Deployment](#build--deployment)
11. [Testing](#testing)
12. [Performance Optimization](#performance-optimization)
13. [Security Considerations](#security-considerations)

---

## Architecture Overview

The LexyHub Extension follows a Manifest V3 architecture with these key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser UI                              │
├──────────────────┬──────────────────┬──────────────────────────┤
│   Popup UI       │   Options Page   │   Content Scripts        │
│   (popup.js)     │   (options.js)   │   (etsy.js, amazon.js,   │
│                  │                  │    google.js, etc.)      │
└──────────────────┴──────────────────┴──────────────────────────┘
                           │
                           ↓
           ┌───────────────────────────────────┐
           │   Background Service Worker       │
           │   (background/index.ts)           │
           │   • Message routing               │
           │   • Auth management               │
           │   • API coordination              │
           │   • Context menu handling         │
           └───────────────────────────────────┘
                           │
                           ↓
           ┌───────────────────────────────────┐
           │   Shared Libraries                │
           │   • storage.ts                    │
           │   • auth.ts                       │
           │   • api-client.ts                 │
           │   • tooltip.ts                    │
           │   • session-recorder.ts           │
           │   • parsers.ts                    │
           │   • remote-config.ts              │
           └───────────────────────────────────┘
                           │
                           ↓
           ┌───────────────────────────────────┐
           │   Backend APIs (Next.js)          │
           │   /api/ext/*                      │
           └───────────────────────────────────┘
                           │
                           ↓
           ┌───────────────────────────────────┐
           │   Database (Supabase)             │
           │   PostgreSQL + Row Level Security │
           └───────────────────────────────────┘
```

### Data Flow: Keyword Capture → Golden Source

```
User highlights keyword on Etsy
         ↓
Content script detects selection
         ↓
Sends ADD_TO_WATCHLIST message to background
         ↓
Background calls /api/ext/watchlist/add
         ↓
Backend inserts to:
  1. user_watchlist_terms (user's personal list)
  2. ext_watchlist_upsert_queue (pending sync)
  3. community_signals (if opted in)
         ↓
Vercel Cron (every 5 minutes)
         ↓
/api/jobs/ext-watchlist-upsert processes queue
         ↓
UPSERT to keywords table (golden source)
```

---

## Project Structure

```
lexyhub/
├── extension/                          # Chrome Extension
│   ├── manifest.json                   # Extension manifest (MV3)
│   ├── src/
│   │   ├── background/
│   │   │   └── index.ts                # Service worker entry point
│   │   ├── content/
│   │   │   ├── etsy.ts                 # Etsy parser
│   │   │   ├── amazon.ts               # Amazon parser
│   │   │   ├── shopify.ts              # Shopify parser (generic)
│   │   │   ├── google.ts               # Google Search parser
│   │   │   ├── bing.ts                 # Bing Search parser
│   │   │   ├── pinterest.ts            # Pinterest parser
│   │   │   ├── reddit.ts               # Reddit parser
│   │   │   ├── styles.css              # Shared styles
│   │   │   └── fab.ts                  # Floating Action Button
│   │   └── lib/
│   │       ├── storage.ts              # Chrome storage wrapper
│   │       ├── auth.ts                 # Authentication manager
│   │       ├── api-client.ts           # API client
│   │       ├── remote-config.ts        # Feature flags
│   │       ├── tooltip.ts              # Metric tooltip UI
│   │       ├── session-recorder.ts     # Session tracking
│   │       └── parsers.ts              # Parsing utilities
│   ├── popup/
│   │   ├── popup.html                  # Popup UI
│   │   ├── popup.css                   # Popup styles
│   │   └── popup.js                    # Popup logic
│   ├── options/
│   │   ├── options.html                # Options page
│   │   ├── options.css                 # Options styles
│   │   └── options.js                  # Options logic
│   └── icons/                          # Extension icons
├── src/app/api/ext/                    # Backend API endpoints
│   ├── auth/route.ts                   # Extension auth
│   ├── metrics/batch/route.ts          # Batch metrics
│   ├── watchlist/
│   │   ├── route.ts                    # Get watchlist
│   │   └── add/route.ts                # Add to watchlist
│   ├── session/route.ts                # Save session
│   ├── snapshot/route.ts               # Create snapshot
│   ├── trends/suggest/route.ts         # Trending suggestions
│   ├── brief/route.ts                  # Generate brief
│   └── remote-config/route.ts          # Feature flags
├── src/app/api/jobs/
│   └── ext-watchlist-upsert/route.ts   # Cron job for golden source sync
└── supabase/migrations/
    └── 0028_extension_advanced_features.sql
```

---

## Tech Stack

### Extension
- **Manifest V3** - Latest Chrome Extension API
- **TypeScript** - Type-safe JavaScript
- **Vanilla JS** - No framework for popup/options (lightweight)
- **Chrome APIs**:
  - `chrome.storage` - Local persistence
  - `chrome.runtime` - Message passing
  - `chrome.scripting` - Content script injection
  - `chrome.contextMenus` - Right-click menu
  - `chrome.notifications` - User notifications
  - `chrome.alarms` - Periodic tasks

### Backend
- **Next.js 14** - React framework with App Router
- **Supabase** - PostgreSQL with RLS
- **Vercel** - Hosting & Serverless
- **OpenAI** - AI brief generation

### Build Tools
- **Webpack** - Bundling TypeScript to JS
- **TypeScript Compiler** - Type checking
- **ESLint** - Code linting

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome browser (for testing)
- Supabase account
- LexyHub backend running locally or staging

### Installation

```bash
# Clone the repo
git clone https://github.com/dxhub-apps/lexyhub.git
cd lexyhub

# Install dependencies
npm install

# Build the extension
cd extension
npm run build

# The built extension will be in extension/dist/
```

### Loading the Extension Locally

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension/dist/` folder
5. The extension should now appear in your toolbar

### Development Workflow

```bash
# Watch mode for extension (auto-rebuild)
cd extension
npm run watch

# In another terminal, run the backend
cd ..
npm run dev

# Make changes to extension/src/* and refresh the extension
```

### Environment Variables

Create `extension/.env` (for build time):
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## Core Components

### 1. Background Service Worker (`src/background/index.ts`)

**Responsibilities:**
- Central message router
- Authentication state management
- API request coordination
- Context menu setup
- Periodic tasks (alarms)

**Key Functions:**
```typescript
// Message handler switch
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_AUTH_STATE": handleGetAuthState(sendResponse); break;
    case "ADD_TO_WATCHLIST": handleAddToWatchlist(message.payload, sendResponse); break;
    // ... more handlers
  }
  return true; // Keep channel open for async
});

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim();
  const market = detectMarketFromUrl(tab?.url || '');
  // ... handle action
});
```

**Initialization:**
- Runs on extension install/update
- Fetches remote config
- Sets up alarms for periodic tasks
- Creates context menu items

### 2. Content Scripts (`src/content/*.ts`)

**Responsibilities:**
- Parse DOM for keywords
- Inject highlights and tooltips
- Track user interactions
- Capture SERP metadata

**Common Pattern:**
```typescript
// 1. Detect domain/page type
function init() {
  if (!isValidPage()) return;

  // 2. Parse keywords
  const keywords = parseKeywords();

  // 3. Request metrics from background
  chrome.runtime.sendMessage({
    type: 'GET_METRICS',
    payload: { terms: keywords, market: 'etsy' }
  }, (response) => {
    // 4. Render highlights
    if (response.success) {
      highlightKeywords(response.data);
    }
  });

  // 5. Set up session recorder
  sessionRecorder.start();

  // 6. Listen for clicks
  document.addEventListener('click', handleClick);
}

document.addEventListener('DOMContentLoaded', init);
```

### 3. Storage Manager (`src/lib/storage.ts`)

**Wrapper around chrome.storage.sync/local:**
```typescript
export class StorageManager {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }
}
```

**Storage Keys:**
- `auth:token` - JWT token
- `auth:user` - User object
- `settings` - User preferences
- `current_session` - Active session data
- `watchlist:{market}` - Cached watchlist
- `remote_config` - Feature flags
- `remote_config:timestamp` - Config cache time

### 4. Auth Manager (`src/lib/auth.ts`)

**Handles OAuth2 flow:**
```typescript
export class AuthManager {
  async initiateLogin(): Promise<void> {
    const authUrl = `${API_BASE}/api/ext/auth/login`;
    await chrome.tabs.create({ url: authUrl });
  }

  async handleCallback(token: string, user: any): Promise<void> {
    await this.storage.set('auth:token', token);
    await this.storage.set('auth:user', user);
  }

  async getToken(): Promise<string | null> {
    return await this.storage.get<string>('auth:token');
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  async logout(): Promise<void> {
    await this.storage.remove('auth:token');
    await this.storage.remove('auth:user');
  }
}
```

### 5. API Client (`src/lib/api-client.ts`)

**Centralized API communication:**
```typescript
export class APIClient {
  private baseUrl = 'https://lexyhub.com/api/ext';

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.auth.getToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Convenience methods
  async getWatchlist(market?: string, since?: string) {
    const params = new URLSearchParams();
    if (market) params.set('market', market);
    if (since) params.set('since', since);
    return this.request(`/watchlist?${params}`);
  }

  async addToWatchlist(payload: { term: string; market: string; source_url?: string }) {
    return this.request('/watchlist/add', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ... more methods
}
```

### 6. Session Recorder (`src/lib/session-recorder.ts`)

**Automatic session tracking:**
```typescript
export class SessionRecorder {
  private currentSession: SessionData | null = null;
  private inactivityTimer: number | null = null;
  private readonly INACTIVITY_MS = 30 * 60 * 1000; // 30 min

  start(): void {
    this.currentSession = {
      session_id: crypto.randomUUID(),
      market: this.detectMarket(),
      started_at: new Date().toISOString(),
      search_queries: [],
      clicked_listings: [],
      terms_discovered: [],
    };

    this.resetInactivityTimer();
  }

  trackSearch(query: string): void {
    if (!this.currentSession) this.start();
    if (!this.currentSession!.search_queries.includes(query)) {
      this.currentSession!.search_queries.push(query);
    }
    this.resetInactivityTimer();
  }

  trackClick(url: string, position: number): void {
    if (!this.currentSession) return;
    this.currentSession!.clicked_listings.push({ url, position, timestamp: Date.now() });
    this.resetInactivityTimer();
  }

  trackDiscovery(term: string): void {
    if (!this.currentSession) return;
    if (!this.currentSession!.terms_discovered.includes(term)) {
      this.currentSession!.terms_discovered.push(term);
    }
    this.resetInactivityTimer();
  }

  end(): void {
    if (!this.currentSession) return;
    this.currentSession.ended_at = new Date().toISOString();

    // Send to background for API save
    chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      payload: this.currentSession,
    });

    this.currentSession = null;
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = window.setTimeout(() => this.end(), this.INACTIVITY_MS);
  }
}
```

### 7. Tooltip Manager (`src/lib/tooltip.ts`)

**Rich metric tooltips:**
```typescript
export class TooltipManager {
  private tooltip: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;

  async show(target: HTMLElement, term: string, market: string): Promise<void> {
    // Fetch metrics
    const metrics = await this.fetchMetrics(term, market);

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'lexyhub-tooltip';
    this.tooltip.innerHTML = this.renderContent(metrics);

    // Position near target
    this.position(target);

    // Attach event listeners for actions
    this.attachActionListeners(term, market);

    document.body.appendChild(this.tooltip);
  }

  private renderContent(metrics: KeywordMetrics): string {
    return `
      <div class="metrics-grid">
        <div class="metric">
          <span class="label">Demand</span>
          <span class="value">${metrics.demand}</span>
        </div>
        <div class="metric">
          <span class="label">Competition</span>
          <span class="value">${metrics.competition}</span>
        </div>
        <!-- ... more metrics -->
      </div>
      <div class="actions">
        <button data-action="copy">Copy</button>
        <button data-action="save">Save</button>
        <button data-action="brief">Brief</button>
      </div>
    `;
  }

  hide(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}
```

---

## Message Passing Protocol

The extension uses Chrome's message passing API for communication between components.

### Message Types

| Type | Direction | Payload | Response | Description |
|------|-----------|---------|----------|-------------|
| `GET_AUTH_STATE` | Content/Popup → Background | none | `{ isAuthenticated, hasToken }` | Check login status |
| `INITIATE_LOGIN` | Popup → Background | none | `{ success }` | Start OAuth flow |
| `LOGOUT` | Popup → Background | none | `{ success }` | Clear auth |
| `GET_WATCHLIST` | Popup → Background | `{ market?, since? }` | `{ success, data }` | Fetch watchlist |
| `ADD_TO_WATCHLIST` | Content/Popup → Background | `{ term, market, source_url? }` | `{ success, data }` | Save keyword |
| `GET_METRICS` | Content → Background | `{ terms[], market }` | `{ success, data }` | Batch metrics |
| `CREATE_BRIEF` | Popup → Background | `{ terms[], market }` | `{ success, data }` | Generate brief |
| `CAPTURE_EVENT` | Content → Background | `{ source, url, terms[], serp_meta? }` | `{ success }` | Track event |
| `GET_SETTINGS` | Popup → Background | none | `{ success, data }` | Get settings |
| `UPDATE_SETTINGS` | Popup → Background | `{ ...settings }` | `{ success, data }` | Update settings |
| `SAVE_SESSION` | Content → Background | `SessionData` | `{ success, data }` | Persist session |
| `GET_TRENDING` | Popup → Background | `{ market, limit? }` | `{ success, data }` | Trending terms |
| `GET_CURRENT_SESSION` | Popup → Background | none | `{ success, data }` | Current session |
| `END_SESSION` | Popup → Background | none | `{ success }` | Force end session |
| `GET_BRIEFS` | Popup → Background | `{ limit? }` | `{ success, data }` | List briefs |
| `EXPORT_DATA` | Options → Background | none | `{ success, data }` | Export all data |
| `DELETE_DATA` | Options → Background | none | `{ success }` | Clear all data |

### Sending Messages

**From Content Script:**
```typescript
chrome.runtime.sendMessage(
  { type: 'ADD_TO_WATCHLIST', payload: { term: 'vintage jewelry', market: 'etsy' } },
  (response) => {
    if (response.success) {
      console.log('Saved!', response.data);
    }
  }
);
```

**From Popup/Options:**
```typescript
chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
  if (response.isAuthenticated) {
    // Show logged-in UI
  }
});
```

**From Background to Tab:**
```typescript
chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_HIGHLIGHTS' });
```

---

## API Endpoints

All extension endpoints are under `/api/ext/` and require authentication.

### Authentication

**Header:**
```
Authorization: Bearer <jwt_token>
```

**Token Source:**
- Obtained during OAuth flow
- Stored in `chrome.storage.local` under `auth:token`
- Included in all API requests by `APIClient`

### Rate Limiting

- **Free Tier:** 100 requests/minute
- **Pro Tier:** 200 requests/minute
- **Enterprise:** 500 requests/minute

### Endpoints

#### `POST /api/ext/auth/callback`
**Purpose:** Complete OAuth flow and return JWT token
**Payload:**
```typescript
{ code: string; state: string }
```
**Response:**
```typescript
{ token: string; user: { id: string; email: string; plan: string } }
```

#### `GET /api/ext/remote-config`
**Purpose:** Fetch feature flags and kill switches
**Response:**
```typescript
{
  extension_enabled: true,
  max_batch_size: 100,
  tooltip_delay_ms: 500,
  session_timeout_minutes: 30,
  // ... more config
}
```

#### `POST /api/ext/metrics/batch`
**Purpose:** Get metrics for multiple keywords
**Payload:**
```typescript
{ terms: string[]; market: string }
```
**Response:**
```typescript
{
  metrics: [
    {
      t: "vintage jewelry",
      demand: 85,
      competition: 72,
      engagement: 68,
      ai_score: 75,
      trend: "up",
      freshness: "2 days ago",
      intent: "commercial",
      seasonality: "holiday"
    },
    // ... more
  ]
}
```

#### `POST /api/ext/watchlist/add`
**Purpose:** Add keyword to watchlist and enqueue for golden source sync
**Payload:**
```typescript
{ term: string; market: string; source_url?: string }
```
**Response:**
```typescript
{ id: string; term: string; market: string; created_at: string }
```
**Side Effects:**
1. Inserts to `user_watchlist_terms`
2. Enqueues to `ext_watchlist_upsert_queue`
3. Increments `community_signals` (if opted in)

#### `GET /api/ext/watchlist`
**Purpose:** Retrieve user's watchlist
**Query Params:** `market`, `since`
**Response:**
```typescript
{
  terms: [
    { id: string; term: string; market: string; source_url: string; created_at: string },
    // ... more
  ]
}
```

#### `POST /api/ext/session`
**Purpose:** Save research session to database
**Payload:**
```typescript
{
  session_id: string;
  market: string;
  started_at: string;
  ended_at: string;
  search_queries: string[];
  clicked_listings: Array<{ url: string; position: number; timestamp: number }>;
  terms_discovered: string[];
}
```
**Response:**
```typescript
{ id: string; session_id: string; user_id: string }
```

#### `POST /api/ext/brief`
**Purpose:** Generate AI-powered keyword brief
**Payload:**
```typescript
{ terms: string[]; market: string }
```
**Response:**
```typescript
{
  id: string;
  title: string;
  market: string;
  terms: string[];
  clusters: {
    high_opportunity: string[];
    medium_opportunity: string[];
    low_opportunity: string[];
  };
  executive_summary: string;
  opportunity_analysis: string;
  ai_insights: string;
  created_at: string;
}
```

#### `POST /api/ext/trends/suggest`
**Purpose:** Get trending keywords from community signals
**Payload:**
```typescript
{ term: string; market: string; limit?: number }
```
**Response:**
```typescript
{
  suggestions: [
    { term: string; discovery_count: number; trend_score: number },
    // ... more
  ]
}
```

#### `POST /api/ext/snapshot`
**Purpose:** Create an opportunity snapshot with outrank difficulty
**Payload:**
```typescript
{
  listing_url: string;
  market: string;
  target_keyword: string;
  current_position: number;
}
```
**Response:**
```typescript
{
  id: string;
  difficulty_score: number;
  top_10_analysis: { /* competitor data */ };
  recommendations: string[];
}
```

### Cron Job

#### `POST /api/jobs/ext-watchlist-upsert`
**Purpose:** Background job to sync watchlist to keywords golden source
**Trigger:** Vercel Cron (every 5 minutes)
**Authentication:** `Authorization: Bearer <CRON_SECRET>`
**Process:**
1. Fetch unprocessed items from `ext_watchlist_upsert_queue`
2. For each item:
   - Check if keyword exists in `keywords` table
   - If exists: update `freshness_ts`
   - If not: insert new keyword with `source='extension_watchlist'`
3. Mark queue items as processed

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/jobs/ext-watchlist-upsert",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## Database Schema

### Extension-Specific Tables

#### `user_watchlist_terms`
**Purpose:** User's personal keyword watchlist
```sql
CREATE TABLE user_watchlist_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  market TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, term, market)
);
```

#### `ext_watchlist_upsert_queue`
**Purpose:** Queue for syncing watchlist to golden source
```sql
CREATE TABLE ext_watchlist_upsert_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  market TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  INDEX idx_queue_unprocessed (processed_at) WHERE processed_at IS NULL
);
```

#### `extension_sessions`
**Purpose:** Research session tracking
```sql
CREATE TABLE extension_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  market TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  search_queries TEXT[] DEFAULT '{}',
  clicked_listings JSONB DEFAULT '[]'::jsonb,
  terms_discovered TEXT[] DEFAULT '{}',
  UNIQUE(user_id, session_id)
);
```

#### `extension_briefs`
**Purpose:** AI-generated keyword briefs
```sql
CREATE TABLE extension_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  market TEXT NOT NULL,
  terms TEXT[] NOT NULL,
  clusters JSONB,
  executive_summary TEXT,
  opportunity_analysis TEXT,
  ai_insights TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `community_signals`
**Purpose:** Anonymous keyword discovery tracking
```sql
CREATE TABLE community_signals (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,
  market TEXT NOT NULL,
  discovery_count INT DEFAULT 1,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(term, market, recorded_date)
);
```

#### `extension_snapshots`
**Purpose:** Outrank difficulty analysis
```sql
CREATE TABLE extension_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_url TEXT NOT NULL,
  market TEXT NOT NULL,
  target_keyword TEXT NOT NULL,
  current_position INT,
  difficulty_score INT,
  top_10_analysis JSONB,
  recommendations TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `remote_config`
**Purpose:** Server-side feature flags
```sql
CREATE TABLE remote_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `user_extension_settings`
**Purpose:** Per-user extension preferences
```sql
CREATE TABLE user_extension_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  community_signal_opt_in BOOLEAN DEFAULT false,
  enabled_domains JSONB DEFAULT '{"etsy":true,"amazon":true,"shopify":true,"google":false,"bing":false,"pinterest":false,"reddit":false}'::jsonb,
  highlight_enabled BOOLEAN DEFAULT true,
  tooltip_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Row Level Security (RLS)

All tables have RLS enabled. Example policies:

```sql
-- user_watchlist_terms
CREATE POLICY "Users can view own watchlist" ON user_watchlist_terms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own terms" ON user_watchlist_terms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- extension_sessions
CREATE POLICY "Users can view own sessions" ON extension_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- community_signals (read-only for users)
CREATE POLICY "Anyone can view community signals" ON community_signals
  FOR SELECT USING (true);
```

### Helper Functions

#### `increment_community_signal()`
```sql
CREATE FUNCTION increment_community_signal(p_term TEXT, p_market TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO community_signals (term, market, discovery_count, recorded_date)
  VALUES (p_term, p_market, 1, CURRENT_DATE)
  ON CONFLICT (term, market, recorded_date)
  DO UPDATE SET discovery_count = community_signals.discovery_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `get_trending_terms()`
```sql
CREATE FUNCTION get_trending_terms(p_market TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE(term TEXT, discovery_count BIGINT, trend_score NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.term,
    SUM(cs.discovery_count) as total_discoveries,
    (SUM(cs.discovery_count) * 1.0 / GREATEST(1, CURRENT_DATE - MIN(cs.recorded_date))) as trend_score
  FROM community_signals cs
  WHERE cs.market = p_market
    AND cs.recorded_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY cs.term
  ORDER BY trend_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## Adding New Domain Parsers

Follow this guide to add support for a new marketplace or search engine.

### Step 1: Create Content Script

Create `extension/src/content/newdomain.ts`:

```typescript
// extension/src/content/newdomain.ts
import { SessionRecorder } from '../lib/session-recorder';
import { TooltipManager } from '../lib/tooltip';
import { extractKeywords, normalizeTerm } from '../lib/parsers';

const sessionRecorder = new SessionRecorder();
const tooltipManager = new TooltipManager();
const MARKET = 'newdomain';

function init() {
  console.log('[LexyHub] NewDomain parser initialized');

  // Check if we should run on this page
  if (!isValidPage()) return;

  // Start session tracking
  sessionRecorder.start();

  // Parse keywords from page
  const keywords = parseKeywords();

  // Request metrics and highlight
  if (keywords.length > 0) {
    chrome.runtime.sendMessage(
      { type: 'GET_METRICS', payload: { terms: keywords, market: MARKET } },
      (response) => {
        if (response?.success) {
          highlightKeywords(response.data);
        }
      }
    );
  }

  // Track search query
  const query = extractSearchQuery();
  if (query) {
    sessionRecorder.trackSearch(query);
  }

  // Listen for clicks
  document.addEventListener('click', handleClick, true);
}

function isValidPage(): boolean {
  // Example: Only run on search results pages
  return window.location.pathname.includes('/search');
}

function parseKeywords(): string[] {
  const keywords = new Set<string>();

  // Example: Extract from product titles
  document.querySelectorAll('.product-title').forEach((el) => {
    const title = el.textContent?.trim();
    if (title) {
      // Use utility to extract multi-word phrases
      const extracted = extractKeywords(title, 2, 4); // 2-4 word phrases
      extracted.forEach(kw => keywords.add(normalizeTerm(kw)));
    }
  });

  return Array.from(keywords);
}

function highlightKeywords(metrics: any[]): void {
  const metricsMap = new Map(metrics.map(m => [m.t.toLowerCase(), m]));

  document.querySelectorAll('.product-title').forEach((el) => {
    const title = el.textContent?.trim().toLowerCase();
    if (!title) return;

    // Check if title contains any tracked keywords
    metricsMap.forEach((metric, term) => {
      if (title.includes(term)) {
        // Highlight and attach tooltip
        el.classList.add('lexyhub-highlight');
        el.addEventListener('mouseenter', () => {
          tooltipManager.show(el as HTMLElement, term, MARKET);
        });
        el.addEventListener('mouseleave', () => {
          tooltipManager.hide();
        });
      }
    });
  });
}

function extractSearchQuery(): string | null {
  // Example: Extract from URL parameter
  const params = new URLSearchParams(window.location.search);
  return params.get('q') || params.get('query');
}

function handleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  // Check if clicked on a product link
  const productLink = target.closest<HTMLAnchorElement>('a.product-link');
  if (productLink) {
    const url = productLink.href;
    const position = getElementPosition(productLink);
    sessionRecorder.trackClick(url, position);
  }
}

function getElementPosition(el: HTMLElement): number {
  // Find position in results list
  const parent = el.closest('.search-results');
  if (!parent) return -1;

  const items = Array.from(parent.querySelectorAll('.product-link'));
  return items.indexOf(el);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### Step 2: Add to Manifest

Edit `extension/manifest.json`:

```json
{
  "content_scripts": [
    // ... existing scripts
    {
      "matches": [
        "https://www.newdomain.com/*"
      ],
      "js": [
        "content/newdomain.js"
      ],
      "css": [
        "content/styles.css"
      ],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    // ... existing permissions
    "https://www.newdomain.com/*"
  ]
}
```

### Step 3: Add Market Detection

Edit `extension/src/background/index.ts`:

```typescript
function detectMarketFromUrl(url: string): string {
  if (url.includes('etsy.com')) return 'etsy';
  if (url.includes('amazon.')) return 'amazon';
  if (url.includes('google.com/search')) return 'google';
  if (url.includes('pinterest.')) return 'pinterest';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('bing.com')) return 'bing';
  if (url.includes('newdomain.com')) return 'newdomain'; // ADD THIS
  return 'shopify'; // default
}
```

### Step 4: Update Settings

Edit `extension/options/options.js` to add domain toggle:

```javascript
const domains = [
  { id: 'etsy', name: 'Etsy', desc: 'Etsy marketplace' },
  { id: 'amazon', name: 'Amazon', desc: 'Amazon marketplaces' },
  // ... others
  { id: 'newdomain', name: 'NewDomain', desc: 'NewDomain marketplace' }
];
```

### Step 5: Build & Test

```bash
cd extension
npm run build

# Load in Chrome and test on newdomain.com
```

### Domain-Specific Tips

**E-commerce (Etsy, Amazon, Shopify):**
- Parse product titles, tags, categories
- Track add-to-cart events
- Extract seller info

**Search Engines (Google, Bing):**
- Parse result titles and descriptions
- Extract "People Also Ask" questions
- Capture related searches
- Track SERP positions

**Social (Pinterest, Reddit):**
- Parse post/pin titles
- Extract hashtags
- Track engagement metrics (likes, comments)

---

## Build & Deployment

### Development Build

```bash
cd extension
npm run build:dev

# Output: extension/dist/
```

### Production Build

```bash
cd extension
npm run build:prod

# Output: extension/dist/
# - Minified JS
# - No source maps
# - Optimized assets
```

### Build Configuration

**webpack.config.js:**
```javascript
module.exports = {
  entry: {
    background: './src/background/index.ts',
    'content/etsy': './src/content/etsy.ts',
    'content/amazon': './src/content/amazon.ts',
    // ... more content scripts
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
```

### Chrome Web Store Submission

1. **Prepare Assets:**
   - Icons: 16×16, 48×48, 128×128 PNG
   - Screenshots: 5 images at 1280×800 or 640×400
   - Promo tile: 440×280 PNG
   - Demo video: 30-60 seconds (optional)

2. **Create ZIP:**
   ```bash
   cd extension/dist
   zip -r lexyhub-extension-v1.0.0.zip .
   ```

3. **Upload to Chrome Web Store:**
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New Item"
   - Upload ZIP
   - Fill in store listing:
     - Name: "LexyHub Keyword Collector"
     - Description: (from manifest)
     - Screenshots
     - Category: Productivity
     - Language: English

4. **Submit for Review:**
   - Typical review time: 1-3 days
   - Address any feedback from Google
   - Publish when approved

### Versioning

Follow semantic versioning in `manifest.json`:
```json
{
  "version": "1.0.0"
}
```

- **Major (1.x.x):** Breaking changes
- **Minor (x.1.x):** New features
- **Patch (x.x.1):** Bug fixes

### Auto-Updates

Chrome automatically updates extensions for users. To release an update:
1. Increment version in manifest.json
2. Build production bundle
3. Upload new ZIP to Chrome Web Store
4. Submit for review

Users will receive the update within hours of approval.

---

## Testing

### Manual Testing Checklist

**Authentication:**
- [ ] Can log in via OAuth flow
- [ ] Token persists across browser restarts
- [ ] Logout clears all auth data

**Content Scripts:**
- [ ] Keywords highlight on Etsy
- [ ] Keywords highlight on Amazon
- [ ] Keywords highlight on Google Search
- [ ] Tooltips show correct metrics
- [ ] Tooltips appear on hover with correct delay

**Actions:**
- [ ] Copy button copies keyword to clipboard
- [ ] Save button adds to watchlist (verify in popup)
- [ ] Brief button generates brief (verify in popup)
- [ ] Context menu adds keywords
- [ ] Context menu creates briefs

**Session Tracking:**
- [ ] Search queries are tracked
- [ ] Clicks are tracked with positions
- [ ] Discovered terms are recorded
- [ ] Session auto-saves after 30 min inactivity
- [ ] Manual end session works

**Popup:**
- [ ] Discover tab shows trending keywords
- [ ] Session tab shows current stats
- [ ] Briefs tab lists all briefs
- [ ] Settings tab toggles work

**Options:**
- [ ] Domain toggles enable/disable parsers
- [ ] Feature toggles work (highlighting, tooltips, etc.)
- [ ] Export data downloads JSON
- [ ] Delete data clears everything

**Performance:**
- [ ] No noticeable page slowdown
- [ ] Highlights render quickly (<500ms)
- [ ] API requests are batched (not 1 per keyword)

### Automated Testing (Future)

**Unit Tests:**
```bash
npm run test:unit
```

**E2E Tests (Playwright):**
```bash
npm run test:e2e
```

Example test:
```typescript
// tests/e2e/etsy.spec.ts
import { test, expect } from '@playwright/test';

test('highlights keywords on Etsy search results', async ({ page }) => {
  await page.goto('https://www.etsy.com/search?q=vintage+jewelry');

  // Wait for extension to inject
  await page.waitForTimeout(1000);

  // Check for highlights
  const highlights = await page.locator('.lexyhub-highlight').count();
  expect(highlights).toBeGreaterThan(0);

  // Hover and check tooltip
  await page.locator('.lexyhub-highlight').first().hover();
  await expect(page.locator('.lexyhub-tooltip')).toBeVisible();
});
```

---

## Performance Optimization

### Content Script Optimizations

1. **Debounce DOM Parsing:**
   ```typescript
   let parseTimeout: number | null = null;
   function scheduleParse() {
     if (parseTimeout) clearTimeout(parseTimeout);
     parseTimeout = window.setTimeout(parseKeywords, 500);
   }

   const observer = new MutationObserver(scheduleParse);
   observer.observe(document.body, { childList: true, subtree: true });
   ```

2. **Batch API Requests:**
   ```typescript
   // Don't do this (1 request per keyword):
   keywords.forEach(kw => {
     chrome.runtime.sendMessage({ type: 'GET_METRICS', payload: { term: kw } });
   });

   // Do this instead (1 request for all):
   chrome.runtime.sendMessage({
     type: 'GET_METRICS',
     payload: { terms: keywords, market: 'etsy' }
   });
   ```

3. **Limit Highlights:**
   ```typescript
   // Only highlight first 50 keywords per page
   const MAX_HIGHLIGHTS = 50;
   const keywordsToHighlight = keywords.slice(0, MAX_HIGHLIGHTS);
   ```

4. **Use IntersectionObserver:**
   ```typescript
   // Only attach tooltips to visible elements
   const observer = new IntersectionObserver((entries) => {
     entries.forEach(entry => {
       if (entry.isIntersecting) {
         attachTooltip(entry.target as HTMLElement);
       }
     });
   });

   document.querySelectorAll('.lexyhub-highlight').forEach(el => {
     observer.observe(el);
   });
   ```

### Background Script Optimizations

1. **Cache API Responses:**
   ```typescript
   const cache = new Map<string, { data: any; timestamp: number }>();
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

   async function getCachedMetrics(terms: string[], market: string) {
     const cacheKey = `${market}:${terms.sort().join(',')}`;
     const cached = cache.get(cacheKey);

     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return cached.data;
     }

     const data = await api.getMetricsBatch(terms, market);
     cache.set(cacheKey, { data, timestamp: Date.now() });
     return data;
   }
   ```

2. **Use chrome.storage.local (not sync):**
   ```typescript
   // sync has 100KB limit and is slow
   // local has 5MB limit and is fast
   await chrome.storage.local.set({ key: value });
   ```

### Bundle Size Optimization

```bash
# Analyze bundle size
npm run analyze

# Use dynamic imports for large libraries
const OpenAI = await import('openai');
```

---

## Security Considerations

### Content Security Policy

**manifest.json:**
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

- No `eval()` or `new Function()`
- No inline scripts in HTML
- No external script loading

### Input Sanitization

**Always sanitize user input before injecting into DOM:**
```typescript
function sanitizeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// When rendering keyword
tooltip.innerHTML = `<span>${sanitizeHTML(keyword)}</span>`;
```

### API Authentication

- JWT tokens stored in chrome.storage.local (encrypted by Chrome)
- Tokens sent in Authorization header (never in URL)
- Short expiration (24 hours)
- Refresh tokens for long-lived sessions

### RLS Enforcement

- All database tables have RLS policies
- Service role key only used in cron jobs (not extension)
- Users can only access their own data

### Permissions Minimization

Only request necessary permissions:
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "contextMenus",
    "notifications",
    "alarms"
  ],
  "host_permissions": [
    "https://www.etsy.com/*",
    // Only specific domains, not <all_urls> unless needed
  ]
}
```

### Privacy

- No tracking pixels
- No third-party analytics (except OpenAI for briefs)
- Community signals are anonymous (no user_id)
- Users can export and delete all data

---

## Troubleshooting

### Common Issues

**Issue: "Service worker inactive"**
- **Cause:** Background script crashed
- **Fix:** Check console for errors, reload extension

**Issue: Content script not injecting**
- **Cause:** Domain not in manifest.json host_permissions
- **Fix:** Add domain to manifest and reload

**Issue: "Failed to fetch" API errors**
- **Cause:** CORS or invalid token
- **Fix:** Check API_BASE_URL, verify token not expired

**Issue: Highlights not appearing**
- **Cause:** Selector mismatch or CSS conflict
- **Fix:** Inspect element, adjust selectors, check CSS specificity

### Debugging

**Background Script:**
```bash
1. Go to chrome://extensions/
2. Find LexyHub Extension
3. Click "Service Worker" under "Inspect views"
4. Console opens with background script logs
```

**Content Script:**
```bash
1. Open any supported marketplace page
2. Right-click → Inspect
3. Console tab
4. Filter by "[LexyHub]"
```

**Storage:**
```bash
1. In DevTools console:
chrome.storage.local.get(null, console.log)

2. Or use Chrome Storage Explorer extension
```

**Network:**
```bash
1. DevTools → Network tab
2. Filter by "ext/"
3. Check request/response for API calls
```

---

## Contributing

### Code Style

- Use TypeScript for type safety
- Follow Prettier formatting (run `npm run format`)
- Use ESLint (run `npm run lint`)
- Prefix console logs with `[LexyHub]`

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/add-walmart-parser

# Make changes, commit
git add .
git commit -m "feat: Add Walmart marketplace parser"

# Push and create PR
git push -u origin feature/add-walmart-parser
```

### Commit Message Format

Follow conventional commits:
```
feat: Add new feature
fix: Bug fix
docs: Documentation update
refactor: Code refactoring
test: Add tests
chore: Build/tooling changes
```

---

## Additional Resources

- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- Manifest V3 Migration: https://developer.chrome.com/docs/extensions/mv3/intro/
- Supabase Docs: https://supabase.com/docs
- LexyHub API Docs: https://lexyhub.com/docs/api
- Support: support@lexyhub.com

---

**Last Updated:** 2025-11-05
**Maintainer:** LexyHub Dev Team
