// LexyHub Extension Popup
// Main popup interface with tabs

class PopupApp {
  constructor() {
    this.activeTab = 'discover';
    this.authState = null;
    this.trendsData = [];
    this.sessionData = null;
    this.briefsData = [];
    this.settings = null;

    this.init();
  }

  async init() {
    await this.checkAuth();
    this.render();
    this.attachListeners();

    if (this.authState?.isAuthenticated) {
      this.loadData();
    }
  }

  async checkAuth() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
        this.authState = response;
        resolve();
      });
    });
  }

  async loadData() {
    await Promise.all([
      this.loadTrends(),
      this.loadSession(),
      this.loadBriefs(),
      this.loadSettings()
    ]);
    this.render();
  }

  async loadTrends() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const market = this.detectMarket(tab?.url || '');

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_TRENDING',
        payload: { market, limit: 10 }
      }, (response) => {
        if (response?.success) {
          this.trendsData = response.data || [];
        }
        resolve();
      });
    });
  }

  async loadSession() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_CURRENT_SESSION'
      }, (response) => {
        if (response?.success) {
          this.sessionData = response.data;
        }
        resolve();
      });
    });
  }

  async loadBriefs() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_BRIEFS',
        payload: { limit: 5 }
      }, (response) => {
        if (response?.success) {
          this.briefsData = response.data || [];
        }
        resolve();
      });
    });
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      }, (response) => {
        if (response?.success) {
          this.settings = response.data || {};
        }
        resolve();
      });
    });
  }

  detectMarket(url) {
    if (url.includes('etsy.com')) return 'etsy';
    if (url.includes('amazon.')) return 'amazon';
    if (url.includes('google.com/search')) return 'google';
    if (url.includes('pinterest.')) return 'pinterest';
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('bing.com')) return 'bing';
    return 'shopify';
  }

  render() {
    const root = document.getElementById('root');

    if (!this.authState?.isAuthenticated) {
      root.innerHTML = this.renderLoginScreen();
      return;
    }

    root.innerHTML = '<div class="popup-container">' +
      this.renderHeader() +
      this.renderTabs() +
      '<div class="tab-content">' + this.renderTabContent() + '</div>' +
      this.renderFooter() +
      '</div>';
  }

  renderLoginScreen() {
    return '<div class="login-screen">' +
      '<img src="../icons/icon-128.png" alt="LexyHub">' +
      '<h2>Welcome to LexyHub</h2>' +
      '<p>Sign in to start capturing keywords and get real-time insights</p>' +
      '<button class="btn-primary" id="loginBtn">Sign In</button>' +
      '<a href="https://lexyhub.com/docs/extension" target="_blank" style="margin-top: 16px; font-size: 12px; color: #6b7280;">Learn More</a>' +
      '</div>';
  }

  renderHeader() {
    return '<div class="popup-header">' +
      '<h1>LexyHub</h1>' +
      '<p class="subtitle">Keyword Intelligence</p>' +
      '<a href="https://lexyhub.com/docs/extension/guide" target="_blank" class="help-link" title="Help & Guide">?</a>' +
      '</div>';
  }

  renderTabs() {
    const tabs = [
      { id: 'discover', label: 'Discover' },
      { id: 'session', label: 'Session' },
      { id: 'briefs', label: 'Briefs' },
      { id: 'settings', label: 'Settings' }
    ];

    return '<div class="tabs">' +
      tabs.map(tab =>
        '<button class="tab ' + (this.activeTab === tab.id ? 'active' : '') + '" data-tab="' + tab.id + '">' +
        tab.label +
        '</button>'
      ).join('') +
      '</div>';
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'discover':
        return this.renderDiscoverTab();
      case 'session':
        return this.renderSessionTab();
      case 'briefs':
        return this.renderBriefsTab();
      case 'settings':
        return this.renderSettingsTab();
      default:
        return '';
    }
  }

  renderDiscoverTab() {
    if (this.trendsData.length === 0) {
      return '<div class="empty-state">' +
        '<p>No trending keywords yet<br><small>Visit supported sites to discover keywords</small></p>' +
        '</div>';
    }

    return '<div class="trending-section">' +
      '<div class="section-header">' +
      '<h3>Trending Keywords</h3>' +
      '<button class="btn-secondary" id="refreshTrends">Refresh</button>' +
      '</div>' +
      '<div class="trend-list">' +
      this.trendsData.map((trend, index) => this.renderTrendItem(trend, index)).join('') +
      '</div>' +
      '</div>';
  }

  renderTrendItem(trend, index) {
    const trendIcon = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→';
    return '<div class="trend-item" data-term="' + trend.term + '">' +
      '<div class="trend-info">' +
      '<div class="trend-term">' + trend.term + '</div>' +
      '<div class="trend-meta">' +
      '<span class="trend-badge ' + trend.trend + '">' + trendIcon + ' ' + trend.trend + '</span>' +
      '<span>Score: ' + (trend.ai_score || 0) + '</span>' +
      '<span>' + (trend.freshness || 'New') + '</span>' +
      '</div>' +
      '</div>' +
      '<button class="add-btn" data-action="add" data-term="' + trend.term + '">+ Add</button>' +
      '</div>';
  }

  renderSessionTab() {
    if (!this.sessionData) {
      return '<div class="empty-state">' +
        '<p>No active session<br><small>Start browsing to begin tracking</small></p>' +
        '</div>';
    }

    const stats = {
      queries: this.sessionData.search_queries?.length || 0,
      terms: this.sessionData.terms_discovered?.length || 0,
      clicks: this.sessionData.clicked_listings?.length || 0
    };

    return '<div class="session-stats">' +
      '<div class="stat-card"><div class="stat-label">Searches</div><div class="stat-value">' + stats.queries + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Terms Found</div><div class="stat-value">' + stats.terms + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Clicks</div><div class="stat-value">' + stats.clicks + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Duration</div><div class="stat-value">' + this.formatDuration(this.sessionData.started_at) + '</div></div>' +
      '</div>' +
      (this.sessionData.terms_discovered?.length > 0 ?
        '<div class="session-details">' +
        '<h4>Discovered Keywords</h4>' +
        '<div class="keyword-list">' +
        this.sessionData.terms_discovered.map(term => '<span class="keyword-chip">' + term + '</span>').join('') +
        '</div>' +
        '</div>' : '') +
      '<button class="btn-primary" id="endSession" style="margin-top: 16px; width: 100%;">End Session & Save</button>';
  }

  renderBriefsTab() {
    if (this.briefsData.length === 0) {
      return '<div class="empty-state">' +
        '<p>No briefs yet<br><small>Create a brief from selected keywords</small></p>' +
        '</div>';
    }

    return '<div>' + this.briefsData.map(brief => this.renderBriefCard(brief)).join('') + '</div>';
  }

  renderBriefCard(brief) {
    return '<div class="brief-card" data-brief-id="' + brief.id + '">' +
      '<div class="brief-title">' + brief.title + '</div>' +
      '<div class="brief-meta">' +
      '<span>' + brief.market + '</span>' +
      '<span>' + (brief.terms?.length || 0) + ' keywords</span>' +
      '<span>' + this.formatDate(brief.created_at) + '</span>' +
      '</div>' +
      '<div class="brief-summary">' + (brief.executive_summary || 'Click to view details') + '</div>' +
      '</div>';
  }

  renderSettingsTab() {
    const settings = this.settings || {};
    const domains = settings.enabled_domains || {};

    let domainsHtml = '';
    for (const [domain, enabled] of Object.entries(domains)) {
      domainsHtml += '<div class="setting-item">' +
        '<div class="setting-row">' +
        '<div>' +
        '<div class="setting-label">' + this.capitalize(domain) + '</div>' +
        '<div class="setting-description">Highlight keywords on ' + domain + '</div>' +
        '</div>' +
        '<div class="toggle-switch ' + (enabled ? 'active' : '') + '" data-setting="domain" data-key="' + domain + '"></div>' +
        '</div>' +
        '</div>';
    }

    return '<div class="settings-section">' +
      '<h4>Enabled Domains</h4>' +
      domainsHtml +
      '</div>' +
      '<div class="settings-section">' +
      '<h4>Features</h4>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div><div class="setting-label">Highlighting</div><div class="setting-description">Show keyword highlights on pages</div></div>' +
      '<div class="toggle-switch ' + (settings.highlight_enabled ? 'active' : '') + '" data-setting="highlight_enabled"></div>' +
      '</div></div>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div><div class="setting-label">Tooltips</div><div class="setting-description">Show metrics on hover</div></div>' +
      '<div class="toggle-switch ' + (settings.tooltip_enabled ? 'active' : '') + '" data-setting="tooltip_enabled"></div>' +
      '</div></div>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div><div class="setting-label">Auto-Capture</div><div class="setting-description">Automatically discover keywords</div></div>' +
      '<div class="toggle-switch ' + (settings.capture_enabled !== false ? 'active' : '') + '" data-setting="capture_enabled"></div>' +
      '</div></div>' +
      '</div>' +
      '<div class="settings-section">' +
      '<h4>Account</h4>' +
      '<button class="btn-secondary" id="openOptions" style="width: 100%; margin-bottom: 8px;">Open Full Settings</button>' +
      '<button class="btn-secondary" id="logoutBtn" style="width: 100%;">Logout</button>' +
      '</div>';
  }

  renderFooter() {
    return '<div class="popup-footer">' +
      '<div class="quota-info"><span class="quota-value">--</span> searches left</div>' +
      '<div class="footer-links">' +
      '<a href="https://lexyhub.com/docs/extension" target="_blank" class="footer-link">Docs</a>' +
      '<a href="https://lexyhub.com/support" target="_blank" class="footer-link">Support</a>' +
      '</div>' +
      '</div>';
  }

  attachListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;

      if (target.id === 'loginBtn') {
        chrome.runtime.sendMessage({ type: 'INITIATE_LOGIN' });
      }

      if (target.id === 'logoutBtn') {
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
          window.close();
        });
      }

      if (target.classList.contains('tab')) {
        this.activeTab = target.dataset.tab;
        this.render();
        this.attachListeners();
      }

      if (target.dataset.action === 'add') {
        const term = target.dataset.term;
        this.addToWatchlist(term);
      }

      if (target.id === 'refreshTrends') {
        this.loadTrends().then(() => {
          this.render();
          this.attachListeners();
        });
      }

      if (target.id === 'endSession') {
        chrome.runtime.sendMessage({ type: 'END_SESSION' }, () => {
          this.sessionData = null;
          this.render();
          this.attachListeners();
        });
      }

      if (target.closest('.brief-card')) {
        const briefId = target.closest('.brief-card').dataset.briefId;
        chrome.tabs.create({ url: 'https://app.lexyhub.com/briefs/' + briefId });
      }

      if (target.classList.contains('toggle-switch')) {
        target.classList.toggle('active');
        this.updateSetting(target);
      }

      if (target.id === 'openOptions') {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  async addToWatchlist(term) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const market = this.detectMarket(tab?.url || '');

    chrome.runtime.sendMessage({
      type: 'ADD_TO_WATCHLIST',
      payload: {
        term,
        market,
        source_url: tab?.url
      }
    }, (response) => {
      if (response?.success) {
        const btn = document.querySelector('[data-term="' + term + '"]');
        if (btn) {
          btn.textContent = '✓ Added';
          btn.disabled = true;
          btn.style.background = '#10b981';
        }
      }
    });
  }

  updateSetting(toggle) {
    const setting = toggle.dataset.setting;
    const key = toggle.dataset.key;
    const value = toggle.classList.contains('active');

    let update = {};
    if (setting === 'domain' && key) {
      update = {
        enabled_domains: Object.assign({}, this.settings.enabled_domains, { [key]: value })
      };
    } else {
      update = { [setting]: value };
    }

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: update
    });
  }

  formatDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const minutes = Math.floor(diffMs / 60000);
    return minutes + 'm';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    return date.toLocaleDateString();
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});
