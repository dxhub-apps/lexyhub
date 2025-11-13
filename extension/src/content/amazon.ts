// extension/src/content/amazon.ts
/**
 * Content script for Amazon marketplace
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

const MARKET = "amazon";

// Amazon-specific selectors
const SELECTORS = {
  searchResults: "[data-component-type='s-search-results']",
  productTitle: "h2 a span, .a-size-medium.a-color-base",
  bullets: "#feature-bullets li, .a-unordered-list.a-vertical li",
  productDescription: "#productDescription, #aplus",
  listingCard: "div.s-result-item[data-component-type='s-search-result']",
  searchInput: "#twotabsearchtextbox, input[name='field-keywords']",
};

class AmazonContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private sessionRecorder: SessionRecorder;
  private trackedCards = new WeakSet<Element>();

  constructor() {
    this.highlighter = new Highlighter({
      maxHighlights: 300,
    });

    this.tooltipManager = new TooltipManager();
    this.sessionRecorder = new SessionRecorder(MARKET);

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
    this.trackSearchQuery();
    this.captureKeywords();
    this.attachListingClickTracking();
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

    this.captureKeywords();
    this.attachListingClickTracking();
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

  private trackSearchQuery(): void {
    const input = document.querySelector<HTMLInputElement>(SELECTORS.searchInput);
    const params = new URLSearchParams(window.location.search);
    const query = input?.value?.trim() || params.get("k")?.trim() || params.get("field-keywords")?.trim();
    if (query) {
      this.sessionRecorder.trackSearch(query);
    }
  }

  private captureKeywords(): void {
    const keywordSet = new Set<string>();

    const titles = document.querySelectorAll(SELECTORS.productTitle);
    titles.forEach((title) => {
      const text = title.textContent?.trim();
      if (text) {
        keywordSet.add(text);
      }
    });

    const bullets = document.querySelectorAll(SELECTORS.bullets);
    bullets.forEach((bullet) => {
      const text = bullet.textContent?.trim();
      if (text) {
        keywordSet.add(text);
      }
    });

    const descriptions = document.querySelectorAll(SELECTORS.productDescription);
    descriptions.forEach((desc) => {
      const text = desc.textContent?.trim();
      if (text) {
        keywordSet.add(text);
      }
    });

    if (keywordSet.size === 0) {
      return;
    }

    const normalized = batchNormalize(Array.from(keywordSet));
    normalized.slice(0, 200).forEach((term) => this.sessionRecorder.addTerm(term));
  }

  private attachListingClickTracking(): void {
    const cards = document.querySelectorAll(SELECTORS.listingCard);
    cards.forEach((card, index) => {
      if (!(card instanceof HTMLElement) || this.trackedCards.has(card)) {
        return;
      }

      const link = card.querySelector<HTMLAnchorElement>("a[href]");
      if (!link) {
        return;
      }

      const title =
        card.querySelector(SELECTORS.productTitle)?.textContent?.trim() ||
        link.title ||
        link.textContent?.trim() ||
        "Listing";

      const handler = () => {
        this.sessionRecorder.trackClick(title || "Listing", link.href, index + 1);
      };

      card.addEventListener("click", handler);
      this.trackedCards.add(card);
    });
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
    this.sessionRecorder.end();
  }
}

function bootstrap() {
  const script = new AmazonContentScript();
  script.init();
  window.addEventListener("beforeunload", () => script.destroy(), { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
