import { describe, it, expect } from "vitest";

describe("API Status Endpoint", () => {
  const baseUrl = process.env.TEST_API_URL || "http://localhost:3000";

  it("should return 200 status", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    expect(response.status).toBe(200);
  });

  it("should return JSON response", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");
  });

  it("should include status field", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    const data = await response.json();
    expect(data).toHaveProperty("status");
  });

  it("should include timestamp", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    const data = await response.json();
    expect(data).toHaveProperty("timestamp");
  });

  it("should have valid timestamp format", async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    const data = await response.json();
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toString()).not.toBe("Invalid Date");
  });

  it("should return consistent structure", async () => {
    const response1 = await fetch(`${baseUrl}/api/status`);
    const data1 = await response1.json();

    const response2 = await fetch(`${baseUrl}/api/status`);
    const data2 = await response2.json();

    expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort());
  });
});
