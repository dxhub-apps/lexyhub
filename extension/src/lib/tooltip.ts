// extension/src/lib/tooltip.ts
/**
 * Tooltip manager for displaying keyword metrics on hover
 */

export interface KeywordMetrics {
  term: string;
  demand: number;
  competition: number;
  engagement: number;
  ai_score: number;
  trend: "up" | "down" | "flat" | "unknown";
  freshness: string;
  intent?: string;
  seasonality?: string;
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
      max-width: 320px;
      display: none;
      pointer-events: auto;
    `;

    // Add click handler for action buttons
    this.tooltip.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('lexyhub-tooltip-action')) {
        const action = target.dataset.action;
        const term = this.currentTarget?.dataset.k;
        if (action && term) {
          this.handleAction(action, term);
        }
      }
    });

    document.body.appendChild(this.tooltip);
  }

  /**
   * Handle tooltip action button clicks
   */
  private handleAction(action: string, term: string): void {
    switch (action) {
      case 'copy':
        navigator.clipboard.writeText(term);
        this.showToast('Copied to clipboard!');
        break;
      case 'save':
        chrome.runtime.sendMessage({
          type: 'ADD_TO_WATCHLIST',
          payload: {
            term,
            market: this.detectMarket(),
            source_url: window.location.href,
          },
        });
        this.showToast('Added to watchlist!');
        break;
      case 'brief':
        chrome.runtime.sendMessage({
          type: 'CREATE_BRIEF',
          payload: {
            terms: [term],
            market: this.detectMarket(),
          },
        });
        this.showToast('Creating brief...');
        break;
    }
  }

  /**
   * Show temporary toast message
   */
  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1f2937;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2000);
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
    let metrics: KeywordMetrics | null | undefined = this.metricsCache.get(term.toLowerCase());

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
              engagement: metric.engagement || 0,
              ai_score: metric.ai_score,
              trend: metric.trend,
              freshness: metric.freshness,
              intent: metric.intent,
              seasonality: metric.seasonality,
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

    // Determine score color based on AI score
    const getScoreColor = (score: number): string => {
      if (score >= 75) return "#10b981"; // green
      if (score >= 50) return "#f59e0b"; // yellow
      return "#6b7280"; // gray
    };

    const scoreColor = getScoreColor(metrics.ai_score);

    // Build metadata section
    let metadataHtml = '';
    if (metrics.intent) {
      metadataHtml += `<span style="background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px;">${metrics.intent}</span>`;
    }
    if (metrics.seasonality) {
      metadataHtml += `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${metrics.seasonality}</span>`;
    }

    return `
      <div style="min-width: 280px; pointer-events: auto;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2937; display: flex; align-items: center; justify-content: space-between;">
          <span>${this.escapeHtml(metrics.term)}</span>
          ${metrics.inWatchlist ? '<span style="color: #10b981;">★</span>' : ''}
        </div>

        ${metadataHtml ? `<div style="margin-bottom: 8px;">${metadataHtml}</div>` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Demand</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${metrics.demand}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Competition</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${metrics.competition}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Engagement</div>
            <div style="font-size: 16px; font-weight: 600; color: #1f2937;">${metrics.engagement}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Trend</div>
            <div style="font-size: 18px; font-weight: 600; color: ${trendColor};">${trendIcon}</div>
          </div>
        </div>

        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">AI Opportunity</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background: ${scoreColor}; width: ${metrics.ai_score}%;"></div>
            </div>
            <div style="font-size: 14px; font-weight: 600; color: ${scoreColor};">${metrics.ai_score}%</div>
          </div>
        </div>

        <div style="display: flex; gap: 4px; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <button class="lexyhub-tooltip-action" data-action="copy" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; color: #374151;">
            Copy
          </button>
          <button class="lexyhub-tooltip-action" data-action="save" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; color: #374151;">
            ${metrics.inWatchlist ? 'Saved' : 'Save'}
          </button>
          <button class="lexyhub-tooltip-action" data-action="brief" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #3b82f6; border: 1px solid #2563eb; border-radius: 4px; cursor: pointer; color: #fff;">
            Brief
          </button>
        </div>

        <div style="font-size: 10px; color: #9ca3af; margin-top: 8px; text-align: center;">
          Updated ${metrics.freshness}
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
