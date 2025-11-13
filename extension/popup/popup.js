// LexyHub Extension Popup
// Main popup interface with tabs

class PopupApp {
  constructor() {
    this.activeTab = 'discover';
    this.authState = null;
    this.user = null;
    this.trendsData = [];
    this.sessionData = null;
    this.briefsData = [];
    this.settings = null;
    this.accountSummary = null;
    this.listenersAttached = false;

    this.init();
  }

  async init() {
    await this.checkAuth();
    this.render();
    this.attachListeners();

    if (this.authState?.isAuthenticated) {
      await this.loadData();
      this.render();
    }
  }

  async checkAuth() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
        this.authState = response;
        this.user = response?.user || null;
        resolve();
      });
    });
  }

  async loadData() {
    await Promise.all([
      this.loadAccountSummary(),
      this.loadTrends(),
      this.loadSession(),
      this.loadBriefs(),
      this.loadSettings()
    ]);
  }

  async loadAccountSummary() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_SUMMARY' }, (response) => {
        if (response?.success) {
          this.accountSummary = response.data;
        }
        resolve();
      });
    });
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
          this.settings = response.data || this.getDefaultSettings();
        } else {
          this.settings = this.getDefaultSettings();
        }
        resolve();
      });
    });
  }

  getDefaultSettings() {
    return {
      enabled_domains: {
        etsy: true,
        amazon: true,
        shopify: true,
        google: true,
        bing: false,
        pinterest: false,
        reddit: false,
      },
      highlight_enabled: true,
      tooltip_enabled: true,
      capture_enabled: true,
      ignored_domains: [],
    };
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
      '<img src="../icons/icon128.png" alt="LexyHub">' +
      '<h2>Welcome to LexyHub</h2>' +
      '<p>Connect your LexyHub account to unlock keyword highlighting and insights across supported marketplaces</p>' +
      '<p style="font-size: 13px; color: #2563eb; margin-top: 8px;">✨ Extension users get extended free quota</p>' +
      '<button class="btn-primary" id="loginBtn">Connect LexyHub (Free)</button>' +
      '<a href="https://lexyhub.com/docs/extension" target="_blank" style="margin-top: 16px; font-size: 12px; color: #6b7280;">Learn More</a>' +
      '</div>';
  }

  renderHeader() {
    const userLabel = this.user?.name || this.user?.email || 'Connected';
    const planName = this.accountSummary?.plan?.display_name || 'Free';
    const isTrial = this.accountSummary?.plan?.is_trial;
    const upgradeUrl = this.accountSummary?.plan?.upgrade_url;
    const searchesUsage = this.accountSummary?.usage?.searches;
    const searchesLeft = searchesUsage
      ? (searchesUsage.limit === -1 ? 'Unlimited' : `${Math.max(searchesUsage.limit - searchesUsage.used, 0)} left`)
      : '--';

    return '<div class="popup-header">' +
      '<a href="https://lexyhub.com/docs/extension/guide" target="_blank" class="help-link" title="Help & Guide">?</a>' +
      '<div class="header-row">' +
      '<div>' +
      '<h1>LexyHub</h1>' +
      '<p class="subtitle">' + userLabel + '</p>' +
      '</div>' +
      (upgradeUrl ? '<button class="btn-secondary btn-upgrade" id="upgradeNow">Upgrade</button>' : '') +
      '</div>' +
      '<div class="plan-summary">' +
      '<span class="plan-chip">' + planName + (isTrial ? '<span class="plan-badge">Trial</span>' : '') + '</span>' +
      '<span class="quota-chip">' + searchesLeft + ' · Searches</span>' +
      '</div>' +
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
    if (!this.trendsData || this.trendsData.length === 0) {
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
      this.trendsData.map((trend) => this.renderTrendItem(trend)).join('') +
      '</div>' +
      '</div>';
  }

  renderTrendItem(trend) {
    const trendValue = typeof trend.trend === 'number' ? trend.trend : 0;
    const status = trendValue > 0.15 ? 'up' : trendValue < -0.15 ? 'down' : 'flat';
    const trendIcon = status === 'up' ? '↑' : status === 'down' ? '↓' : '→';
    const freshness = typeof trend.freshness_days === 'number'
      ? (trend.freshness_days === 0 ? 'Today' : `${trend.freshness_days}d ago`)
      : (trend.freshness || 'Fresh');
    const aiScore = Math.round(trend.ai_score || 0);

    return '<div class="trend-item" data-term="' + trend.term + '">' +
      '<div class="trend-info">' +
      '<div class="trend-term">' + trend.term + '</div>' +
      '<div class="trend-meta">' +
      '<span class="trend-badge ' + status + '">' + trendIcon + ' ' + status + '</span>' +
      '<span>AI Score: ' + aiScore + '</span>' +
      '<span>' + freshness + '</span>' +
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
    if (!this.briefsData || this.briefsData.length === 0) {
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
    const settings = this.settings || this.getDefaultSettings();
    const ignoredDomains = settings.ignored_domains || [];
    const domainList = ['etsy', 'amazon', 'shopify', 'google', 'bing', 'pinterest', 'reddit'];

    const domainsHtml = domainList.map((domain) => {
      const enabled = settings.enabled_domains?.[domain] !== false;
      return '<div class="setting-item">' +
        '<div class="setting-row">' +
        '<div>' +
        '<div class="setting-label">' + this.capitalize(domain) + '</div>' +
        '<div class="setting-description">Highlight keywords on ' + domain + '</div>' +
        '</div>' +
        '<div class="toggle-switch ' + (enabled ? 'active' : '') + '" data-setting="domain" data-key="' + domain + '"></div>' +
        '</div>' +
        '</div>';
    }).join('');

    return '<div class="settings-section" style="border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px;">' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div>' +
      '<div class="setting-label" style="font-size: 15px; font-weight: 600;">Keyword Highlighting</div>' +
      '<div class="setting-description">Enable keyword highlights on supported sites</div>' +
      '</div>' +
      '<div class="toggle-switch ' + (settings.highlight_enabled !== false ? 'active' : '') + '" data-setting="highlight_enabled" style="transform: scale(1.1);"></div>' +
      '</div></div>' +
      '</div>' +
      '<div class="settings-section">' +
      '<h4>Enabled Domains</h4>' +
      domainsHtml +
      (ignoredDomains.length > 0 ?
        '<div style="margin-top: 12px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 12px;">' +
        '<strong>Ignored domains:</strong> ' + ignoredDomains.join(', ') +
        '</div>' : '') +
      '</div>' +
      '<div class="settings-section">' +
      '<h4>Features</h4>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div><div class="setting-label">Tooltips</div><div class="setting-description">Show metrics on hover</div></div>' +
      '<div class="toggle-switch ' + (settings.tooltip_enabled !== false ? 'active' : '') + '" data-setting="tooltip_enabled"></div>' +
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
    const searches = this.accountSummary?.usage?.searches;
    const watchlist = this.accountSummary?.usage?.watchlist;

    return '<div class="popup-footer">' +
      '<div class="quota-info-row">' +
      this.renderQuotaStat('Searches', searches) +
      this.renderQuotaStat('Watchlist', watchlist) +
      '</div>' +
      '<div class="footer-links">' +
      '<a href="https://lexyhub.com/docs/extension" target="_blank" class="footer-link">Docs</a>' +
      '<a href="https://lexyhub.com/support" target="_blank" class="footer-link">Support</a>' +
      '</div>' +
      '</div>';
  }

  renderQuotaStat(label, usage) {
    if (!usage) {
      return '<div class="quota-info"><span class="quota-label">' + label + '</span><span class="quota-value">--</span></div>';
    }

    const limitText = usage.limit === -1 ? '∞' : usage.limit;
    const remaining = usage.limit === -1 ? 'Unlimited' : Math.max(usage.limit - usage.used, 0) + ' left';

    return '<div class="quota-info ' + usage.warningLevel + '">' +
      '<span class="quota-label">' + label + '</span>' +
      '<span class="quota-value">' + usage.used + '/' + limitText + '</span>' +
      '<span class="quota-remaining">' + remaining + '</span>' +
      '</div>';
  }

  attachListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

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

      if (target.id === 'upgradeNow' && this.accountSummary?.plan?.upgrade_url) {
        chrome.tabs.create({ url: this.accountSummary.plan.upgrade_url });
      }

      if (target.classList.contains('tab')) {
        this.activeTab = target.dataset.tab;
        this.render();
      }

      if (target.dataset?.action === 'add') {
        const term = target.dataset.term;
        this.addToWatchlist(term, target);
      }

      if (target.id === 'refreshTrends') {
        this.loadTrends().then(() => this.render());
      }

      if (target.id === 'endSession') {
        chrome.runtime.sendMessage({ type: 'END_SESSION' }, () => {
          this.sessionData = null;
          this.render();
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

  async addToWatchlist(term, btn) {
    if (!term) return;

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
      if (response?.success && btn) {
        btn.textContent = '✓ Added';
        btn.disabled = true;
        btn.style.background = '#10b981';
      }
    });
  }

  updateSetting(toggle) {
    if (!this.settings) {
      this.settings = this.getDefaultSettings();
    }

    const setting = toggle.dataset.setting;
    const key = toggle.dataset.key;
    const value = toggle.classList.contains('active');

    let update = {};
    if (setting === 'domain' && key) {
      this.settings.enabled_domains[key] = value;
      update = {
        enabled_domains: this.settings.enabled_domains
      };
    } else {
      this.settings[setting] = value;
      update = { [setting]: value };
    }

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: update
    });
  }

  formatDuration(startTime) {
    if (!startTime) return '--';
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return '--';
    const diffMs = Date.now() - start.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    return minutes + 'm';
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
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
