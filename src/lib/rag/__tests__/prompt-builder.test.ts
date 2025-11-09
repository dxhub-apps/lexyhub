/**
 * Tests for prompt building
 */

import { describe, it, expect } from '@jest/globals';
import { formatSources, formatHistory, estimateTokens } from '../prompt-builder';
import type { RetrievalContext, ConversationHistory } from '../types';

describe('formatSources', () => {
  it('should format empty sources', () => {
    const formatted = formatSources([]);
    expect(formatted).toContain('No specific data retrieved');
  });

  it('should format keyword sources with metadata', () => {
    const sources: RetrievalContext[] = [
      {
        source_id: '123',
        source_type: 'keyword',
        source_label: 'vintage wedding rings',
        similarity_score: 0.92,
        metadata: {
          demand_index: 87,
          competition_score: 45,
          trend_momentum: 12,
          ai_opportunity_score: 75,
        },
        owner_scope: 'user',
      },
    ];

    const formatted = formatSources(sources);

    expect(formatted).toContain('Retrieved 1 relevant');
    expect(formatted).toContain('[KEYWORD] "vintage wedding rings"');
    expect(formatted).toContain('Demand: 87');
    expect(formatted).toContain('Competition: 45');
    expect(formatted).toContain('Trend: 12%');
    expect(formatted).toContain('Opportunity: 75');
    expect(formatted).toContain('Similarity: 92.0%');
    expect(formatted).toContain('Scope: user');
  });

  it('should format multiple sources', () => {
    const sources: RetrievalContext[] = [
      {
        source_id: '1',
        source_type: 'keyword',
        source_label: 'term 1',
        similarity_score: 0.9,
        metadata: {},
        owner_scope: 'user',
      },
      {
        source_id: '2',
        source_type: 'listing',
        source_label: 'listing 1',
        similarity_score: 0.8,
        metadata: {},
        owner_scope: 'global',
      },
    ];

    const formatted = formatSources(sources);

    expect(formatted).toContain('Retrieved 2 relevant');
    expect(formatted).toContain('1. [KEYWORD]');
    expect(formatted).toContain('2. [LISTING]');
  });
});

describe('formatHistory', () => {
  it('should return empty string for no history', () => {
    const formatted = formatHistory([]);
    expect(formatted).toBe('');
  });

  it('should format conversation history', () => {
    const history: ConversationHistory[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const formatted = formatHistory(history);

    expect(formatted).toContain('=== CONVERSATION HISTORY ===');
    expect(formatted).toContain('User: Hello');
    expect(formatted).toContain('Assistant: Hi there!');
    expect(formatted).toContain('User: How are you?');
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens correctly', () => {
    const shortText = 'Hello';
    const estimate = estimateTokens(shortText);
    expect(estimate).toBe(2); // 5 chars / 4 = 1.25 rounded up to 2

    const longerText = 'This is a longer sentence with more words';
    const estimate2 = estimateTokens(longerText);
    expect(estimate2).toBeGreaterThan(5);
  });

  it('should handle empty text', () => {
    const estimate = estimateTokens('');
    expect(estimate).toBe(0);
  });
});
