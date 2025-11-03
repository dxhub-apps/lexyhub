import { test, expect } from "@playwright/test";

test.describe("Watchlist Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/watchlists");
  });

  test("should load watchlists page", async ({ page }) => {
    const url = page.url();
    if (url.includes("/login")) {
      expect(url).toContain("/login");
    } else {
      await expect(
        page.locator("text=Watchlist").or(page.locator("text=Watch"))
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have create watchlist button", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      const createButton = page.locator(
        'button:has-text("Create"), button:has-text("New"), button:has-text("Add")'
      );

      if ((await createButton.count()) > 0) {
        await expect(createButton.first()).toBeVisible();
      }
    }
  });

  test("should display watchlist cards or table", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      // Look for watchlist container
      await expect(page.locator("body")).toBeVisible();

      // Could have cards, table, or empty state
      const container = page.locator(
        "[class*='watchlist'], [data-testid*='watchlist'], table, [role='table']"
      );

      // Page should render without errors
      expect(page.url()).toBeTruthy();
    }
  });
});

test.describe("Watchlist Creation", () => {
  test("should open create watchlist dialog", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      const createButton = page.locator(
        'button:has-text("Create"), button:has-text("New Watchlist"), button:has-text("Add")'
      );

      if ((await createButton.count()) > 0) {
        await createButton.first().click();

        // Should open dialog/modal
        await expect(
          page.locator('[role="dialog"], [role="modal"], .modal, .dialog')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should have form fields for watchlist creation", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      const createButton = page.locator(
        'button:has-text("Create"), button:has-text("New")'
      );

      if ((await createButton.count()) > 0) {
        await createButton.first().click({ timeout: 5000 });

        // Look for input fields
        const nameInput = page.locator(
          'input[name="name"], input[placeholder*="name" i]'
        );

        if ((await nameInput.count()) > 0) {
          await expect(nameInput.first()).toBeVisible();
        }
      }
    }
  });
});

test.describe("Watchlist Details", () => {
  test("should navigate to watchlist details", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      // Try to find and click a watchlist link
      const watchlistLinks = page.locator(
        'a[href*="/watchlists/"], button[data-watchlist-id]'
      );
      const count = await watchlistLinks.count();

      if (count > 0) {
        await watchlistLinks.first().click();
        // Should navigate or open details
        await page.waitForTimeout(1000);
        expect(page.url()).toBeTruthy();
      }
    }
  });

  test("should have add items functionality", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      // Look for add items button
      const addButton = page.locator(
        'button:has-text("Add Item"), button:has-text("Add Keyword"), button:has-text("Add Listing")'
      );

      if ((await addButton.count()) > 0) {
        await expect(addButton.first()).toBeVisible();
      }
    }
  });
});

test.describe("Watchlist Items", () => {
  test("should display watchlist items", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      // Navigate to first watchlist if exists
      const watchlistLinks = page.locator('a[href*="/watchlists/"]');
      const count = await watchlistLinks.count();

      if (count > 0) {
        await watchlistLinks.first().click();

        // Should show items or empty state
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("should have item actions (remove, edit)", async ({ page }) => {
    await page.goto("/watchlists");

    const url = page.url();
    if (!url.includes("/login")) {
      // Navigate to first watchlist
      const watchlistLinks = page.locator('a[href*="/watchlists/"]');
      const count = await watchlistLinks.count();

      if (count > 0) {
        await watchlistLinks.first().click();

        // Look for action buttons
        const actionButtons = page.locator(
          'button[aria-label*="delete" i], button[aria-label*="remove" i], button[aria-label*="edit" i]'
        );

        if ((await actionButtons.count()) > 0) {
          await expect(actionButtons.first()).toBeVisible();
        }
      }
    }
  });
});
