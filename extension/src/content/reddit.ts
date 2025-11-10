// extension/src/content/reddit.ts
/**
 * Content script for Reddit
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import { SessionRecorder } from "../lib/session-recorder";
import { extractSearchQuery, extractPhrases, batchNormalize } from "../lib/parsers";
import {
  shouldEnableHighlighting,
  checkAuthentication,
  getWatchlist,
} from "../lib/content-helpers";

const MARKET = "reddit";

const SELECTORS = {
  post: '[data-testid="post-container"], .Post',
  postTitle: 'h3, [data-click-id="body"]',
  subreddit: '[data-click-id="subreddit"]',
  comment: '[data-testid="comment"]',
};

class RedditContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private sessionRecorder: SessionRecorder;

  constructor() {
    this.highlighter = new Highlighter({ maxHighlights: 300 });
    this.tooltipManager = new TooltipManager();
    this.sessionRecorder = new SessionRecorder(MARKET);
  }

  async init(): Promise<void> {
    // Check if highlighting should be enabled
    const highlightCheck = await shouldEnableHighlighting(MARKET);
    if (!highlightCheck.enabled) {
      console.log(`[LexyHub Reddit] ${highlightCheck.reason}`);
      return;
    }

    // Check authentication
    const authCheck = await checkAuthentication();
    if (!authCheck.authenticated) {
      console.log(`[LexyHub Reddit] ${authCheck.reason}`);
      return;
    }

    const query = extractSearchQuery(window.location.href);
    if (query) {
      this.sessionRecorder.trackSearch(query);
    }

    await this.extractAndHighlight();
  }

  private async extractAndHighlight(): Promise<void> {
    const keywords: string[] = [];

    // Extract from post titles
    const posts = document.querySelectorAll(SELECTORS.post);
    posts.forEach(post => {
      const title = post.querySelector(SELECTORS.postTitle);
      if (title?.textContent) {
        const phrases = extractPhrases(title.textContent);
        keywords.push(...phrases);
      }
    });

    // Extract subreddit names
    const subreddits = document.querySelectorAll(SELECTORS.subreddit);
    subreddits.forEach(sub => {
      if (sub.textContent) {
        keywords.push(sub.textContent.replace(/^r\//, ''));
      }
    });

    const normalized = batchNormalize(keywords);
    normalized.forEach(term => this.sessionRecorder.addTerm(term));

    // Apply highlights
    const terms = await getWatchlist(MARKET);
    if (terms.length > 0) {
      this.highlighter.setKeywords(terms);
      this.highlighter.highlight(document.body);
      console.log(`[LexyHub Reddit] Loaded ${terms.length} watchlist terms`);
    }
  }
}

const script = new RedditContentScript();
script.init();
