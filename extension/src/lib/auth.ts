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
   */
  async initiateLogin(): Promise<void> {
    const loginUrl = "https://app.lexyhub.com/auth/extension";
    await chrome.tabs.create({ url: loginUrl });
  }

  /**
   * Handle auth callback with token
   * Called when user completes login flow
   */
  async handleAuthCallback(token: string, user: User): Promise<void> {
    await this.setToken(token);
    await this.setUser(user);
  }
}
