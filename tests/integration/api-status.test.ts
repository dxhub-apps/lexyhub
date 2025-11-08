import { describe, it, expect, beforeAll } from "vitest";

describe("API Status Endpoint", () => {
  const baseUrl = process.env.TEST_API_URL || "http://localhost:3000";
  let response: Response;
  let payload: any;

  beforeAll(async () => {
    response = await fetch(`${baseUrl}/api/status`);
    payload = await response.json();
  });

  it("should return 200 status", () => {
    expect(response.status).toBe(200);
  });

  it("should return JSON response", () => {
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");
  });

  it("should include status field", () => {
    expect(payload).toHaveProperty("status");
  });

  it("should include timestamp", () => {
    expect(payload).toHaveProperty("timestamp");
  });

  it("should have valid timestamp format", () => {
    const timestamp = new Date(payload.timestamp);
    expect(timestamp.toString()).not.toBe("Invalid Date");
  });

  it("should return consistent structure across requests", async () => {
    const secondResponse = await fetch(`${baseUrl}/api/status`);
    const secondPayload = await secondResponse.json();

    expect(Object.keys(payload).sort()).toEqual(Object.keys(secondPayload).sort());
  });

  it("should expose runtime diagnostics", () => {
    expect(payload).toHaveProperty("runtime");
    expect(payload.runtime).toMatchObject({
      node: expect.any(String),
      platform: expect.any(String),
      release: expect.any(String),
    });
    expect(typeof payload.runtime.uptimeSeconds).toBe("number");
    if (payload.runtime.region !== undefined) {
      expect(typeof payload.runtime.region).toBe("string");
    }
  });

  it("should list monitored APIs, services, and workers", () => {
    expect(Array.isArray(payload.apis)).toBe(true);
    expect(Array.isArray(payload.services)).toBe(true);
    expect(Array.isArray(payload.workers)).toBe(true);

    const validateStatusArray = (entries: any[]) => {
      entries.forEach((entry) => {
        expect(entry).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            status: expect.stringMatching(/^(operational|warning|critical)$/),
            message: expect.any(String),
          }),
        );
      });
    };

    validateStatusArray(payload.apis);
    validateStatusArray(payload.services);
    validateStatusArray(payload.workers);
  });

  it("should summarise required environment variables", () => {
    expect(Array.isArray(payload.variables)).toBe(true);
    const variableKeys = payload.variables.map((variable: { key: string }) => variable.key);

    const requiredKeys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "LEXYHUB_JWT_SECRET",
      "OPENAI_API_KEY",
    ];

    requiredKeys.forEach((key) => {
      expect(variableKeys).toContain(key);
    });
  });
});
