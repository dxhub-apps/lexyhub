// LexyHub Extension Options Page
class OptionsPage {
  constructor() {
    this.settings = null;
    this.authState = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.render();
    this.attachListeners();
  }

  async loadData() {
    const authPromise = new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
        this.authState = response;
        resolve();
      });
    });

    const settingsPromise = new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        this.settings = response?.data || this.getDefaultSettings();
        resolve();
      });
    });

    await Promise.all([authPromise, settingsPromise]);
  }

  getDefaultSettings() {
    return {
      enabled_domains: {
        etsy: true,
        amazon: true,
        shopify: true,
        google: false,
        bing: false,
        pinterest: false,
        reddit: false
      },
      highlight_enabled: true,
      tooltip_enabled: true,
      capture_enabled: true,
      community_signal_opt_in: false,
      highlight_color: 'yellow',
      tooltip_delay_ms: 300,
      animation_enabled: true
    };
  }

  render() {
    const root = document.getElementById('root');

    if (!this.authState?.isAuthenticated) {
      root.innerHTML = this.renderNotAuthenticated();
      return;
    }

    root.innerHTML = this.renderDomainSettings() +
      this.renderFeatureSettings() +
      this.renderPrivacySettings() +
      this.renderDisplaySettings() +
      this.renderAccountSection() +
      this.renderFooter();
  }

  renderNotAuthenticated() {
    return '<div class="settings-section">' +
      '<div class="alert alert-info">Please sign in to the extension to access settings.</div>' +
      '<button class="btn btn-primary" id="signInBtn">Sign In</button>' +
      '</div>';
  }

  renderDomainSettings() {
    const domains = [
      { id: 'etsy', name: 'Etsy', desc: 'Etsy marketplace' },
      { id: 'amazon', name: 'Amazon', desc: 'Amazon marketplaces' },
      { id: 'shopify', name: 'Shopify', desc: 'Shopify stores' },
      { id: 'google', name: 'Google', desc: 'Google Search' },
      { id: 'bing', name: 'Bing', desc: 'Bing Search' },
      { id: 'pinterest', name: 'Pinterest', desc: 'Pinterest boards' },
      { id: 'reddit', name: 'Reddit', desc: 'Reddit communities' }
    ];

    return '<div class="settings-section">' +
      '<h2>Supported Sites</h2>' +
      '<p>Choose which websites to enable keyword highlighting and capture</p>' +
      '<div class="domain-grid">' +
      domains.map(domain => {
        const isActive = this.settings.enabled_domains[domain.id];
        return '<div class="domain-card ' + (isActive ? 'active' : '') + '" data-domain="' + domain.id + '">' +
          '<span class="check-icon">✓</span>' +
          '<h4>' + domain.name + '</h4>' +
          '<p>' + domain.desc + '</p>' +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>';
  }

  renderFeatureSettings() {
    return '<div class="settings-section">' +
      '<h2>Features</h2>' +
      '<p>Enable or disable extension features</p>' +
      this.renderToggle('highlight_enabled', 'Keyword Highlighting', 'Highlight watchlist keywords on pages') +
      this.renderToggle('tooltip_enabled', 'Metrics Tooltips', 'Show keyword metrics on hover') +
      this.renderToggle('capture_enabled', 'Auto-Capture', 'Automatically discover and track keywords') +
      this.renderToggle('animation_enabled', 'Animations', 'Enable smooth animations and transitions') +
      '</div>';
  }

  renderPrivacySettings() {
    return '<div class="settings-section">' +
      '<h2>Privacy & Data</h2>' +
      '<p>Control what data is collected and shared</p>' +
      '<div class="alert alert-info">' +
      'LexyHub respects your privacy. We only collect normalized keyword terms, no personal information.' +
      '</div>' +
      this.renderToggle('community_signal_opt_in', 'Community Signals', 'Share anonymous keyword discovery data to help identify trending terms') +
      '<div class="button-group">' +
      '<button class="btn btn-secondary" id="exportDataBtn">Export My Data</button>' +
      '<button class="btn btn-danger" id="deleteDataBtn">Delete My Data</button>' +
      '</div>' +
      '</div>';
  }

  renderDisplaySettings() {
    const colors = ['yellow', 'green', 'blue', 'pink'];
    return '<div class="settings-section">' +
      '<h2>Display Preferences</h2>' +
      '<p>Customize how keywords are highlighted</p>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div class="setting-info">' +
      '<h3>Highlight Color</h3>' +
      '<p>Choose the color for highlighted keywords</p>' +
      '</div>' +
      '<select id="highlightColor" class="form-select">' +
      colors.map(color =>
        '<option value="' + color + '" ' + (this.settings.highlight_color === color ? 'selected' : '') + '>' +
        color.charAt(0).toUpperCase() + color.slice(1) +
        '</option>'
      ).join('') +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div class="setting-info">' +
      '<h3>Tooltip Delay</h3>' +
      '<p>Time before tooltip appears (milliseconds)</p>' +
      '</div>' +
      '<input type="number" id="tooltipDelay" value="' + this.settings.tooltip_delay_ms + '" min="0" max="2000" step="100" style="width: 100px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  renderAccountSection() {
    return '<div class="settings-section">' +
      '<h2>Account</h2>' +
      '<div class="account-section">' +
      '<div class="account-card">' +
      '<h3>Plan</h3>' +
      '<div class="account-value">Free</div>' +
      '<span class="plan-badge">Extension Boost Active</span>' +
      '</div>' +
      '<div class="account-card">' +
      '<h3>Quota</h3>' +
      '<div class="account-value">25/25</div>' +
      '<p style="margin-top: 8px; font-size: 13px;">Searches remaining this month</p>' +
      '</div>' +
      '</div>' +
      '<div class="button-group" style="margin-top: 20px;">' +
      '<button class="btn btn-primary" id="upgradeBtn">Upgrade Plan</button>' +
      '<button class="btn btn-secondary" id="logoutBtn">Logout</button>' +
      '</div>' +
      '</div>';
  }

  renderFooter() {
    return '<div class="footer">' +
      '<p>LexyHub Extension v1.0.0</p>' +
      '<p>' +
      '<a href="https://lexyhub.com/docs/extension" target="_blank">Documentation</a> | ' +
      '<a href="https://lexyhub.com/docs/extension/guide" target="_blank">User Guide</a> | ' +
      '<a href="https://lexyhub.com/privacy" target="_blank">Privacy Policy</a> | ' +
      '<a href="https://lexyhub.com/support" target="_blank">Support</a>' +
      '</p>' +
      '</div>';
  }

  renderToggle(key, label, description) {
    const isActive = this.settings[key];
    return '<div class="setting-item">' +
      '<div class="setting-row">' +
      '<div class="setting-info">' +
      '<h3>' + label + '</h3>' +
      '<p>' + description + '</p>' +
      '</div>' +
      '<div class="toggle-switch ' + (isActive ? 'active' : '') + '" data-setting="' + key + '"></div>' +
      '</div>' +
      '</div>';
  }

  attachListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;

      if (target.classList.contains('domain-card')) {
        this.toggleDomain(target);
      }

      if (target.classList.contains('toggle-switch')) {
        this.toggleSetting(target);
      }

      if (target.id === 'signInBtn') {
        chrome.runtime.sendMessage({ type: 'INITIATE_LOGIN' });
      }

      if (target.id === 'logoutBtn') {
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
          window.location.reload();
        });
      }

      if (target.id === 'upgradeBtn') {
        chrome.tabs.create({ url: 'https://app.lexyhub.com/pricing' });
      }

      if (target.id === 'exportDataBtn') {
        this.exportData();
      }

      if (target.id === 'deleteDataBtn') {
        if (confirm('Are you sure you want to delete all your extension data? This cannot be undone.')) {
          this.deleteData();
        }
      }
    });

    document.addEventListener('change', (e) => {
      const target = e.target;

      if (target.id === 'highlightColor') {
        this.updateSetting('highlight_color', target.value);
      }

      if (target.id === 'tooltipDelay') {
        this.updateSetting('tooltip_delay_ms', parseInt(target.value));
      }
    });
  }

  toggleDomain(card) {
    card.classList.toggle('active');
    const domain = card.dataset.domain;
    const isActive = card.classList.contains('active');

    this.settings.enabled_domains[domain] = isActive;
    this.updateSetting('enabled_domains', this.settings.enabled_domains);
  }

  toggleSetting(toggle) {
    toggle.classList.toggle('active');
    const key = toggle.dataset.setting;
    const value = toggle.classList.contains('active');

    this.settings[key] = value;
    this.updateSetting(key, value);
  }

  updateSetting(key, value) {
    const update = {};
    update[key] = value;

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: update
    });
  }

  async exportData() {
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (response) => {
      if (response?.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'lexyhub-extension-data.json';
        link.click();
      }
    });
  }

  async deleteData() {
    chrome.runtime.sendMessage({ type: 'DELETE_DATA' }, (response) => {
      if (response?.success) {
        alert('All data has been deleted.');
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
          window.location.reload();
        });
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OptionsPage();
});
