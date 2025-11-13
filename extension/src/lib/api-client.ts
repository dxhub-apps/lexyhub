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

export interface BriefSummary {
  id: string;
  title: string;
  market: string;
  terms: string[];
  executive_summary?: string;
  created_at: string;
  url: string;
}

export interface AccountSummaryResponse {
  success: boolean;
  user: {
    id: string;
    name: string | null;
    company: string | null;
    avatar_url: string | null;
  };
  plan: {
    code: string;
    display_name: string;
    features: string[];
    niches_max: number;
    searches_per_month: number;
    ai_opportunities_per_month: number;
    is_trial: boolean;
    trial_expires_at?: string | null;
    upgrade_url: string;
  };
  usage: {
    searches: UsageStat;
    ai_opportunities: UsageStat;
    watchlist: UsageStat;
  };
}

export interface UsageStat {
  key: string;
  used: number;
  limit: number;
  percentage: number;
  shouldWarn: boolean;
  warningLevel: "none" | "warning" | "critical" | "blocked";
}

export interface ResolvedKeyword {
  term: string;
  keyword_id: string;
  marketplace: string;
  metrics?: {
    demand?: number;
    competition?: number;
    trend?: string;
    ai_score?: number;
  };
}

export interface ResolveKeywordsResponse {
  resolved: ResolvedKeyword[];
  count: number;
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
   * Fetch latest briefs for the authenticated user
   */
  async getBriefs(limit = 5): Promise<BriefSummary[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await this.request<{ success: boolean; briefs: BriefSummary[] }>(
      `/brief?${params.toString()}`
    );
    return response.briefs || [];
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

  /**
   * Save research session
   */
  async saveSession(payload: any): Promise<any> {
    return this.request<any>("/session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Create listing snapshot
   */
  async createSnapshot(payload: any): Promise<any> {
    return this.request<any>("/snapshot", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get trending term suggestions
   */
  async getTrendingSuggestions(term: string, market: string, limit = 10): Promise<any> {
    return this.request<any>("/trends/suggest", {
      method: "POST",
      body: JSON.stringify({ term, market, limit }),
    });
  }

  /**
   * Resolve candidate keywords against public.keywords database
   * Returns only verified keywords with keyword_id
   */
  async resolveKeywords(
    candidates: string[],
    marketplace: string,
    domain: string
  ): Promise<ResolveKeywordsResponse> {
    return this.request<ResolveKeywordsResponse>("/keywords/resolve", {
      method: "POST",
      body: JSON.stringify({ candidates, marketplace, domain }),
    });
  }

  /**
   * Get LexyBrain insights for a keyword
   * Uses deterministic LexyBrain capabilities
   */
  async getLexyBrainInsights(payload: {
    keyword_id?: string;
    term: string;
    marketplace: string;
    url?: string;
    capability?: string;
  }): Promise<any> {
    return this.request<any>("/lexybrain/insights", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        source: "extension",
        capability: payload.capability || "keyword_insights",
      }),
    });
  }

  /**
   * Send structured event for deterministic aggregation
   */
  async sendEvent(payload: {
    event_type: string;
    user_id?: string;
    marketplace?: string;
    keyword_id?: string;
    url?: string;
    metadata?: any;
  }): Promise<void> {
    await this.request<{ ok: boolean }>("/events", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: "extension",
      }),
    });
  }

  /**
   * Load plan, quota, and profile summary
   */
  async getAccountSummary(): Promise<AccountSummaryResponse> {
    return this.request<AccountSummaryResponse>("/account");
  }
}
