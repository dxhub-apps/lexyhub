// extension/src/lib/parsers.ts
/**
 * Common parsing utilities for extracting keywords from marketplace pages
 */

/**
 * Normalize a term for consistency
 */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string, minLength = 2, maxLength = 50): string[] {
  const normalized = normalizeTerm(text);
  const words = normalized.split(' ').filter(w => w.length >= minLength && w.length <= maxLength);
  return Array.from(new Set(words)); // Dedupe
}

/**
 * Extract phrases (2-5 words) from text
 */
export function extractPhrases(text: string): string[] {
  const normalized = normalizeTerm(text);
  const words = normalized.split(' ');
  const phrases: string[] = [];

  for (let length = 2; length <= Math.min(5, words.length); length++) {
    for (let i = 0; i <= words.length - length; i++) {
      const phrase = words.slice(i, i + length).join(' ');
      if (phrase.length >= 3 && phrase.length <= 50) {
        phrases.push(phrase);
      }
    }
  }

  return Array.from(new Set(phrases)); // Dedupe
}

/**
 * Extract search query from URL
 */
export function extractSearchQuery(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Common search param names
    const searchParams = ['q', 'query', 'search', 'search_query', 'keyword', 'k'];

    for (const param of searchParams) {
      const value = params.get(param);
      if (value) {
        return decodeURIComponent(value).trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse related searches from a container
 */
export function parseRelatedSearches(container: Element): string[] {
  const terms: string[] = [];

  // Look for common related search patterns
  const links = container.querySelectorAll('a');
  links.forEach(link => {
    const text = link.textContent?.trim();
    if (text && text.length > 0 && text.length < 100) {
      terms.push(text);
    }
  });

  return Array.from(new Set(terms.map(normalizeTerm)));
}

/**
 * Parse Q&A keywords
 */
export function parseQAKeywords(container: Element): string[] {
  const terms: string[] = [];

  // Extract from questions and answers
  const questions = container.querySelectorAll('[class*="question"], [class*="Question"]');
  const answers = container.querySelectorAll('[class*="answer"], [class*="Answer"]');

  [...Array.from(questions), ...Array.from(answers)].forEach(elem => {
    const text = elem.textContent?.trim();
    if (text) {
      // Extract meaningful phrases
      const phrases = extractPhrases(text);
      terms.push(...phrases);
    }
  });

  return Array.from(new Set(terms));
}

/**
 * Parse breadcrumb categories
 */
export function parseBreadcrumbs(container: Element): string[] {
  const terms: string[] = [];

  const breadcrumbs = container.querySelectorAll('[class*="breadcrumb"] a, nav a, [aria-label*="breadcrumb"] a');
  breadcrumbs.forEach(link => {
    const text = link.textContent?.trim();
    if (text && text.length > 0 && text !== 'Home') {
      terms.push(normalizeTerm(text));
    }
  });

  return terms;
}

/**
 * Parse product attributes (color, size, material, etc.)
 */
export function parseAttributes(container: Element): string[] {
  const terms: string[] = [];

  // Look for common attribute patterns
  const attributes = container.querySelectorAll('[class*="attribute"], [class*="property"], [class*="variation"]');
  attributes.forEach(attr => {
    const text = attr.textContent?.trim();
    if (text) {
      const words = extractKeywords(text);
      terms.push(...words);
    }
  });

  return Array.from(new Set(terms));
}

/**
 * Batch normalize terms
 */
export function batchNormalize(terms: string[]): string[] {
  return Array.from(new Set(terms.map(normalizeTerm).filter(t => t.length > 0)));
}
