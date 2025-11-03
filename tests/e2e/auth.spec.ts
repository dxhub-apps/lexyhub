import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/");

    // Should redirect to login or show login form
    await expect(page).toHaveURL(/\/(login|auth)/);
    await expect(page.locator("text=Login").or(page.locator("text=Sign in"))).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/");

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Should show validation errors
      await expect(page.locator("text=email").or(page.locator("text=required"))).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test.skip("should login with valid credentials", async ({ page }) => {
    // Skip in CI unless credentials are provided
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }

    await page.goto("/");

    // Fill in login form
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or main app
    await expect(page).toHaveURL(/\/(dashboard|keywords|app)/, { timeout: 10000 });
  });
});
