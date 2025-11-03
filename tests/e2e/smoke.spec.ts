import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");

    // Should not show error page
    await expect(page.locator("text=404").or(page.locator("text=Error"))).not.toBeVisible();

    // Should have a title
    expect(await page.title()).toBeTruthy();
  });

  test("status page is accessible", async ({ page }) => {
    await page.goto("/status");

    // Should show status information
    await expect(page.locator("text=Status").or(page.locator("text=Health"))).toBeVisible({
      timeout: 10000,
    });
  });

  test("API health check responds", async ({ request }) => {
    const response = await request.get("/api/status");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status");
  });

  test("handles 404 gracefully", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-12345");

    // Should return 404 status
    expect(response?.status()).toBe(404);
  });
});
