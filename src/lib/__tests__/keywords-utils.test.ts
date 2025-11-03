import { describe, expect, it } from "vitest";
import { normalizeKeywordTerm, hashKeywordTerm, createProvenanceId } from "../keywords/utils";

describe("Keyword Utils", () => {
  describe("normalizeKeywordTerm", () => {
    it("converts to lowercase", () => {
      expect(normalizeKeywordTerm("HELLO WORLD")).toBe("hello world");
      expect(normalizeKeywordTerm("HeLLo WoRLd")).toBe("hello world");
    });

    it("trims whitespace", () => {
      expect(normalizeKeywordTerm("  hello world  ")).toBe("hello world");
      expect(normalizeKeywordTerm("\thello world\n")).toBe("hello world");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeKeywordTerm("hello    world")).toBe("hello world");
      expect(normalizeKeywordTerm("hello  \t  world")).toBe("hello world");
    });

    it("normalizes unicode characters (NFKC)", () => {
      // ﬁ (ligature) should normalize to fi
      expect(normalizeKeywordTerm("\ufb01le")).toBe("file");
      // Full-width characters
      expect(normalizeKeywordTerm("ｈｅｌｌｏ")).toBe("hello");
    });

    it("handles empty string", () => {
      expect(normalizeKeywordTerm("")).toBe("");
    });

    it("handles single word", () => {
      expect(normalizeKeywordTerm("keyword")).toBe("keyword");
    });

    it("is idempotent", () => {
      const input = "  HELLO    World  ";
      const normalized = normalizeKeywordTerm(input);
      expect(normalizeKeywordTerm(normalized)).toBe(normalized);
    });
  });

  describe("hashKeywordTerm", () => {
    it("generates consistent hashes", () => {
      const hash1 = hashKeywordTerm("test keyword", "text-embedding-3-large");
      const hash2 = hashKeywordTerm("test keyword", "text-embedding-3-large");
      expect(hash1).toBe(hash2);
    });

    it("generates different hashes for different terms", () => {
      const hash1 = hashKeywordTerm("keyword one", "text-embedding-3-large");
      const hash2 = hashKeywordTerm("keyword two", "text-embedding-3-large");
      expect(hash1).not.toBe(hash2);
    });

    it("generates different hashes for different models", () => {
      const hash1 = hashKeywordTerm("test keyword", "text-embedding-3-large");
      const hash2 = hashKeywordTerm("test keyword", "text-embedding-3-small");
      expect(hash1).not.toBe(hash2);
    });

    it("normalizes before hashing", () => {
      const hash1 = hashKeywordTerm("  TEST Keyword  ", "model");
      const hash2 = hashKeywordTerm("test    keyword", "model");
      expect(hash1).toBe(hash2);
    });

    it("returns SHA-256 hex string (64 characters)", () => {
      const hash = hashKeywordTerm("test", "model");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles special characters", () => {
      const hash1 = hashKeywordTerm("café", "model");
      const hash2 = hashKeywordTerm("café", "model");
      expect(hash1).toBe(hash2);
    });
  });

  describe("createProvenanceId", () => {
    it("generates consistent IDs", () => {
      const id1 = createProvenanceId("amazon", "us", "test keyword");
      const id2 = createProvenanceId("amazon", "us", "test keyword");
      expect(id1).toBe(id2);
    });

    it("generates different IDs for different sources", () => {
      const id1 = createProvenanceId("amazon", "us", "test keyword");
      const id2 = createProvenanceId("etsy", "us", "test keyword");
      expect(id1).not.toBe(id2);
    });

    it("generates different IDs for different markets", () => {
      const id1 = createProvenanceId("amazon", "us", "test keyword");
      const id2 = createProvenanceId("amazon", "uk", "test keyword");
      expect(id1).not.toBe(id2);
    });

    it("generates different IDs for different terms", () => {
      const id1 = createProvenanceId("amazon", "us", "keyword one");
      const id2 = createProvenanceId("amazon", "us", "keyword two");
      expect(id1).not.toBe(id2);
    });

    it("normalizes term before hashing", () => {
      const id1 = createProvenanceId("amazon", "us", "  TEST Keyword  ");
      const id2 = createProvenanceId("amazon", "us", "test    keyword");
      expect(id1).toBe(id2);
    });

    it("returns SHA-1 hex string (40 characters)", () => {
      const id = createProvenanceId("amazon", "us", "test");
      expect(id).toMatch(/^[a-f0-9]{40}$/);
    });

    it("uses consistent delimiter encoding", () => {
      // The delimiter is "|" so inputs are separated clearly
      const id1 = createProvenanceId("source", "market", "term");
      const id2 = createProvenanceId("source", "market", "term");
      expect(id1).toBe(id2);

      // Different inputs produce different hashes
      const id3 = createProvenanceId("source2", "market", "term");
      expect(id1).not.toBe(id3);
    });
  });
});
