// extension/popup/popup.js
/**
 * Popup UI logic
 */

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active panel
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
  });
});

// Check auth state on load
chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
  const authPrompt = document.getElementById('authPrompt');
  const discoverContent = document.getElementById('discoverContent');
  const boostBadge = document.getElementById('boostBadge');

  if (response && response.isAuthenticated) {
    authPrompt.style.display = 'none';
    discoverContent.style.display = 'block';
    boostBadge.style.display = 'inline-block';
  } else {
    authPrompt.style.display = 'block';
    discoverContent.style.display = 'none';
  }
});

// Login button
document.getElementById('loginBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://app.lexyhub.com/auth/extension' });
});

// Open options
document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// Load settings
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
  if (response && response.success && response.data) {
    const domains = response.data.enabled_domains || {};
    document.getElementById('domainEtsy').checked = domains.etsy !== false;
    document.getElementById('domainAmazon').checked = domains.amazon !== false;
    document.getElementById('domainShopify').checked = domains.shopify !== false;
  }
});

// Save settings
document.getElementById('saveSettings').addEventListener('click', () => {
  const settings = {
    enabled_domains: {
      etsy: document.getElementById('domainEtsy').checked,
      amazon: document.getElementById('domainAmazon').checked,
      shopify: document.getElementById('domainShopify').checked,
    }
  };

  chrome.runtime.sendMessage(
    { type: 'UPDATE_SETTINGS', payload: settings },
    (response) => {
      if (response && response.success) {
        alert('Settings saved!');
      }
    }
  );
});
