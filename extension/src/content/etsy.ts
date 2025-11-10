// extension/src/content/etsy.ts
/**
 * Content script for Etsy marketplace
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import {
  shouldEnableHighlighting,
  checkAuthentication,
  getWatchlist,
} from "../lib/content-helpers";

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
    // Check if highlighting should be enabled
    const highlightCheck = await shouldEnableHighlighting(MARKET);
    if (!highlightCheck.enabled) {
      console.log(`[LexyHub Etsy] ${highlightCheck.reason}`);
      return;
    }

    // Check authentication
    const authCheck = await checkAuthentication();
    if (!authCheck.authenticated) {
      console.log(`[LexyHub Etsy] ${authCheck.reason}`);
      return;
    }

    // Fetch watchlist
    const terms = await getWatchlist(MARKET);
    if (terms.length > 0) {
      this.highlighter.setKeywords(terms);
      console.log(`[LexyHub Etsy] Loaded ${terms.length} watchlist terms`);
    }

    // Start observing DOM changes
    this.startObserver();

    // Initial highlight
    this.highlightPage();

    console.log("[LexyHub Etsy] Content script ready");
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
