// extension/src/content/google.ts
/**
 * Content script for Google Search
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import { SessionRecorder } from "../lib/session-recorder";
import { extractSearchQuery, parseRelatedSearches, batchNormalize } from "../lib/parsers";
import {
  shouldEnableHighlighting,
  checkAuthentication,
  getWatchlist,
} from "../lib/content-helpers";

const MARKET = "google";

const SELECTORS = {
  searchResults: "#search, #rso",
  resultItem: ".g, .tF2Cxc",
  resultTitle: "h3",
  relatedSearches: "[class*='related-searches'], #brs",
  peopleAlsoAsk: "[jsname='yEVEwb']",
};

class GoogleContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private sessionRecorder: SessionRecorder;
  private observer: MutationObserver | null = null;

  constructor() {
    this.highlighter = new Highlighter({ maxHighlights: 300 });
    this.tooltipManager = new TooltipManager();
    this.sessionRecorder = new SessionRecorder(MARKET);

    console.log("[LexyHub Google] Content script initialized");
  }

  async init(): Promise<void> {
    // Check if highlighting should be enabled
    const highlightCheck = await shouldEnableHighlighting(MARKET);
    if (!highlightCheck.enabled) {
      console.log(`[LexyHub Google] ${highlightCheck.reason}`);
      return;
    }

    // Check authentication
    const authCheck = await checkAuthentication();
    if (!authCheck.authenticated) {
      console.log(`[LexyHub Google] ${authCheck.reason}`);
      return;
    }

    // Track search query
    const query = extractSearchQuery(window.location.href);
    if (query) {
      this.sessionRecorder.trackSearch(query);
    }

    // Extract keywords from page
    await this.extractKeywords();

    // Set up observer for dynamic content
    this.setupObserver();

    // Fetch and apply watchlist highlights
    const terms = await getWatchlist(MARKET);
    if (terms.length > 0) {
      this.highlighter.setKeywords(terms);
      this.highlighter.highlight(document.body);
      console.log(`[LexyHub Google] Loaded ${terms.length} watchlist terms`);
    }
  }

  private async extractKeywords(): Promise<void> {
    const keywords: string[] = [];

    // Extract from result titles
    const results = document.querySelectorAll(SELECTORS.resultItem);
    results.forEach((result, index) => {
      const title = result.querySelector(SELECTORS.resultTitle);
      if (title?.textContent) {
        keywords.push(title.textContent);

        // Track clicks on results
        result.addEventListener('click', () => {
          this.sessionRecorder.trackClick(
            title.textContent || '',
            (result.querySelector('a') as HTMLAnchorElement)?.href || '',
            index
          );
        });
      }
    });

    // Extract related searches
    const relatedContainer = document.querySelector(SELECTORS.relatedSearches);
    if (relatedContainer) {
      const related = parseRelatedSearches(relatedContainer);
      keywords.push(...related);
    }

    // Extract "People Also Ask" questions
    const paaElements = document.querySelectorAll(SELECTORS.peopleAlsoAsk);
    paaElements.forEach(elem => {
      const question = elem.textContent?.trim();
      if (question) {
        keywords.push(question);
      }
    });

    // Normalize and record discovered terms
    const normalized = batchNormalize(keywords);
    normalized.forEach(term => this.sessionRecorder.addTerm(term));

    console.log(`[LexyHub Google] Extracted ${normalized.length} keywords`);
  }

  private setupObserver(): void {
    this.observer = new MutationObserver(() => {
      // Re-apply highlights when content changes
      this.highlighter.highlight(document.body);
    });

    const searchContainer = document.querySelector(SELECTORS.searchResults);
    if (searchContainer) {
      this.observer.observe(searchContainer, {
        childList: true,
        subtree: true,
      });
    }
  }

  destroy(): void {
    this.observer?.disconnect();
    this.highlighter.removeHighlights();
    this.tooltipManager.destroy();
    this.sessionRecorder.end();
  }
}

// Initialize
const script = new GoogleContentScript();
script.init();

// Cleanup on page unload
window.addEventListener('beforeunload', () => script.destroy());
