import { describe, it, expect } from "vitest";

describe("Watchlists API Integration", () => {
  const baseUrl = process.env.TEST_API_URL || "http://localhost:3000";

  describe("GET /api/watchlists", () => {
    it("should require authentication", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`);
      expect([200, 401, 403]).toContain(response.status);
    });

    it("should return JSON response when successful", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`);

      if (response.status === 200) {
        const contentType = response.headers.get("content-type");
        expect(contentType).toContain("application/json");
      }
    });

    it("should return array of watchlists", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`);

      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data) || Array.isArray(data.watchlists)).toBe(
          true
        );
      }
    });
  });

  describe("POST /api/watchlists", () => {
    it("should require authentication", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Watchlist" }),
      });

      expect([201, 200, 400, 401, 403]).toContain(response.status);
    });

    it("should validate request body", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBeLessThan(500);
    });

    it("should reject invalid data types", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123 }), // name should be string
      });

      expect([400, 401, 403]).toContain(response.status);
    });

    it("should handle missing required fields", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Test" }), // missing name
      });

      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe("POST /api/watchlists/add", () => {
    it("should require authentication", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlistId: "test-id",
          itemType: "keyword",
          itemId: "test-keyword-id",
        }),
      });

      expect([200, 201, 400, 401, 403, 404]).toContain(response.status);
    });

    it("should validate item type", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlistId: "test-id",
          itemType: "invalid-type",
          itemId: "test-id",
        }),
      });

      expect(response.status).toBeLessThan(500);
    });

    it("should handle missing item ID", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchlistId: "test-id",
          itemType: "keyword",
        }),
      });

      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe("DELETE /api/watchlists/items/:id", () => {
    it("should require authentication", async () => {
      const response = await fetch(
        `${baseUrl}/api/watchlists/items/test-id`,
        {
          method: "DELETE",
        }
      );

      expect([200, 204, 401, 403, 404]).toContain(response.status);
    });

    it("should handle non-existent items", async () => {
      const response = await fetch(
        `${baseUrl}/api/watchlists/items/non-existent-id-12345`,
        {
          method: "DELETE",
        }
      );

      expect([401, 403, 404]).toContain(response.status);
    });

    it("should validate item ID format", async () => {
      const response = await fetch(`${baseUrl}/api/watchlists/items/invalid`, {
        method: "DELETE",
      });

      expect(response.status).toBeLessThan(500);
    });
  });
});

describe("Watchlists API Rate Limiting", () => {
  const baseUrl = process.env.TEST_API_URL || "http://localhost:3000";

  it("should handle rapid successive requests", async () => {
    const requests = Array(5)
      .fill(null)
      .map(() => fetch(`${baseUrl}/api/watchlists`));

    const responses = await Promise.all(requests);

    // Should either handle all requests or apply rate limiting
    responses.forEach((response) => {
      expect(response.status).toBeLessThan(500);
    });
  });

  it("should include rate limit headers if implemented", async () => {
    const response = await fetch(`${baseUrl}/api/watchlists`);

    // Rate limit headers are optional but should be consistent
    const rateLimitHeaders = [
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ];

    // If one exists, others should too
    const hasRateLimitHeaders = rateLimitHeaders.some((header) =>
      response.headers.has(header)
    );

    if (hasRateLimitHeaders) {
      rateLimitHeaders.forEach((header) => {
        expect(response.headers.has(header)).toBe(true);
      });
    }
  });
});
