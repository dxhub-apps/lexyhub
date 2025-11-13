// extension/src/lib/content-helpers.ts
/**
 * Shared helper functions for content scripts
 */

/**
 * Check if highlighting should be enabled based on settings
 * Returns true if highlighting should proceed, false if it should be blocked
 */
export async function shouldEnableHighlighting(
  marketDomain: string
): Promise<{ enabled: boolean; reason?: string }> {
  // Get settings from background
  const settings = await getSettings();

  // Check global highlighting toggle
  if (settings?.highlight_enabled === false) {
    return {
      enabled: false,
      reason: "Global highlighting is disabled",
    };
  }

  // Check if current domain is in ignore list
  const currentDomain = window.location.hostname;
  if ((settings?.ignored_domains || []).includes(currentDomain)) {
    return {
      enabled: false,
      reason: `Domain ${currentDomain} is in ignore list`,
    };
  }

  // Check if specific market domain is enabled
  const domainPreference = settings?.enabled_domains?.[marketDomain];
  if (domainPreference === false) {
    return {
      enabled: false,
      reason: `${marketDomain} domain is disabled`,
    };
  }

  return { enabled: true };
}

/**
 * Check if user is authenticated
 */
export async function checkAuthentication(): Promise<{
  authenticated: boolean;
  reason?: string;
}> {
  const authState = await getAuthState();

  if (!authState?.isAuthenticated) {
    return {
      authenticated: false,
      reason: "User not authenticated",
    };
  }

  return { authenticated: true };
}

/**
 * Get settings from background script
 */
export function getSettings(): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      resolve(response?.success ? response.data : null);
    });
  });
}

/**
 * Get auth state from background script
 */
export function getAuthState(): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (response) => {
      resolve(response || null);
    });
  });
}

/**
 * Get watchlist for a specific market
 */
export function getWatchlist(market: string): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "GET_WATCHLIST",
        payload: { market },
      },
      (response) => {
        if (response?.success && response.data?.terms) {
          resolve(response.data.terms);
        } else {
          resolve([]);
        }
      }
    );
  });
}
