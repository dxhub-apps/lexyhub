// extension/src/content/amazon.ts
/**
 * Content script for Amazon marketplace
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";

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
    const settings = await this.getSettings();
    if (!settings?.enabled_domains?.amazon) {
      console.log("[LexyHub Amazon] Amazon domain is disabled");
      return;
    }

    const authState = await this.getAuthState();
    if (!authState?.isAuthenticated) {
      console.log("[LexyHub Amazon] User not authenticated");
      return;
    }

    await this.loadWatchlist();
    this.startObserver();
    this.highlightPage();

    console.log("[LexyHub Amazon] Content script ready");
  }

  private getSettings(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        resolve(response?.success ? response.data : null);
      });
    });
  }

  private getAuthState(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" }, (response) => {
        resolve(response || null);
      });
    });
  }

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
              `[LexyHub Amazon] Loaded ${response.data.terms.length} watchlist terms`
            );
          }
          resolve();
        }
      );
    });
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
