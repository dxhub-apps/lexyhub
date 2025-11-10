# LexyBrain Chrome Extension Integration Guide

This guide explains how to integrate LexyBrain AI-powered insights into the LexyHub Chrome extension.

## Overview

The extension integration allows users to:
- Generate AI insights directly from keywords they're viewing in their browser
- See real-time quota usage in the extension UI
- Access quick insights without leaving the marketplace page
- One-click Market Briefs for collections of keywords

## Architecture

```
Chrome Extension → Extension API → LexyBrain Core → RunPod LLM
                       ↓
                   Quota Check
                   Rate Limit
                   Cache Check
```

## API Endpoints

### 1. Quick Insight Endpoint

**POST** `/api/ext/lexybrain/quick-insight`

Generate AI insights optimized for extension use cases.

**Request:**
```json
{
  "type": "radar",
  "market": "etsy",
  "keywords": ["handmade jewelry", "silver rings"],
  "budget": "$20" // Required for ad_insight type only
}
```

**Response:**
```json
{
  "success": true,
  "type": "radar",
  "data": {
    "niche": "handmade jewelry",
    "keywords": [
      {
        "term": "handmade jewelry",
        "demand_score": 0.85,
        "momentum_score": 0.72,
        "competition_score": 0.45,
        "novelty_score": 0.60,
        "profit_score": 0.78,
        "overall_score": 0.68,
        "commentary": "Strong demand with moderate competition..."
      }
    ],
    "recommendations": ["Focus on specific niches..."],
    "confidence": 0.87
  },
  "cached": false,
  "quota": {
    "used": 15,
    "limit": 200
  }
}
```

**Insight Types:**
- `"market_brief"` - Comprehensive market overview (consumes ai_brief quota)
- `"radar"` - Multi-dimensional keyword scoring (consumes ai_calls quota)
- `"ad_insight"` - Budget allocation and CPC estimates (consumes ai_calls quota)
- `"risk"` - Risk detection and mitigation (consumes ai_calls quota)

**Error Handling:**
```json
// Quota exceeded (402 Payment Required)
{
  "error": "Quota exceeded",
  "used": 200,
  "limit": 200,
  "upgrade_url": "https://app.lexyhub.com/billing"
}

// Rate limit (429 Too Many Requests)
{
  "error": "Rate limit exceeded. Please try again in a moment."
}

// Generation failed (500)
{
  "error": "Failed to generate insight",
  "message": "...",
  "retry": true
}
```

### 2. Quota Check Endpoint

**GET** `/api/ext/lexybrain/quota`

Check current quota usage for displaying in extension UI.

**Response:**
```json
{
  "enabled": true,
  "quotas": {
    "ai_calls": {
      "used": 15,
      "limit": 200,
      "percentage": 7.5
    },
    "ai_brief": {
      "used": 2,
      "limit": 20,
      "percentage": 10
    },
    "ai_sim": {
      "used": 0,
      "limit": 50,
      "percentage": 0
    }
  },
  "status": "ok", // "ok" | "warning" | "exhausted"
  "upgrade_url": "https://app.lexyhub.com/billing"
}
```

**Status Indicators:**
- `"ok"` - Under 80% usage on all quotas
- `"warning"` - 80%+ usage on any quota
- `"exhausted"` - At or over limit on any quota

**If LexyBrain is disabled:**
```json
{
  "enabled": false
}
```

### 3. Remote Config Integration

LexyBrain features can be controlled via remote config:

**Config Keys:**
- `lexybrain_extension_enabled` (boolean) - Master switch for extension access
- `lexybrain_extension_default_type` (string) - Default insight type ("radar" recommended)
- `lexybrain_extension_show_quota` (boolean) - Show quota badge in extension
- `lexybrain_extension_max_keywords` (number) - Max keywords per request (default: 10)

**Fetch config:**
```javascript
const response = await fetch('/api/ext/remote-config');
const { config } = await response.json();

if (config.lexybrain_extension_enabled) {
  // Show LexyBrain features
}
```

## Extension Integration Patterns

### Pattern 1: Context Menu Integration

Add "Get AI Insight" to keyword context menu:

```javascript
// Extension background script
chrome.contextMenus.create({
  id: "lexybrain-insight",
  title: "Get AI Insight",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "lexybrain-insight") {
    const keyword = info.selectionText;
    const market = detectMarket(tab.url); // "etsy", "amazon", etc.

    const insight = await generateQuickInsight("radar", market, [keyword]);
    showInsightPopup(insight);
  }
});

async function generateQuickInsight(type, market, keywords) {
  const response = await fetch('https://app.lexyhub.com/api/ext/lexybrain/quick-insight', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getExtensionToken()}`
    },
    body: JSON.stringify({ type, market, keywords })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate insight');
  }

  return await response.json();
}
```

### Pattern 2: Keyword Tooltip Enhancement

Show AI scores in keyword tooltips:

```javascript
// Content script
async function enhanceKeywordCard(element, keyword) {
  // Fetch quick radar insight
  const insight = await generateQuickInsight("radar", "etsy", [keyword]);

  if (insight.success && insight.data.keywords[0]) {
    const scores = insight.data.keywords[0];

    // Add AI badge to keyword card
    const badge = document.createElement('div');
    badge.className = 'lexybrain-badge';
    badge.innerHTML = `
      <span class="ai-icon">🧠</span>
      <span class="overall-score">${Math.round(scores.overall_score * 100)}</span>
      <div class="tooltip">
        <div>Demand: ${formatScore(scores.demand_score)}</div>
        <div>Competition: ${formatScore(scores.competition_score)}</div>
        <div>Profit: ${formatScore(scores.profit_score)}</div>
      </div>
    `;

    element.appendChild(badge);
  }
}

function formatScore(score) {
  const percentage = Math.round(score * 100);
  const color = percentage >= 70 ? '🟢' : percentage >= 40 ? '🟡' : '🔴';
  return `${color} ${percentage}`;
}
```

### Pattern 3: Bulk Analysis for Watchlist

Generate Market Brief for user's watchlist:

```javascript
// Extension popup
async function analyzeWatchlist() {
  // Fetch user's watchlist
  const watchlistResponse = await fetch('/api/ext/watchlist', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { items } = await watchlistResponse.json();

  // Extract keywords (max 10)
  const keywords = items.slice(0, 10).map(item => item.keyword);

  // Generate Market Brief
  const insight = await generateQuickInsight("market_brief", "etsy", keywords);

  if (insight.success) {
    displayMarketBrief(insight.data);
  }
}

function displayMarketBrief(brief) {
  const popup = document.getElementById('lexybrain-popup');
  popup.innerHTML = `
    <h2>🧠 Market Brief</h2>
    <p>${brief.summary}</p>

    <h3>Top Opportunities</h3>
    <ul>
      ${brief.top_opportunities.map(opp => `
        <li>
          <strong>${opp.keyword}</strong>
          <span class="score">${Math.round(opp.score * 100)}%</span>
          <p>${opp.reason}</p>
        </li>
      `).join('')}
    </ul>

    <h3>Actions</h3>
    <ol>
      ${brief.actions.map(action => `<li>${action}</li>`).join('')}
    </ol>
  `;
}
```

### Pattern 4: Quota Badge

Show quota status in extension badge:

```javascript
// Background script - check quota every 5 minutes
setInterval(async () => {
  const quotaResponse = await fetch('/api/ext/lexybrain/quota', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (quotaResponse.ok) {
    const quotaData = await quotaResponse.json();

    if (!quotaData.enabled) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    // Update badge based on status
    switch (quotaData.status) {
      case 'exhausted':
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        chrome.action.setBadgeText({ text: '!' });
        break;
      case 'warning':
        chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
        chrome.action.setBadgeText({ text: '⚠' });
        break;
      case 'ok':
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        chrome.action.setBadgeText({ text: '✓' });
        break;
    }

    // Store quota for popup display
    chrome.storage.local.set({ lexybrainQuota: quotaData });
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

### Pattern 5: One-Click Insight Button

Add floating button to marketplace pages:

```javascript
// Content script
function injectInsightButton() {
  const button = document.createElement('button');
  button.className = 'lexybrain-floating-button';
  button.innerHTML = '🧠 Get AI Insight';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 24px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
  `;

  button.addEventListener('click', async () => {
    const keywords = extractKeywordsFromPage();
    const market = detectMarket(window.location.href);

    button.innerHTML = '🧠 Analyzing...';
    button.disabled = true;

    try {
      const insight = await generateQuickInsight("radar", market, keywords);
      showInsightModal(insight.data);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      button.innerHTML = '🧠 Get AI Insight';
      button.disabled = false;
    }
  });

  document.body.appendChild(button);
}

function extractKeywordsFromPage() {
  // Extract keywords from current Etsy/Amazon page
  // This is marketplace-specific logic
  const keywords = [];

  // Example for Etsy search results
  const searchQuery = new URLSearchParams(window.location.search).get('q');
  if (searchQuery) keywords.push(searchQuery);

  // Extract from visible keyword elements
  document.querySelectorAll('.keyword-tag, .search-term').forEach(el => {
    keywords.push(el.textContent.trim());
  });

  return [...new Set(keywords)].slice(0, 5); // Dedupe and limit to 5
}
```

## Best Practices

### 1. Caching Strategy

LexyBrain results are cached server-side, but implement client-side caching too:

```javascript
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedInsight(type, market, keywords) {
  const cacheKey = `lexybrain:${type}:${market}:${keywords.join(',')}`;
  const cached = await chrome.storage.local.get(cacheKey);

  if (cached[cacheKey] && Date.now() - cached[cacheKey].timestamp < CACHE_TTL) {
    return cached[cacheKey].data;
  }

  const fresh = await generateQuickInsight(type, market, keywords);

  await chrome.storage.local.set({
    [cacheKey]: {
      data: fresh,
      timestamp: Date.now()
    }
  });

  return fresh;
}
```

### 2. Rate Limiting

Implement client-side rate limiting to avoid 429 errors:

```javascript
const RATE_LIMIT = 30; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute

class RateLimiter {
  constructor() {
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < RATE_WINDOW);

    if (this.requests.length >= RATE_LIMIT) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = RATE_WINDOW - (now - oldestRequest);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    this.requests.push(now);
  }
}

const limiter = new RateLimiter();

async function generateQuickInsight(type, market, keywords) {
  await limiter.checkLimit();
  // ... make API call
}
```

### 3. Error Handling

Handle errors gracefully with user-friendly messages:

```javascript
async function safeGenerateInsight(type, market, keywords) {
  try {
    return await generateQuickInsight(type, market, keywords);
  } catch (error) {
    if (error.status === 402) {
      // Quota exceeded
      return {
        error: true,
        message: 'You've reached your monthly quota. Upgrade for more insights!',
        action: 'upgrade',
        upgradeUrl: error.upgrade_url
      };
    } else if (error.status === 429) {
      // Rate limit
      return {
        error: true,
        message: 'Too many requests. Please wait a moment.',
        action: 'retry'
      };
    } else {
      // Generic error
      return {
        error: true,
        message: 'Failed to generate insight. Please try again.',
        action: 'retry'
      };
    }
  }
}
```

### 4. Quota Awareness

Show quota status before allowing insights:

```javascript
async function checkQuotaBeforeInsight() {
  const quota = await fetch('/api/ext/lexybrain/quota').then(r => r.json());

  if (quota.status === 'exhausted') {
    showUpgradePrompt(quota.upgrade_url);
    return false;
  }

  if (quota.status === 'warning') {
    const proceed = confirm(
      `You have ${quota.quotas.ai_calls.limit - quota.quotas.ai_calls.used} AI calls remaining. Continue?`
    );
    return proceed;
  }

  return true;
}
```

### 5. Progressive Enhancement

Only show LexyBrain features if available:

```javascript
async function initLexyBrain() {
  const config = await fetch('/api/ext/remote-config').then(r => r.json());

  if (!config.config.lexybrain_extension_enabled) {
    // LexyBrain not available for extension
    document.querySelectorAll('.lexybrain-feature').forEach(el => {
      el.style.display = 'none';
    });
    return;
  }

  // Check quota
  const quota = await fetch('/api/ext/lexybrain/quota').then(r => r.json());

  if (!quota.enabled) {
    // User doesn't have access
    showUpgradeTeaser();
    return;
  }

  // Initialize LexyBrain features
  injectInsightButton();
  enhanceKeywordCards();
  setupQuotaBadge(quota);
}
```

## UI Components

### Insight Modal Template

```html
<div id="lexybrain-modal" class="lexybrain-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>🧠 LexyBrain Insight</h2>
      <button class="close-btn">&times;</button>
    </div>

    <div class="modal-body">
      <div class="insight-type-badge">Market Brief</div>

      <div class="summary-section">
        <h3>Summary</h3>
        <p id="summary-text"></p>
      </div>

      <div class="opportunities-section">
        <h3>Top Opportunities</h3>
        <div id="opportunities-list"></div>
      </div>

      <div class="actions-section">
        <h3>Recommended Actions</h3>
        <ol id="actions-list"></ol>
      </div>

      <div class="confidence-bar">
        <span>Confidence</span>
        <div class="bar">
          <div class="fill" id="confidence-fill"></div>
        </div>
        <span id="confidence-value"></span>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick="window.open('https://app.lexyhub.com/insights', '_blank')">
        View in Dashboard
      </button>
      <button class="btn-primary" onclick="closeModal()">
        Got it!
      </button>
    </div>
  </div>
</div>
```

### Quota Widget Template

```html
<div class="lexybrain-quota-widget">
  <div class="quota-header">
    <span>🧠 AI Quota</span>
    <a href="https://app.lexyhub.com/billing" target="_blank">Upgrade</a>
  </div>

  <div class="quota-meters">
    <div class="quota-item">
      <label>AI Calls</label>
      <div class="meter">
        <div class="meter-fill" style="width: ${percentage}%"></div>
      </div>
      <span>${used} / ${limit}</span>
    </div>

    <div class="quota-item">
      <label>Market Briefs</label>
      <div class="meter">
        <div class="meter-fill" style="width: ${percentage}%"></div>
      </div>
      <span>${used} / ${limit}</span>
    </div>
  </div>
</div>
```

## Testing

### Test Scenarios

1. **Basic Insight Generation**
   - Generate radar insight for single keyword
   - Verify response format and data quality
   - Check cache behavior on repeat requests

2. **Quota Management**
   - Test quota check endpoint
   - Verify 402 response when quota exceeded
   - Confirm quota increments after generation

3. **Rate Limiting**
   - Make 31 requests in 1 minute
   - Verify 429 response on 31st request
   - Confirm rate limit resets after window

4. **Error Handling**
   - Test with invalid insight type
   - Test with empty keywords array
   - Test with unauthenticated request

5. **Remote Config**
   - Disable lexybrain_extension_enabled
   - Verify features are hidden
   - Re-enable and verify features return

### Test Script

```javascript
// test-lexybrain-extension.js
async function testLexyBrainExtension(token) {
  const baseUrl = 'https://app.lexyhub.com';

  // Test 1: Quota check
  console.log('Test 1: Quota check');
  const quotaRes = await fetch(`${baseUrl}/api/ext/lexybrain/quota`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const quotaData = await quotaRes.json();
  console.log('Quota:', quotaData);

  // Test 2: Generate radar insight
  console.log('\nTest 2: Generate radar insight');
  const radarRes = await fetch(`${baseUrl}/api/ext/lexybrain/quick-insight`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'radar',
      market: 'etsy',
      keywords: ['handmade jewelry']
    })
  });
  const radarData = await radarRes.json();
  console.log('Radar insight:', radarData);

  // Test 3: Cache verification
  console.log('\nTest 3: Cache verification');
  const cachedRes = await fetch(`${baseUrl}/api/ext/lexybrain/quick-insight`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'radar',
      market: 'etsy',
      keywords: ['handmade jewelry']
    })
  });
  const cachedData = await cachedRes.json();
  console.log('Cached:', cachedData.cached === true);

  // Test 4: Invalid request
  console.log('\nTest 4: Invalid request');
  const invalidRes = await fetch(`${baseUrl}/api/ext/lexybrain/quick-insight`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'invalid_type',
      market: 'etsy',
      keywords: []
    })
  });
  console.log('Invalid request status:', invalidRes.status);
  console.log('Error:', await invalidRes.json());
}

// Run tests
testLexyBrainExtension('your-extension-token-here');
```

## Deployment

1. **Enable Remote Config Flags**
   ```sql
   INSERT INTO extension_remote_config (key, value) VALUES
     ('lexybrain_extension_enabled', 'true'),
     ('lexybrain_extension_default_type', 'radar'),
     ('lexybrain_extension_show_quota', 'true'),
     ('lexybrain_extension_max_keywords', '10');
   ```

2. **Update Extension Manifest**
   ```json
   {
     "permissions": [
       "storage",
       "contextMenus"
     ],
     "host_permissions": [
       "https://app.lexyhub.com/*"
     ]
   }
   ```

3. **Deploy Extension Update**
   - Add LexyBrain integration code
   - Test in development
   - Submit to Chrome Web Store

4. **Monitor Usage**
   - Track API endpoint metrics
   - Monitor quota consumption
   - Collect user feedback

## Support

For questions or issues:
- Documentation: https://app.lexyhub.com/docs/lexybrain/extension-integration
- API Reference: https://app.lexyhub.com/docs/lexybrain/technical
- Support: support@lexyhub.com
