// extension/src/content/bing.ts
/**
 * Content script for Bing Search
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import { SessionRecorder } from "../lib/session-recorder";
import { extractSearchQuery, parseRelatedSearches, batchNormalize } from "../lib/parsers";

const MARKET = "bing";

const SELECTORS = {
  searchResults: "#b_results",
  resultItem: ".b_algo",
  resultTitle: "h2",
  relatedSearches: "#b_context .b_rs, .b_vList",
};

class BingContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private sessionRecorder: SessionRecorder;

  constructor() {
    this.highlighter = new Highlighter({ maxHighlights: 300 });
    this.tooltipManager = new TooltipManager();
    this.sessionRecorder = new SessionRecorder(MARKET);
  }

  async init(): Promise<void> {
    const query = extractSearchQuery(window.location.href);
    if (query) {
      this.sessionRecorder.trackSearch(query);
    }

    await this.extractAndHighlight();
  }

  private async extractAndHighlight(): Promise<void> {
    const keywords: string[] = [];

    // Extract from result titles
    const results = document.querySelectorAll(SELECTORS.resultItem);
    results.forEach((result, index) => {
      const title = result.querySelector(SELECTORS.resultTitle);
      if (title?.textContent) {
        keywords.push(title.textContent);
      }
    });

    // Extract related searches
    const relatedContainer = document.querySelector(SELECTORS.relatedSearches);
    if (relatedContainer) {
      const related = parseRelatedSearches(relatedContainer);
      keywords.push(...related);
    }

    const normalized = batchNormalize(keywords);
    normalized.forEach(term => this.sessionRecorder.addTerm(term));

    // Apply highlights
    const response = await chrome.runtime.sendMessage({
      type: 'GET_WATCHLIST',
      payload: { market: MARKET },
    });

    if (response?.success && response.data?.terms) {
      this.highlighter.setKeywords(response.data.terms);
      this.highlighter.highlight(document.body);
    }
  }
}

const script = new BingContentScript();
script.init();
