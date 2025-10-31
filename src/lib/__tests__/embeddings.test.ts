import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EMBEDDING_MODEL, getOrCreateEmbedding } from "../ai/embeddings";
import { hashKeywordTerm, normalizeKeywordTerm } from "../keywords/utils";

function createSupabaseStub(existing: {
  term_hash: string;
  term: string;
  embedding: number[];
  model: string;
} | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(existing ? { data: existing, error: null } : { data: null, error: { code: "PGRST116", message: "No rows" } });

  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const query: any = {};
  query.select = vi.fn().mockImplementation(() => query);
  query.eq = vi.fn().mockImplementation(() => query);
  query.limit = vi.fn().mockImplementation(() => query);
  query.maybeSingle = maybeSingle;
  query.upsert = upsert;

  const from = vi.fn().mockReturnValue(query);

  return { from, query };
}

const originalFetch = global.fetch;

describe("embedding pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns cached embeddings without calling OpenAI", async () => {
    const term = "Handmade Jewelry";
    const normalized = normalizeKeywordTerm(term);
    const termHash = hashKeywordTerm(term, DEFAULT_EMBEDDING_MODEL);
    const supabase = createSupabaseStub({
      term_hash: termHash,
      term: normalized,
      embedding: [0.1, 0.2, 0.3],
      model: DEFAULT_EMBEDDING_MODEL,
    });

    const fetchSpy = vi.fn(() => {
      throw new Error("fetch should not be called when cache hit");
    });
    global.fetch = fetchSpy as unknown as typeof global.fetch;

    const result = await getOrCreateEmbedding(term, { supabase: supabase as unknown as any });

    expect(result.created).toBe(false);
    expect(result.embedding).toHaveLength(3072);
    expect(result.embedding.slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(result.embedding.slice(3).every((value) => value === 0)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("embeddings");
  });

  it("falls back to deterministic embeddings when OpenAI fails", async () => {
    const term = "Organic skincare";
    const supabase = createSupabaseStub(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("boom"),
    } as Response);

    const result = await getOrCreateEmbedding(term, { supabase: supabase as unknown as any });

    expect(result.created).toBe(true);
    expect(result.model.endsWith("deterministic-fallback")).toBe(true);
    expect(result.embedding.length).toBeGreaterThan(10);
    expect(supabase.query.upsert).toHaveBeenCalledOnce();
  });
});
