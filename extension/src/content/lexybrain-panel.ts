// extension/src/content/lexybrain-panel.ts
/**
 * In-page LexyBrain analysis panel
 * Provides keyword insights directly on marketplace pages
 */

export interface LexyBrainPanelConfig {
  keyword: string;
  keywordId?: string;
  marketplace: string;
  url?: string;
}

export interface LexyBrainInsights {
  keyword: string;
  metrics?: {
    demand?: number;
    competition?: number;
    momentum?: string;
    risk?: string;
    ai_score?: number;
  };
  insights?: string[];
  status?: string;
  message?: string;
}

export class LexyBrainPanel {
  private panel: HTMLElement | null = null;
  private config: LexyBrainPanelConfig | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  /**
   * Show the LexyBrain panel with insights for a keyword
   */
  async show(config: LexyBrainPanelConfig): Promise<void> {
    this.config = config;

    // Remove existing panel if any
    this.hide();

    // Create panel
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);

    // Show loading state
    this.renderLoading();

    // Fetch insights
    await this.fetchAndRenderInsights();
  }

  /**
   * Hide and remove the panel
   */
  hide(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.config = null;
  }

  /**
   * Create the panel DOM structure
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "lexyhub-brain-panel";
    panel.className = "lexyhub-brain-panel";

    // Apply styles
    Object.assign(panel.style, {
      position: "fixed",
      top: "80px",
      right: "20px",
      width: "340px",
      maxHeight: "500px",
      backgroundColor: "#ffffff",
      border: "2px solid #2563eb",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      zIndex: "999999",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: "hidden",
    });

    // Add header with drag handle
    const header = document.createElement("div");
    header.className = "lexyhub-brain-panel-header";
    Object.assign(header.style, {
      padding: "12px 16px",
      backgroundColor: "#2563eb",
      color: "#ffffff",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "move",
      userSelect: "none",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    });

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4M12 8h.01"></path>
        </svg>
        <span>LexyBrain Insights</span>
      </div>
      <button class="lexyhub-brain-panel-close" style="background: none; border: none; color: #ffffff; cursor: pointer; font-size: 20px; line-height: 1; padding: 0; width: 20px; height: 20px;">×</button>
    `;

    // Add content area
    const content = document.createElement("div");
    content.className = "lexyhub-brain-panel-content";
    Object.assign(content.style, {
      padding: "16px",
      maxHeight: "440px",
      overflowY: "auto",
      backgroundColor: "#ffffff",
      color: "#000000",
    });

    panel.appendChild(header);
    panel.appendChild(content);

    // Attach event listeners
    this.attachEventListeners(panel, header);

    return panel;
  }

  /**
   * Attach event listeners for interactions
   */
  private attachEventListeners(panel: HTMLElement, header: HTMLElement): void {
    // Close button
    const closeBtn = header.querySelector(".lexyhub-brain-panel-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    // Drag functionality
    header.addEventListener("mousedown", (e: MouseEvent) => {
      this.isDragging = true;
      const rect = panel.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.isDragging && this.panel) {
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Keep panel within viewport
        const maxX = window.innerWidth - this.panel.offsetWidth;
        const maxY = window.innerHeight - this.panel.offsetHeight;

        this.panel.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
        this.panel.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
        this.panel.style.right = "auto";
      }
    });

    document.addEventListener("mouseup", () => {
      this.isDragging = false;
    });
  }

  /**
   * Render loading state
   */
  private renderLoading(): void {
    if (!this.panel) return;

    const content = this.panel.querySelector(
      ".lexyhub-brain-panel-content"
    ) as HTMLElement;
    if (!content) return;

    content.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: #6b7280;">
        <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <p style="margin-top: 16px; font-size: 14px;">Analyzing keyword...</p>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  /**
   * Fetch insights from LexyBrain and render
   */
  private async fetchAndRenderInsights(): Promise<void> {
    if (!this.config || !this.panel) return;

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "GET_LEXYBRAIN_INSIGHTS",
            payload: {
              term: this.config!.keyword,
              keyword_id: this.config!.keywordId,
              marketplace: this.config!.marketplace,
              url: this.config!.url || window.location.href,
            },
          },
          (response) => resolve(response)
        );
      });

      if (response?.success) {
        this.renderInsights(response.data);
      } else {
        this.renderError(response?.error || "Failed to fetch insights");
      }
    } catch (error) {
      console.error("[LexyBrain Panel] Error fetching insights:", error);
      this.renderError("An error occurred while fetching insights");
    }
  }

  /**
   * Render insights content
   */
  private renderInsights(data: LexyBrainInsights): void {
    if (!this.panel || !this.config) return;

    const content = this.panel.querySelector(
      ".lexyhub-brain-panel-content"
    ) as HTMLElement;
    if (!content) return;

    // Check if no data available
    if (data.status === "no_data" || !data.insights || data.insights.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 24px 16px; color: #6b7280;">
          <p style="margin: 0; font-size: 14px;">${data.message || "No reliable data available for this keyword."}</p>
        </div>
      `;
      return;
    }

    // Build insights HTML
    let html = `
      <div class="lexyhub-keyword-header" style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #000000;">${this.config.keyword}</h3>
    `;

    // Add metrics if available
    if (data.metrics) {
      html += '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">';

      if (data.metrics.demand !== undefined) {
        html += this.renderMetricBadge("Demand", data.metrics.demand, "🔥");
      }
      if (data.metrics.competition !== undefined) {
        html += this.renderMetricBadge(
          "Competition",
          data.metrics.competition,
          "⚔️"
        );
      }
      if (data.metrics.momentum) {
        html += this.renderTextBadge("Momentum", data.metrics.momentum);
      }
      if (data.metrics.risk) {
        html += this.renderTextBadge("Risk", data.metrics.risk);
      }
      if (data.metrics.ai_score !== undefined) {
        html += this.renderMetricBadge(
          "AI Score",
          data.metrics.ai_score,
          "⭐"
        );
      }

      html += "</div>";
    }

    html += "</div>";

    // Add insights bullets
    if (data.insights && data.insights.length > 0) {
      html += '<div class="lexyhub-insights-list" style="margin-bottom: 16px;">';
      html += '<h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Key Insights</h4>';
      html += '<ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #000000;">';

      data.insights.slice(0, 3).forEach((insight) => {
        html += `<li style="margin-bottom: 6px;">${insight}</li>`;
      });

      html += "</ul></div>";
    }

    // Add action buttons
    html += `
      <div class="lexyhub-actions" style="display: flex; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <button class="lexyhub-add-watchlist" style="flex: 1; padding: 8px 12px; background: #2563eb; color: #ffffff; border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">
          + Add to Watchlist
        </button>
        <button class="lexyhub-open-hub" style="flex: 1; padding: 8px 12px; background: #ffffff; color: #2563eb; border: 1px solid #2563eb; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">
          Open in LexyHub
        </button>
      </div>
    `;

    content.innerHTML = html;

    // Attach button listeners
    const addBtn = content.querySelector(".lexyhub-add-watchlist");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.handleAddToWatchlist());
    }

    const openBtn = content.querySelector(".lexyhub-open-hub");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.handleOpenInHub());
    }
  }

  /**
   * Render a metric badge with numeric value
   */
  private renderMetricBadge(
    label: string,
    value: number,
    icon: string
  ): string {
    return `
      <div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px;">
        <span>${icon}</span>
        <span style="font-weight: 500;">${label}:</span>
        <span>${value}</span>
      </div>
    `;
  }

  /**
   * Render a text badge
   */
  private renderTextBadge(label: string, value: string): string {
    return `
      <div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 12px;">
        <span style="font-weight: 500;">${label}:</span>
        <span>${value}</span>
      </div>
    `;
  }

  /**
   * Render error state
   */
  private renderError(message: string): void {
    if (!this.panel) return;

    const content = this.panel.querySelector(
      ".lexyhub-brain-panel-content"
    ) as HTMLElement;
    if (!content) return;

    content.innerHTML = `
      <div style="text-align: center; padding: 24px 16px; color: #dc2626;">
        <p style="margin: 0; font-size: 14px;">⚠️ ${message}</p>
      </div>
    `;
  }

  /**
   * Handle add to watchlist button click
   */
  private async handleAddToWatchlist(): Promise<void> {
    if (!this.config) return;

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "ADD_TO_WATCHLIST",
            payload: {
              term: this.config!.keyword,
              market: this.config!.marketplace,
              source_url: this.config!.url || window.location.href,
            },
          },
          (response) => resolve(response)
        );
      });

      if (response?.success) {
        // Update button state
        const btn = this.panel?.querySelector(
          ".lexyhub-add-watchlist"
        ) as HTMLButtonElement;
        if (btn) {
          btn.textContent = "✓ Added";
          btn.style.background = "#10b981";
          btn.disabled = true;
        }
      }
    } catch (error) {
      console.error("[LexyBrain Panel] Error adding to watchlist:", error);
    }
  }

  /**
   * Handle open in LexyHub button click
   */
  private handleOpenInHub(): void {
    if (!this.config) return;

    const keywordParam = encodeURIComponent(this.config.keyword);
    const marketParam = encodeURIComponent(this.config.marketplace);
    const url = `https://app.lexyhub.com/keywords?q=${keywordParam}&market=${marketParam}`;

    window.open(url, "_blank");
  }
}
