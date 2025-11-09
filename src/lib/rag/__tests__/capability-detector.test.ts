/**
 * Tests for capability detection
 */

import { describe, it, expect } from 'vitest';
import { detectCapabilityHeuristic, getRetrievalScopeForCapability } from '../capability-detector';

describe('detectCapabilityHeuristic', () => {
  it('should detect market_brief capability', () => {
    const queries = [
      'Give me a market brief for vintage jewelry',
      'What is the state of the handmade niche?',
      'Analyze the market trends for boho wedding',
      'Market overview for sustainable fashion',
    ];

    queries.forEach((query) => {
      const result = detectCapabilityHeuristic(query);
      expect(result).toBe('market_brief');
    });
  });

  it('should detect competitor_intel capability', () => {
    const queries = [
      'Who are my competitors in this niche?',
      'Show me top sellers for vintage rings',
      'What are competing shops doing?',
      'Competitor pricing strategy analysis',
    ];

    queries.forEach((query) => {
      const result = detectCapabilityHeuristic(query);
      expect(result).toBe('competitor_intel');
    });
  });

  it('should detect keyword_explanation capability', () => {
    const queries = [
      'Why is this keyword important?',
      'Explain the term handmade jewelry',
      'What does boho wedding mean for sellers?',
      'Tell me about related keywords for vintage',
    ];

    queries.forEach((query) => {
      const result = detectCapabilityHeuristic(query);
      expect(result).toBe('keyword_explanation');
    });
  });

  it('should detect alert_explanation capability', () => {
    const queries = [
      'Why did I get this alert?',
      'Explain this risk warning',
      'What is this trademark violation about?',
      'Tell me about this compliance issue',
    ];

    queries.forEach((query) => {
      const result = detectCapabilityHeuristic(query);
      expect(result).toBe('alert_explanation');
    });
  });

  it('should default to general_chat for ambiguous queries', () => {
    const queries = [
      'Hello',
      'How are you?',
      'What can you help me with?',
      'Random question',
    ];

    queries.forEach((query) => {
      const result = detectCapabilityHeuristic(query);
      expect(result).toBe('general_chat');
    });
  });
});

describe('getRetrievalScopeForCapability', () => {
  it('should return correct scope for market_brief', () => {
    const scope = getRetrievalScopeForCapability('market_brief');
    expect(scope).toEqual(['keywords', 'trends']);
  });

  it('should return correct scope for competitor_intel', () => {
    const scope = getRetrievalScopeForCapability('competitor_intel');
    expect(scope).toEqual(['listings', 'shops', 'keywords']);
  });

  it('should return correct scope for keyword_explanation', () => {
    const scope = getRetrievalScopeForCapability('keyword_explanation');
    expect(scope).toEqual(['keywords', 'keyword_history', 'alerts']);
  });

  it('should return correct scope for alert_explanation', () => {
    const scope = getRetrievalScopeForCapability('alert_explanation');
    expect(scope).toEqual(['alerts', 'risk_rules', 'docs']);
  });

  it('should return correct scope for general_chat', () => {
    const scope = getRetrievalScopeForCapability('general_chat');
    expect(scope).toEqual(['docs', 'user_keywords', 'user_watchlists']);
  });
});
