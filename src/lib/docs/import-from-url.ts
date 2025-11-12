import TurndownService from "turndown";
import type { JSDOM as JSDOMType } from "jsdom";

export type Marketplace = "auto" | "etsy" | "amazon" | "other";

export interface ImportUrlInput {
  url: string;
  marketplace?: Marketplace;
  topicOverride?: string;
}

export interface ImportUrlResult {
  success: boolean;
  markdown?: string;
  suggestedPath?: string;
  stage?: string;
  message?: string;
}

/**
 * Validates a URL to ensure it has proper protocol and hostname
 */
function validateUrl(url: string): { valid: boolean; message?: string } {
  try {
    const parsed = new URL(url);

    if (!parsed.protocol.match(/^https?:$/)) {
      return {
        valid: false,
        message: "URL must use http or https protocol",
      };
    }

    if (!parsed.hostname) {
      return {
        valid: false,
        message: "URL must have a valid hostname",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: "Invalid URL format",
    };
  }
}

/**
 * Detects marketplace from URL hostname
 */
function detectMarketplace(url: string): Marketplace {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("etsy.com")) {
      return "etsy";
    }

    if (hostname.includes("amazon.com") || hostname.includes("sellercentral.amazon")) {
      return "amazon";
    }

    return "other";
  } catch {
    return "other";
  }
}

/**
 * Creates a slug-safe string from input text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Extracts the page title from HTML
 */
function extractTitle(dom: JSDOMType): string {
  const document = dom.window.document;

  // Try to get the page title
  const titleElement = document.querySelector("title");
  if (titleElement?.textContent) {
    return titleElement.textContent.trim();
  }

  // Fallback to first h1
  const h1 = document.querySelector("h1");
  if (h1?.textContent) {
    return h1.textContent.trim();
  }

  return "Untitled Document";
}

/**
 * Removes unwanted elements from the DOM
 */
function cleanDom(dom: JSDOMType): void {
  const document = dom.window.document;

  // Selectors for elements to remove
  const selectorsToRemove = [
    "nav",
    "header",
    "footer",
    "aside",
    ".nav",
    ".navbar",
    ".header",
    ".footer",
    ".sidebar",
    ".cookie-banner",
    ".cookie-notice",
    ".cookie-consent",
    ".modal",
    ".popup",
    ".advertisement",
    ".ad",
    ".social-share",
    ".related-articles",
    ".recommended",
    ".newsletter-signup",
    ".subscription-prompt",
    ".feedback-widget",
    "[role='banner']",
    "[role='navigation']",
    "[role='complementary']",
    "[role='contentinfo']",
    "script",
    "style",
    "noscript",
    "iframe",
  ];

  selectorsToRemove.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });
}

/**
 * Extracts main content from the DOM
 */
function extractMainContent(dom: JSDOMType): HTMLElement | null {
  const document = dom.window.document;

  // Try common content selectors in order of preference
  const contentSelectors = [
    "main",
    "article",
    "[role='main']",
    ".main-content",
    ".content",
    "#content",
    "#main",
    ".article",
    ".post-content",
  ];

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 100) {
      return element as HTMLElement;
    }
  }

  // Fallback: find the largest content block with multiple paragraphs
  const allDivs = Array.from(document.querySelectorAll("div"));
  let largestDiv: HTMLElement | null = null;
  let maxScore = 0;

  for (const div of allDivs) {
    const paragraphs = div.querySelectorAll("p").length;
    const headings = div.querySelectorAll("h1, h2, h3, h4, h5, h6").length;
    const textLength = div.textContent?.trim().length || 0;

    // Score based on content richness
    const score = paragraphs * 10 + headings * 5 + textLength / 100;

    if (score > maxScore && paragraphs > 2) {
      maxScore = score;
      largestDiv = div;
    }
  }

  return largestDiv;
}

/**
 * Cleans up markdown content
 */
function cleanMarkdown(markdown: string): string {
  // Remove excessive whitespace
  let cleaned = markdown
    .replace(/\n{4,}/g, "\n\n\n") // Max 2 blank lines
    .replace(/[ \t]+$/gm, "") // Remove trailing spaces
    .trim();

  // Normalize heading levels (ensure we don't have h1 in body, start from h2)
  cleaned = cleaned.replace(/^# /gm, "## ");

  return cleaned;
}

/**
 * Removes tracking parameters from URLs
 */
function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ];

    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Main function to import and format URL content to Markdown
 */
export async function importAndFormatUrlToMarkdown(
  input: ImportUrlInput
): Promise<ImportUrlResult> {
  const { url, marketplace: inputMarketplace = "auto", topicOverride } = input;

  // Stage 1: Validate URL
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      success: false,
      stage: "validate",
      message: validation.message,
    };
  }

  // Determine marketplace
  const marketplace = inputMarketplace === "auto" ? detectMarketplace(url) : inputMarketplace;

  // Stage 2: Fetch HTML
  let html: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LexyHub-DocsImporter/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        stage: "fetch",
        message: `Failed to fetch URL: ${response.status} ${response.statusText}`,
      };
    }

    html = await response.text();

    if (!html || html.trim().length === 0) {
      return {
        success: false,
        stage: "fetch",
        message: "Fetched HTML is empty",
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          stage: "fetch",
          message: "Request timeout after 30 seconds",
        };
      }
      return {
        success: false,
        stage: "fetch",
        message: `Failed to fetch URL: ${error.message}`,
      };
    }
    return {
      success: false,
      stage: "fetch",
      message: "Failed to fetch URL: Unknown error",
    };
  }

  // Stage 3: Parse and extract main content
  let mainContentHtml: string;
  let pageTitle: string;
  try {
    // Dynamically import JSDOM to avoid ESM/CommonJS compatibility issues
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(html);

    // Extract title before cleaning
    pageTitle = extractTitle(dom);

    // Clean DOM
    cleanDom(dom);

    // Extract main content
    const mainElement = extractMainContent(dom);
    if (!mainElement) {
      return {
        success: false,
        stage: "parse",
        message: "Could not identify main content area in the page",
      };
    }

    mainContentHtml = mainElement.innerHTML;
  } catch (error) {
    return {
      success: false,
      stage: "parse",
      message: error instanceof Error ? error.message : "Failed to parse HTML",
    };
  }

  // Stage 4: Convert HTML to Markdown
  let bodyMarkdown: string;
  try {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    // Configure turndown to clean links
    turndownService.addRule("cleanLinks", {
      filter: "a",
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).getAttribute("href");
        if (!href) return content;
        const cleanedHref = cleanUrl(href);
        return `[${content}](${cleanedHref})`;
      },
    });

    bodyMarkdown = turndownService.turndown(mainContentHtml);
    bodyMarkdown = cleanMarkdown(bodyMarkdown);
  } catch (error) {
    return {
      success: false,
      stage: "convert",
      message: error instanceof Error ? error.message : "Failed to convert HTML to Markdown",
    };
  }

  // Stage 5: Normalize to LexyBrain corpus format
  try {
    // Determine topic slug
    const topicSlug = topicOverride
      ? slugify(topicOverride)
      : slugify(pageTitle);

    if (!topicSlug) {
      return {
        success: false,
        stage: "normalize",
        message: "Could not generate valid topic slug from page title",
      };
    }

    // Build suggested path
    const suggestedPath = `docs/public/${marketplace}/${topicSlug}.md`;

    // Get current date in YYYY-MM-DD format
    const now = new Date();
    const lastVerified = now.toISOString().split("T")[0];

    // Build metadata block
    const metadata = {
      marketplace,
      topic: topicSlug,
      source_url: cleanUrl(url),
      source_type: "official_help_center",
      language: "en",
      docs_path: suggestedPath,
      last_verified: lastVerified,
      version: 1,
    };

    // Construct final markdown
    const finalMarkdown = `---
${JSON.stringify(metadata, null, 2)}
---

# ${pageTitle}

${bodyMarkdown}`;

    return {
      success: true,
      markdown: finalMarkdown,
      suggestedPath,
    };
  } catch (error) {
    return {
      success: false,
      stage: "normalize",
      message: error instanceof Error ? error.message : "Failed to normalize to corpus format",
    };
  }
}
