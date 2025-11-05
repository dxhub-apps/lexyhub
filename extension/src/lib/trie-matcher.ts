// extension/src/lib/trie-matcher.ts
/**
 * Trie-based keyword matcher for efficient multi-keyword matching
 */

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  term: string | null = null;
}

export class TrieMatcher {
  private root: TrieNode = new TrieNode();

  /**
   * Build trie from array of terms
   */
  build(terms: string[]): void {
    this.root = new TrieNode();

    for (const term of terms) {
      const normalized = term.toLowerCase().trim();
      if (!normalized) continue;

      const words = normalized.split(/\s+/);
      let node = this.root;

      for (const word of words) {
        if (!node.children.has(word)) {
          node.children.set(word, new TrieNode());
        }
        node = node.children.get(word)!;
      }

      node.isEndOfWord = true;
      node.term = term; // Store original term
    }
  }

  /**
   * Find all matches in text
   * Returns array of { term, startIndex, endIndex }
   */
  findMatches(text: string): Array<{ term: string; startIndex: number; endIndex: number }> {
    const matches: Array<{ term: string; startIndex: number; endIndex: number }> = [];
    const normalized = text.toLowerCase();

    // Split into words with indices
    const words: Array<{ word: string; start: number; end: number }> = [];
    const wordRegex = /\b[\w]+\b/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(normalized)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Try to match starting from each word
    for (let i = 0; i < words.length; i++) {
      let node = this.root;
      let matchLength = 0;
      let endIndex = -1;
      let matchedTerm: string | null = null;

      for (let j = i; j < words.length; j++) {
        const word = words[j].word;

        if (!node.children.has(word)) {
          break;
        }

        node = node.children.get(word)!;
        matchLength++;

        if (node.isEndOfWord) {
          endIndex = words[j].end;
          matchedTerm = node.term;
        }
      }

      if (matchedTerm && endIndex >= 0) {
        matches.push({
          term: matchedTerm,
          startIndex: words[i].start,
          endIndex: endIndex,
        });
      }
    }

    return matches;
  }

  /**
   * Check if a term exists in the trie
   */
  has(term: string): boolean {
    const normalized = term.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    let node = this.root;

    for (const word of words) {
      if (!node.children.has(word)) {
        return false;
      }
      node = node.children.get(word)!;
    }

    return node.isEndOfWord;
  }

  /**
   * Clear the trie
   */
  clear(): void {
    this.root = new TrieNode();
  }
}
