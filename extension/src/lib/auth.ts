// extension/src/lib/auth.ts
/**
 * Authentication manager for LexyHub extension
 * Handles JWT token storage and validation
 */

import type { StorageManager } from "./storage";

const AUTH_TOKEN_KEY = "lexy_auth_token";
const AUTH_USER_KEY = "lexy_auth_user";

export interface User {
  id: string;
  email: string;
  name?: string;
}

export class AuthManager {
  constructor(private storage: StorageManager) {}

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    // TODO: Optionally validate token expiry
    return true;
  }

  /**
   * Get stored authentication token
   */
  async getToken(): Promise<string | null> {
    return this.storage.get<string>(AUTH_TOKEN_KEY);
  }

  /**
   * Store authentication token
   */
  async setToken(token: string): Promise<void> {
    await this.storage.set(AUTH_TOKEN_KEY, token);
  }

  /**
   * Get stored user info
   */
  async getUser(): Promise<User | null> {
    return this.storage.get<User>(AUTH_USER_KEY);
  }

  /**
   * Store user info
   */
  async setUser(user: User): Promise<void> {
    await this.storage.set(AUTH_USER_KEY, user);
  }

  /**
   * Clear authentication state (logout)
   */
  async logout(): Promise<void> {
    await this.storage.remove(AUTH_TOKEN_KEY);
    await this.storage.remove(AUTH_USER_KEY);
  }

  /**
   * Initialize auth from LexyHub web app
   * Opens OAuth flow in new tab
   * Uses extension-signup URL to track signup_source and apply bonus quota
   */
  async initiateLogin(): Promise<void> {
    const loginUrl = "https://lexyhub.com/extension-signup?ref=chrome";
    await chrome.tabs.create({ url: loginUrl });

    // The auth page will store credentials in its localStorage
    // Extension will check for them when user returns
    this.startPollingForAuth();
  }

  /**
   * Poll for authentication from localStorage (set by auth page)
   * This is a fallback method since direct postMessage doesn't work cross-origin
   */
  private startPollingForAuth(): void {
    const checkInterval = setInterval(async () => {
      try {
        // Query all tabs for the auth page (support both old and new URLs)
        const tabs = await chrome.tabs.query({
          url: [
            "https://lexyhub.com/extension-signup*",
            "https://app.lexyhub.com/auth/extension*",
          ],
        });

        if (tabs.length > 0 && tabs[0].id) {
          // Execute script to check localStorage
          const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              const token = localStorage.getItem("lexyhub_ext_token");
              const userStr = localStorage.getItem("lexyhub_ext_user");
              if (token && userStr) {
                // Clear the items so we don't reuse them
                localStorage.removeItem("lexyhub_ext_token");
                localStorage.removeItem("lexyhub_ext_user");
                return { token, user: JSON.parse(userStr) };
              }
              return null;
            },
          });

          if (results && results[0]?.result) {
            const { token, user } = results[0].result;
            await this.handleAuthCallback(token, user);
            clearInterval(checkInterval);

            // Close the auth tab
            if (tabs[0].id) {
              await chrome.tabs.remove(tabs[0].id);
            }
          }
        }
      } catch (err) {
        // Tab might be closed or script injection failed
        // Continue polling
      }
    }, 1000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
  }

  /**
   * Handle auth callback with token
   * Called when user completes login flow
   */
  async handleAuthCallback(token: string, user: User): Promise<void> {
    await this.setToken(token);
    await this.setUser(user);
    console.log("[Auth] Successfully authenticated user:", user.email);
  }
}
