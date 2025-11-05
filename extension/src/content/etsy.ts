// extension/src/content/etsy.ts
/**
 * Content script for Etsy marketplace
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";

const MARKET = "etsy";

// Etsy-specific selectors
const SELECTORS = {
  searchResults: "[data-search-results]",
  listingCard: ".v2-listing-card, .wt-list-unstyled .wt-grid__item",
  listingTitle: ".v2-listing-card__title, h3.wt-text-caption",
  searchQuery: 'input[name="search_query"]',
  tags: ".wt-tag-group a, .listing-tag",
};

class EtsyContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private observ: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    this.highlighter = new Highlighter({
      maxHighlights: 300,
      excludeSelectors: [
        "script",
        "style",
        "noscript",
        "iframe",
        "input",
        "textarea",
        "select",
        "button",
        ".lexyhub-k",
        ".lexyhub-tooltip",
      ],
    });

    this.tooltipManager = new TooltipManager();

    console.log("[LexyHub Etsy] Content script initialized");
  }

  /**
   * Initialize the content script
   */
  async init(): Promise<void> {
    // Check if extension is enabled for Etsy
    const settings = await this.getSettings();
    if (!settings?.enabled_domains?.etsy) {
      console.log("[LexyHub Etsy] Etsy domain is disabled");
      return;
    }

    // Check authentication
    const authState = await this.getAuthState();
    if (!authState?.isAuthenticated) {
      console.log("[LexyHub Etsy] User not authenticated");
      return;
    }

    // Fetch watchlist
    await this.loadWatchlist();

    // Start observing DOM changes
    this.startObserver();

    // Initial highlight
    this.highlightPage();

    console.log("[LexyHub Etsy] Content script ready");
  }

  /**
   * Get settings from background
   */
  private getSettings(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "GET_SETTINGS" },
        (response) => {
          resolve(response?.success ? response.data : null);
        }
      );
    });
  }

  /**
   * Get auth state from background
   */
  private getAuthState(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "GET_AUTH_STATE" },
        (response) => {
          resolve(response || null);
        }
      );
    });
  }

  /**
   * Load watchlist from background
   */
  private async loadWatchlist(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "GET_WATCHLIST",
          payload: { market: MARKET },
        },
        (response) => {
          if (response?.success && response.data?.terms) {
            this.highlighter.setKeywords(response.data.terms);
            console.log(
              `[LexyHub Etsy] Loaded ${response.data.terms.length} watchlist terms`
            );
          }
          resolve();
        }
      );
    });
  }

  /**
   * Highlight keywords on the page
   */
  private highlightPage(): void {
    // Target specific areas for highlighting
    const searchResults = document.querySelector(SELECTORS.searchResults);
    if (searchResults) {
      this.highlighter.clear();
      this.highlighter.highlight(searchResults as Element);
    } else {
      // Fallback to body if search results container not found
      this.highlighter.clear();
      this.highlighter.highlight(document.body);
    }
  }

  /**
   * Start mutation observer for SPA navigation
   */
  private startObserver(): void {
    this.observer = new MutationObserver(() => {
      this.debounceHighlight();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Debounce highlight to avoid excessive re-highlighting
   */
  private debounceHighlight(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.highlightPage();
    }, 250);
  }

  /**
   * Cleanup on unload
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.highlighter.removeHighlights();
    this.tooltipManager.destroy();
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const script = new EtsyContentScript();
    script.init();
  });
} else {
  const script = new EtsyContentScript();
  script.init();
}
