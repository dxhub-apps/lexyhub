/**
 * Tests for retrieval functions
 */

import { describe, it, expect } from '@jest/globals';
import { rerank, generateEmbedding } from '../retrieval';
import type { RetrievalContext } from '../types';

describe('rerank', () => {
  it('should prioritize user-owned sources', () => {
    const sources: RetrievalContext[] = [
      {
        source_id: '1',
        source_type: 'keyword',
        source_label: 'global keyword',
        similarity_score: 0.95,
        metadata: {},
        owner_scope: 'global',
      },
      {
        source_id: '2',
        source_type: 'keyword',
        source_label: 'user keyword',
        similarity_score: 0.85,
        metadata: {},
        owner_scope: 'user',
      },
      {
        source_id: '3',
        source_type: 'keyword',
        source_label: 'team keyword',
        similarity_score: 0.90,
        metadata: {},
        owner_scope: 'team',
      },
    ];

    const ranked = rerank(sources, 10);

    // User scope should be first, even with lower similarity
    expect(ranked[0].owner_scope).toBe('user');
    expect(ranked[0].source_id).toBe('2');

    // Then global (higher similarity than team)
    expect(ranked[1].owner_scope).toBe('global');
    expect(ranked[1].source_id).toBe('1');

    // Then team
    expect(ranked[2].owner_scope).toBe('team');
    expect(ranked[2].source_id).toBe('3');
  });

  it('should limit to topN results', () => {
    const sources: RetrievalContext[] = Array.from({ length: 20 }, (_, i) => ({
      source_id: `${i}`,
      source_type: 'keyword',
      source_label: `keyword ${i}`,
      similarity_score: 0.9 - i * 0.01,
      metadata: {},
      owner_scope: 'global' as const,
    }));

    const ranked = rerank(sources, 5);

    expect(ranked.length).toBe(5);
  });

  it('should maintain similarity order within same scope', () => {
    const sources: RetrievalContext[] = [
      {
        source_id: '1',
        source_type: 'keyword',
        source_label: 'keyword 1',
        similarity_score: 0.8,
        metadata: {},
        owner_scope: 'global',
      },
      {
        source_id: '2',
        source_type: 'keyword',
        source_label: 'keyword 2',
        similarity_score: 0.9,
        metadata: {},
        owner_scope: 'global',
      },
    ];

    const ranked = rerank(sources, 10);

    // Higher similarity first within same scope
    expect(ranked[0].similarity_score).toBeGreaterThan(ranked[1].similarity_score);
  });
});

describe('generateEmbedding', () => {
  it('should generate 384-dimensional embedding', async () => {
    const text = 'vintage wedding rings';
    const embedding = await generateEmbedding(text);

    expect(embedding).toHaveLength(384);
    expect(embedding.every((v) => typeof v === 'number')).toBe(true);
    expect(embedding.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('should be deterministic for same text', async () => {
    const text = 'handmade jewelry';
    const embedding1 = await generateEmbedding(text);
    const embedding2 = await generateEmbedding(text);

    expect(embedding1).toEqual(embedding2);
  });

  it('should produce different embeddings for different text', async () => {
    const text1 = 'vintage rings';
    const text2 = 'modern necklace';

    const embedding1 = await generateEmbedding(text1);
    const embedding2 = await generateEmbedding(text2);

    expect(embedding1).not.toEqual(embedding2);
  });
});
