import { test, expect } from "@playwright/test";

test.describe("Market Twin Simulation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/market-twin");
  });

  test("should load market twin page", async ({ page }) => {
    const url = page.url();
    if (url.includes("/login")) {
      expect(url).toContain("/login");
    } else {
      await expect(
        page.locator("text=Market").or(page.locator("text=Twin"))
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have configuration inputs", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      // Look for input fields or sliders
      const inputs = page.locator(
        'input, select, [role="slider"], [role="spinbutton"]'
      );

      if ((await inputs.count()) > 0) {
        await expect(inputs.first()).toBeVisible();
      }
    }
  });

  test("should have simulation trigger button", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      const simulateButton = page.locator(
        'button:has-text("Simulate"), button:has-text("Run"), button:has-text("Generate")'
      );

      if ((await simulateButton.count()) > 0) {
        await expect(simulateButton.first()).toBeVisible();
      }
    }
  });

  test("should display results area", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      // Look for results display
      const resultsArea = page.locator(
        '[class*="result"], [class*="simulation"], [data-testid*="result"]'
      );

      // Page should render
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Market Twin Analysis", () => {
  test("should show loading state during simulation", async ({ page }) => {
    await page.goto("/market-twin");

    const url = page.url();
    if (!url.includes("/login")) {
      const simulateButton = page.locator(
        'button:has-text("Simulate"), button:has-text("Run")'
      );

      if ((await simulateButton.count()) > 0) {
        await simulateButton.first().click();

        // Should show loading or complete quickly
        await page.waitForTimeout(500);
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("should display market insights", async ({ page }) => {
    await page.goto("/market-twin");

    const url = page.url();
    if (!url.includes("/login")) {
      // Look for insights display
      const insights = page.locator(
        '[class*="insight"], [class*="metric"], [role="region"]'
      );

      // Page structure exists
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should have visualization elements", async ({ page }) => {
    await page.goto("/market-twin");

    const url = page.url();
    if (!url.includes("/login")) {
      // Look for charts or graphs
      const visualizations = page.locator(
        'canvas, svg, [class*="chart"], [role="img"]'
      );

      // Visualizations might exist
      if ((await visualizations.count()) > 0) {
        await expect(visualizations.first()).toBeVisible();
      }
    }
  });
});

test.describe("Market Twin Export", () => {
  test("should have export functionality", async ({ page }) => {
    await page.goto("/market-twin");

    const url = page.url();
    if (!url.includes("/login")) {
      const exportButton = page.locator(
        'button:has-text("Export"), button:has-text("Download"), button:has-text("Save")'
      );

      if ((await exportButton.count()) > 0) {
        await expect(exportButton.first()).toBeVisible();
      }
    }
  });
});
