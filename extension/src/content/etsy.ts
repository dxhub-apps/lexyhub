// extension/src/content/etsy.ts
/**
 * Content script for Etsy marketplace
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import { SessionRecorder } from "../lib/session-recorder";
import { batchNormalize } from "../lib/parsers";
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
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private sessionRecorder: SessionRecorder;
  private trackedCards = new WeakSet<Element>();

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
    this.sessionRecorder = new SessionRecorder(MARKET);

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

    this.trackSearchQuery();
    this.captureKeywords();
    this.attachListingClickTracking();

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

    this.captureKeywords();
    this.attachListingClickTracking();
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

  private trackSearchQuery(): void {
    const input = document.querySelector<HTMLInputElement>(SELECTORS.searchQuery);
    const queryParam = new URLSearchParams(window.location.search).get("search_query");
    const query = input?.value?.trim() || queryParam?.trim();
    if (query) {
      this.sessionRecorder.trackSearch(query);
    }
  }

  private captureKeywords(): void {
    const keywordSet = new Set<string>();

    const titles = document.querySelectorAll(SELECTORS.listingTitle);
    titles.forEach((title) => {
      const text = title.textContent?.trim();
      if (text) {
        keywordSet.add(text);
      }
    });

    const tags = document.querySelectorAll(SELECTORS.tags);
    tags.forEach((tag) => {
      const text = tag.textContent?.trim();
      if (text) {
        keywordSet.add(text);
      }
    });

    if (keywordSet.size === 0) {
      return;
    }

    const normalized = batchNormalize(Array.from(keywordSet));
    normalized.slice(0, 150).forEach((term) => this.sessionRecorder.addTerm(term));
  }

  private attachListingClickTracking(): void {
    const cards = document.querySelectorAll(SELECTORS.listingCard);
    cards.forEach((card, index) => {
      if (this.trackedCards.has(card)) {
        return;
      }

      const link = card.querySelector<HTMLAnchorElement>("a[href]");
      const title = card.querySelector(SELECTORS.listingTitle)?.textContent?.trim() || link?.title || "Listing";

      const handler = () => {
        const href = link?.href || window.location.href;
        this.sessionRecorder.trackClick(title || "Listing", href, index + 1);
      };

      card.addEventListener("click", handler);
      this.trackedCards.add(card);
    });
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
    this.sessionRecorder.end();
  }
}

function bootstrap() {
  const script = new EtsyContentScript();
  script.init();
  window.addEventListener("beforeunload", () => script.destroy(), { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
