// extension/src/lib/api-client.ts
/**
 * API client for LexyHub extension endpoints
 */

import type { AuthManager } from "./auth";

const API_BASE_URL = "https://app.lexyhub.com/api/ext";

export interface WatchlistResponse {
  terms: string[];
  version: string;
  count: number;
}

export interface AddToWatchlistResponse {
  ok: boolean;
  watchlist_id: string | null;
  message?: string;
}

export interface KeywordMetrics {
  t: string;
  demand: number;
  competition: number;
  ai_score: number;
  trend: "up" | "down" | "flat" | "unknown";
  freshness: string;
}

export interface MetricsBatchResponse {
  metrics: KeywordMetrics[];
}

export interface BriefResponse {
  brief_id: string;
  url: string;
}

export class APIClient {
  constructor(private auth: AuthManager) {}

  /**
   * Get authorization header
   */
  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.auth.getToken();
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : "",
      "X-Ext-Client": "true",
    };
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get user's watchlist
   */
  async getWatchlist(
    market?: string,
    since?: string
  ): Promise<WatchlistResponse> {
    const params = new URLSearchParams();
    if (market) params.append("market", market);
    if (since) params.append("since", since);

    const query = params.toString();
    const endpoint = query ? `/watchlist?${query}` : "/watchlist";

    return this.request<WatchlistResponse>(endpoint);
  }

  /**
   * Add term to watchlist
   */
  async addToWatchlist(payload: {
    term: string;
    market: string;
    source_url?: string;
  }): Promise<AddToWatchlistResponse> {
    return this.request<AddToWatchlistResponse>("/watchlist/add", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get metrics for batch of terms
   */
  async getMetricsBatch(
    terms: string[],
    market: string
  ): Promise<MetricsBatchResponse> {
    return this.request<MetricsBatchResponse>("/metrics/batch", {
      method: "POST",
      body: JSON.stringify({ terms, market }),
    });
  }

  /**
   * Create brief from terms
   */
  async createBrief(terms: string[], market: string): Promise<BriefResponse> {
    return this.request<BriefResponse>("/brief", {
      method: "POST",
      body: JSON.stringify({ terms, market }),
    });
  }

  /**
   * Capture event for analytics
   */
  async captureEvent(payload: {
    source: string;
    url: string;
    terms: Array<{ t: string; w: number; pos: string }>;
    serp_meta?: any;
  }): Promise<void> {
    await this.request<{ ok: boolean }>("/capture", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
