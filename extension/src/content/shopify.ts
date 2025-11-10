// extension/src/content/shopify.ts
/**
 * Content script for Shopify stores (pattern-matched)
 */

import { Highlighter } from "../lib/highlighter";
import { TooltipManager } from "../lib/tooltip";
import {
  shouldEnableHighlighting,
  checkAuthentication,
  getWatchlist,
} from "../lib/content-helpers";

const MARKET = "shopify";

// Common Shopify theme selectors
const SELECTORS = {
  productTitle: ".product__title, .product-single__title, h1.product-title",
  productDescription: ".product__description, .product-single__description",
  collectionGrid: ".collection-grid, .product-grid, .grid__item",
  searchResults: ".search-results, .collection",
};

/**
 * Detect if current site is a Shopify store
 */
function isShopifyStore(): boolean {
  // Check for Shopify meta tags
  const shopifyMeta = document.querySelector('meta[name="shopify-checkout-api-token"]');
  if (shopifyMeta) return true;

  // Check for Shopify-specific scripts
  const scripts = Array.from(document.scripts);
  const hasShopifyScript = scripts.some(
    (script) =>
      script.src.includes("cdn.shopify.com") ||
      script.src.includes("shopify.com/s/files")
  );
  if (hasShopifyScript) return true;

  // Check for common Shopify class patterns
  const body = document.body;
  if (body && body.className) {
    const bodyClasses = body.className.toLowerCase();
    if (
      bodyClasses.includes("shopify") ||
      bodyClasses.includes("template-product") ||
      bodyClasses.includes("template-collection")
    ) {
      return true;
    }
  }

  return false;
}

class ShopifyContentScript {
  private highlighter: Highlighter;
  private tooltipManager: TooltipManager;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    this.highlighter = new Highlighter({
      maxHighlights: 300,
    });

    this.tooltipManager = new TooltipManager();

    console.log("[LexyHub Shopify] Content script initialized");
  }

  async init(): Promise<void> {
    // Check if this is a Shopify store
    if (!isShopifyStore()) {
      console.log("[LexyHub Shopify] Not a Shopify store");
      return;
    }

    // Check if highlighting should be enabled
    const highlightCheck = await shouldEnableHighlighting(MARKET);
    if (!highlightCheck.enabled) {
      console.log(`[LexyHub Shopify] ${highlightCheck.reason}`);
      return;
    }

    // Check authentication
    const authCheck = await checkAuthentication();
    if (!authCheck.authenticated) {
      console.log(`[LexyHub Shopify] ${authCheck.reason}`);
      return;
    }

    // Fetch watchlist
    const terms = await getWatchlist(MARKET);
    if (terms.length > 0) {
      this.highlighter.setKeywords(terms);
      console.log(`[LexyHub Shopify] Loaded ${terms.length} watchlist terms`);
    }

    this.startObserver();
    this.highlightPage();

    console.log("[LexyHub Shopify] Content script ready");
  }

  private highlightPage(): void {
    this.highlighter.clear();
    this.highlighter.highlight(document.body);
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
    const script = new ShopifyContentScript();
    script.init();
  });
} else {
  const script = new ShopifyContentScript();
  script.init();
}
