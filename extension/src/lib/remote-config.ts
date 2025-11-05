// extension/src/lib/remote-config.ts
/**
 * Remote config manager for kill-switch and feature flags
 */

import type { StorageManager } from "./storage";

const REMOTE_CONFIG_URL = "https://app.lexyhub.com/api/ext/config";
const REMOTE_CONFIG_KEY = "remote_config";
const CONFIG_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export interface RemoteConfigData {
  enabled: boolean;
  domains: {
    [domain: string]: {
      enabled: boolean;
      selectors?: Record<string, string>;
    };
  };
  features: {
    highlights: boolean;
    tooltips: boolean;
    capture: boolean;
  };
  version: string;
  updated_at: string;
}

export class RemoteConfig {
  private config: RemoteConfigData | null = null;
  private lastFetchedAt: number = 0;

  constructor(private storage: StorageManager) {
    this.loadFromCache();
  }

  /**
   * Load config from local storage cache
   */
  private async loadFromCache(): Promise<void> {
    try {
      const cached = await this.storage.getLocal<{
        config: RemoteConfigData;
        fetchedAt: number;
      }>(REMOTE_CONFIG_KEY);

      if (cached) {
        this.config = cached.config;
        this.lastFetchedAt = cached.fetchedAt;
      }
    } catch (error) {
      console.error("[RemoteConfig] Error loading from cache:", error);
    }
  }

  /**
   * Fetch config from remote server
   */
  async fetch(): Promise<void> {
    // Check if cache is still valid
    const now = Date.now();
    if (this.config && now - this.lastFetchedAt < CONFIG_CACHE_DURATION) {
      console.log("[RemoteConfig] Using cached config");
      return;
    }

    try {
      const response = await fetch(REMOTE_CONFIG_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("[RemoteConfig] Failed to fetch config:", response.status);
        return;
      }

      const config = await response.json();
      this.config = config;
      this.lastFetchedAt = now;

      // Save to cache
      await this.storage.setLocal(REMOTE_CONFIG_KEY, {
        config,
        fetchedAt: now,
      });

      console.log("[RemoteConfig] Config fetched and cached");
    } catch (error) {
      console.error("[RemoteConfig] Error fetching remote config:", error);
    }
  }

  /**
   * Check if extension is globally enabled
   */
  isEnabled(): boolean {
    return this.config?.enabled ?? true;
  }

  /**
   * Check if a specific domain is enabled
   */
  isDomainEnabled(domain: string): boolean {
    if (!this.isEnabled()) return false;
    return this.config?.domains?.[domain]?.enabled ?? true;
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: "highlights" | "tooltips" | "capture"): boolean {
    if (!this.isEnabled()) return false;
    return this.config?.features?.[feature] ?? true;
  }

  /**
   * Get custom selectors for a domain (if any)
   */
  getDomainSelectors(domain: string): Record<string, string> | undefined {
    return this.config?.domains?.[domain]?.selectors;
  }

  /**
   * Get full config
   */
  getConfig(): RemoteConfigData | null {
    return this.config;
  }
}
