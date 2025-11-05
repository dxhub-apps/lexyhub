// extension/options/options.js
/**
 * Options page logic
 */

let currentSettings = {
  enabled_domains: {
    etsy: true,
    amazon: true,
    shopify: true,
  },
  highlight_enabled: true,
  tooltip_enabled: true,
  capture_enabled: true,
};

// Toggle functionality
document.querySelectorAll('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
  });
});

// Check auth state
chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
  const authStatus = document.getElementById('authStatus');
  const authStatusText = document.getElementById('authStatusText');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (response && response.isAuthenticated) {
    authStatus.classList.remove('disconnected');
    authStatusText.textContent = 'Connected to LexyHub';
    logoutBtn.style.display = 'inline-block';
  } else {
    authStatus.classList.add('disconnected');
    authStatusText.textContent = 'Not connected';
    loginBtn.style.display = 'inline-block';
  }
});

// Load settings
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
  if (response && response.success && response.data) {
    currentSettings = response.data;

    // Update toggles
    const domains = currentSettings.enabled_domains || {};
    updateToggle('etsy', domains.etsy !== false);
    updateToggle('amazon', domains.amazon !== false);
    updateToggle('shopify', domains.shopify !== false);
    updateToggle('highlights', currentSettings.highlight_enabled !== false);
    updateToggle('tooltips', currentSettings.tooltip_enabled !== false);
    updateToggle('capture', currentSettings.capture_enabled !== false);
  }
});

function updateToggle(setting, active) {
  const toggle = document.querySelector(`.toggle[data-setting="${setting}"]`);
  if (toggle) {
    if (active) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }
}

function getToggleState(setting) {
  const toggle = document.querySelector(`.toggle[data-setting="${setting}"]`);
  return toggle ? toggle.classList.contains('active') : true;
}

// Save button
document.getElementById('saveBtn').addEventListener('click', () => {
  const settings = {
    enabled_domains: {
      etsy: getToggleState('etsy'),
      amazon: getToggleState('amazon'),
      shopify: getToggleState('shopify'),
    },
    highlight_enabled: getToggleState('highlights'),
    tooltip_enabled: getToggleState('tooltips'),
    capture_enabled: getToggleState('capture'),
  };

  chrome.runtime.sendMessage(
    { type: 'UPDATE_SETTINGS', payload: settings },
    (response) => {
      if (response && response.success) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings. Please try again.');
      }
    }
  );
});

// Login button
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    console.log('[LexyHub] Login button clicked in options');
    // Send message to background script to initiate login with polling
    chrome.runtime.sendMessage({ type: 'INITIATE_LOGIN' }, (response) => {
      console.log('[LexyHub] INITIATE_LOGIN response:', response);
      if (response && response.success) {
        console.log('[LexyHub] Login initiated successfully');
        // Optionally close the options page or show a message
      } else {
        console.error('[LexyHub] Failed to initiate login:', response);
        alert('Failed to initiate login. Please try again.');
      }
    });
  });
} else {
  console.error('[LexyHub] Login button not found in options DOM');
}

// Logout button
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to sign out?')) {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, (response) => {
      if (response && response.success) {
        // Update UI
        const authStatus = document.getElementById('authStatus');
        const authStatusText = document.getElementById('authStatusText');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        authStatus.classList.add('disconnected');
        authStatusText.textContent = 'Not connected';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';

        alert('Successfully signed out');
      } else {
        alert('Failed to sign out. Please try again.');
      }
    });
  }
});

// Clear data button
document.getElementById('clearDataBtn').addEventListener('click', () => {
  if (confirm('This will clear all extension data including watchlists and settings. Are you sure?')) {
    chrome.storage.sync.clear(() => {
      chrome.storage.local.clear(() => {
        alert('Extension data cleared. Please reload the extension.');
      });
    });
  }
});
