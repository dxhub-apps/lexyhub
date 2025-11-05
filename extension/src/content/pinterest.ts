// extension/src/content/pinterest.ts
/**
 * Content script for Pinterest
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import { SessionRecorder } from "../lib/session-recorder";
import { extractSearchQuery, batchNormalize } from "../lib/parsers";

const MARKET = "pinterest";

const SELECTORS = {
  pinCard: '[data-test-id="pin"], [data-test-id="pinWrapper"]',
  pinTitle: '[data-test-id="pin-title"], h1',
  boardName: '[data-test-id="board-name"]',
  searchSuggestions: '[data-test-id="search-suggestion"]',
};

class PinterestContentScript {
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

    // Extract from pin titles
    const pins = document.querySelectorAll(SELECTORS.pinCard);
    pins.forEach(pin => {
      const title = pin.querySelector(SELECTORS.pinTitle);
      if (title?.textContent) {
        keywords.push(title.textContent);
      }
    });

    // Extract board names
    const boards = document.querySelectorAll(SELECTORS.boardName);
    boards.forEach(board => {
      if (board.textContent) {
        keywords.push(board.textContent);
      }
    });

    // Extract search suggestions
    const suggestions = document.querySelectorAll(SELECTORS.searchSuggestions);
    suggestions.forEach(suggestion => {
      if (suggestion.textContent) {
        keywords.push(suggestion.textContent);
      }
    });

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

const script = new PinterestContentScript();
script.init();
