// extension/src/lib/highlighter.ts
/**
 * Keyword highlighter for DOM manipulation
 */

import { TrieMatcher } from "./trie-matcher";

export interface HighlightOptions {
  maxHighlights?: number;
  className?: string;
  excludeSelectors?: string[];
}

const DEFAULT_OPTIONS: Required<HighlightOptions> = {
  maxHighlights: 300,
  className: "lexyhub-k",
  excludeSelectors: [
    "script",
    "style",
    "noscript",
    "iframe",
    "input",
    "textarea",
    "select",
    "button",
    "[contenteditable]",
    ".lexyhub-k",
    ".lexyhub-tooltip",
  ],
};

export class Highlighter {
  private matcher: TrieMatcher;
  private options: Required<HighlightOptions>;
  private highlightedNodes = new Set<Node>();
  private highlightCount = 0;

  constructor(options: HighlightOptions = {}) {
    this.matcher = new TrieMatcher();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set keywords to highlight
   */
  setKeywords(keywords: string[]): void {
    this.matcher.clear();
    this.matcher.build(keywords);
  }

  /**
   * Check if element should be excluded from highlighting
   */
  private shouldExclude(element: Element): boolean {
    for (const selector of this.options.excludeSelectors) {
      if (element.matches(selector)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Highlight keywords in a text node
   */
  private highlightTextNode(textNode: Text): void {
    const text = textNode.textContent || "";
    if (!text.trim()) return;

    const matches = this.matcher.findMatches(text);
    if (matches.length === 0) return;

    // Check if we've hit the max highlights limit
    if (this.highlightCount >= this.options.maxHighlights) {
      return;
    }

    // Create document fragment with highlighted spans
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    // Sort matches by start index
    matches.sort((a, b) => a.startIndex - b.startIndex);

    for (const match of matches) {
      // Check for overlap with previous match
      if (match.startIndex < lastIndex) continue;

      // Check if we've hit the max highlights limit
      if (this.highlightCount >= this.options.maxHighlights) {
        break;
      }

      // Add text before match
      if (match.startIndex > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.startIndex))
        );
      }

      // Create highlighted span
      const span = document.createElement("span");
      span.className = this.options.className;
      span.dataset.k = match.term;
      span.textContent = text.substring(match.startIndex, match.endIndex);

      fragment.appendChild(span);
      lastIndex = match.endIndex;
      this.highlightCount++;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace text node with fragment
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  /**
   * Walk DOM tree and highlight text nodes
   */
  private walkAndHighlight(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      this.highlightTextNode(node as Text);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      // Skip excluded elements
      if (this.shouldExclude(element)) {
        return;
      }

      // Check if already processed
      if (this.highlightedNodes.has(node)) {
        return;
      }
    }

    // Process child nodes
    const childNodes = Array.from(node.childNodes);
    for (const child of childNodes) {
      this.walkAndHighlight(child);
    }

    // Mark as processed
    if (node.nodeType === Node.ELEMENT_NODE) {
      this.highlightedNodes.add(node);
    }
  }

  /**
   * Highlight keywords in the given root element
   */
  highlight(root: Element = document.body): void {
    this.highlightCount = 0;
    this.walkAndHighlight(root);
    console.log(`[Highlighter] Highlighted ${this.highlightCount} keywords`);
  }

  /**
   * Remove all highlights
   */
  removeHighlights(): void {
    const highlights = document.querySelectorAll(`.${this.options.className}`);
    highlights.forEach((span) => {
      const text = span.textContent || "";
      const textNode = document.createTextNode(text);
      span.parentNode?.replaceChild(textNode, span);
    });

    this.highlightedNodes.clear();
    this.highlightCount = 0;
    console.log("[Highlighter] Removed all highlights");
  }

  /**
   * Clear internal state
   */
  clear(): void {
    this.highlightedNodes.clear();
    this.highlightCount = 0;
  }
}
