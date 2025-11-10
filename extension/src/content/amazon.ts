// extension/src/content/amazon.ts
/**
 * Content script for Amazon marketplace
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import {
  shouldEnableHighlighting,
  checkAuthentication,
  getWatchlist,
} from "../lib/content-helpers";

const MARKET = "amazon";

// Amazon-specific selectors
const SELECTORS = {
  searchResults: "[data-component-type='s-search-results']",
  productTitle: "h2 a span, .a-size-medium.a-color-base",
  bullets: "#feature-bullets li, .a-unordered-list.a-vertical li",
  productDescription: "#productDescription, #aplus",
};

class AmazonContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    this.highlighter = new Highlighter({
      maxHighlights: 300,
    });

    this.tooltipManager = new TooltipManager();

    console.log("[LexyHub Amazon] Content script initialized");
  }

  async init(): Promise<void> {
    // Check if highlighting should be enabled
    const highlightCheck = await shouldEnableHighlighting(MARKET);
    if (!highlightCheck.enabled) {
      console.log(`[LexyHub Amazon] ${highlightCheck.reason}`);
      return;
    }

    // Check authentication
    const authCheck = await checkAuthentication();
    if (!authCheck.authenticated) {
      console.log(`[LexyHub Amazon] ${authCheck.reason}`);
      return;
    }

    // Fetch watchlist
    const terms = await getWatchlist(MARKET);
    if (terms.length > 0) {
      this.highlighter.setKeywords(terms);
      console.log(`[LexyHub Amazon] Loaded ${terms.length} watchlist terms`);
    }
    this.startObserver();
    this.highlightPage();

    console.log("[LexyHub Amazon] Content script ready");
  }

  private highlightPage(): void {
    const searchResults = document.querySelector(SELECTORS.searchResults);
    if (searchResults) {
      this.highlighter.clear();
      this.highlighter.highlight(searchResults as Element);
    } else {
      this.highlighter.clear();
      this.highlighter.highlight(document.body);
    }
  }

  private startObserver(): void {
    this.observer = new MutationObserver(() => {
      this.debounceHighlight();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private debounceHighlight(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.highlightPage();
    }, 250);
  }

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const script = new AmazonContentScript();
    script.init();
  });
} else {
  const script = new AmazonContentScript();
  script.init();
}
