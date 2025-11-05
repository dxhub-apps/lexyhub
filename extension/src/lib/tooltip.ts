// extension/src/lib/tooltip.ts
/**
 * Tooltip manager for displaying keyword metrics on hover
 */

export interface KeywordMetrics {
  term: string;
  demand: number;
  competition: number;
  ai_score: number;
  trend: "up" | "down" | "flat" | "unknown";
  freshness: string;
  inWatchlist?: boolean;
}

export class TooltipManager {
  private tooltip: HTMLElement | null = null;
  private currentTarget: HTMLElement | null = null;
  private metricsCache = new Map<string, KeywordMetrics>();
  private hideTimeout: number | null = null;

  constructor() {
    this.createTooltip();
    this.attachEventListeners();
  }

  /**
   * Create tooltip DOM element
   */
  private createTooltip(): void {
    this.tooltip = document.createElement("div");
    this.tooltip.className = "lexyhub-tooltip";
    this.tooltip.style.cssText = `
      position: fixed;
      z-index: 999999;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      max-width: 280px;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.tooltip);
  }

  /**
   * Attach event listeners for hover detection
   */
  private attachEventListeners(): void {
    document.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("lexyhub-k")) {
        this.handleMouseEnter(target);
      }
    });

    document.addEventListener("mouseout", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("lexyhub-k")) {
        this.handleMouseLeave(target);
      }
    });

    // Hide tooltip on scroll
    document.addEventListener("scroll", () => {
      this.hide();
    }, { passive: true });
  }

  /**
   * Handle mouse enter on keyword
   */
  private handleMouseEnter(target: HTMLElement): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    const term = target.dataset.k;
    if (!term) return;

    this.currentTarget = target;
    this.show(target, term);
  }

  /**
   * Handle mouse leave from keyword
   */
  private handleMouseLeave(target: HTMLElement): void {
    this.hideTimeout = window.setTimeout(() => {
      this.hide();
    }, 300);
  }

  /**
   * Show tooltip for term
   */
  private async show(target: HTMLElement, term: string): Promise<void> {
    if (!this.tooltip) return;

    // Check cache first
    let metrics = this.metricsCache.get(term.toLowerCase());

    if (!metrics) {
      // Show loading state
      this.tooltip.innerHTML = this.renderLoading(term);
      this.position(target);
      this.tooltip.style.display = "block";

      // Fetch metrics from background
      try {
        metrics = await this.fetchMetrics(term);
        if (metrics) {
          this.metricsCache.set(term.toLowerCase(), metrics);
        }
      } catch (error) {
        console.error("[Tooltip] Error fetching metrics:", error);
        this.hide();
        return;
      }
    }

    // Update tooltip content
    if (this.currentTarget === target && metrics) {
      this.tooltip.innerHTML = this.renderContent(metrics);
      this.position(target);
      this.tooltip.style.display = "block";
    }
  }

  /**
   * Hide tooltip
   */
  private hide(): void {
    if (this.tooltip) {
      this.tooltip.style.display = "none";
    }
    this.currentTarget = null;
  }

  /**
   * Position tooltip near target element
   */
  private position(target: HTMLElement): void {
    if (!this.tooltip) return;

    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Adjust if tooltip would go off-screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 16;
    }

    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  /**
   * Fetch metrics from background
   */
  private async fetchMetrics(term: string): Promise<KeywordMetrics | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_METRICS",
          payload: {
            terms: [term],
            market: this.detectMarket(),
          },
        },
        (response) => {
          if (response?.success && response.data?.metrics?.[0]) {
            const metric = response.data.metrics[0];
            resolve({
              term: metric.t,
              demand: metric.demand,
              competition: metric.competition,
              ai_score: metric.ai_score,
              trend: metric.trend,
              freshness: metric.freshness,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Detect current marketplace
   */
  private detectMarket(): string {
    const hostname = window.location.hostname;
    if (hostname.includes("etsy.com")) return "etsy";
    if (hostname.includes("amazon.")) return "amazon";
    if (hostname.includes("google.com")) return "google";
    if (hostname.includes("pinterest.")) return "pinterest";
    if (hostname.includes("reddit.com")) return "reddit";
    return "shopify"; // Default for unknown
  }

  /**
   * Render loading state
   */
  private renderLoading(term: string): string {
    return `
      <div style="color: #666;">
        <strong>${term}</strong>
        <div style="margin-top: 8px; font-size: 12px;">Loading metrics...</div>
      </div>
    `;
  }

  /**
   * Render tooltip content
   */
  private renderContent(metrics: KeywordMetrics): string {
    const trendIcon = {
      up: "↑",
      down: "↓",
      flat: "→",
      unknown: "?",
    }[metrics.trend];

    const trendColor = {
      up: "#10b981",
      down: "#ef4444",
      flat: "#6b7280",
      unknown: "#9ca3af",
    }[metrics.trend];

    return `
      <div style="min-width: 240px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2937;">
          ${metrics.term}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Demand</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${metrics.demand}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Competition</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${metrics.competition}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">AI Score</div>
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">${(metrics.ai_score * 100).toFixed(0)}%</div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Trend</div>
            <div style="font-size: 18px; font-weight: 600; color: ${trendColor};">${trendIcon}</div>
          </div>
        </div>
        <div style="font-size: 10px; color: #9ca3af; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          Updated: ${new Date(metrics.freshness).toLocaleDateString()}
        </div>
      </div>
    `;
  }

  /**
   * Clear metrics cache
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Destroy tooltip
   */
  destroy(): void {
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    this.tooltip = null;
    this.currentTarget = null;
    this.metricsCache.clear();
  }
}
