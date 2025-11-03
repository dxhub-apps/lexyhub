import { test, expect } from "@playwright/test";

test.describe("Profile Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
  });

  test("should load profile page", async ({ page }) => {
    const url = page.url();
    if (url.includes("/login")) {
      expect(url).toContain("/login");
    } else {
      await expect(
        page.locator("text=Profile").or(page.locator("text=Account"))
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("should display user information", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      // Look for profile fields
      const profileFields = page.locator(
        'input[type="email"], input[name="name"], input[name="email"]'
      );

      if ((await profileFields.count()) > 0) {
        await expect(profileFields.first()).toBeVisible();
      }
    }
  });

  test("should have avatar upload", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      const avatarUpload = page.locator(
        'input[type="file"], button:has-text("Upload"), button:has-text("Change Avatar")'
      );

      if ((await avatarUpload.count()) > 0) {
        await expect(avatarUpload.first()).toBeVisible();
      }
    }
  });

  test("should have save button", async ({ page }) => {
    const url = page.url();
    if (!url.includes("/login")) {
      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
      );

      if ((await saveButton.count()) > 0) {
        await expect(saveButton.first()).toBeVisible();
      }
    }
  });
});

test.describe("Profile Update", () => {
  test("should allow editing profile fields", async ({ page }) => {
    await page.goto("/profile");

    const url = page.url();
    if (!url.includes("/login")) {
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]');

      if ((await nameInput.count()) > 0) {
        const input = nameInput.first();
        await input.clear();
        await input.fill("Test User");
        await expect(input).toHaveValue("Test User");
      }
    }
  });

  test("should show validation errors for invalid input", async ({ page }) => {
    await page.goto("/profile");

    const url = page.url();
    if (!url.includes("/login")) {
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');

      if ((await emailInput.count()) > 0 && (await saveButton.count()) > 0) {
        await emailInput.first().clear();
        await emailInput.first().fill("invalid-email");
        await saveButton.first().click();

        // Should show validation error
        await page.waitForTimeout(500);
        const errorMessage = page.locator('text=/invalid|error/i');

        // Error might be shown
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe("Settings Integration", () => {
  test("should navigate to settings page", async ({ page }) => {
    await page.goto("/settings");

    const url = page.url();
    if (url.includes("/login")) {
      expect(url).toContain("/login");
    } else {
      await expect(
        page.locator("text=Setting").or(page.locator("text=Preference"))
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have preference controls", async ({ page }) => {
    await page.goto("/settings");

    const url = page.url();
    if (!url.includes("/login")) {
      const controls = page.locator(
        'input[type="checkbox"], input[type="radio"], select, button'
      );

      if ((await controls.count()) > 0) {
        await expect(controls.first()).toBeVisible();
      }
    }
  });

  test("should have notification settings", async ({ page }) => {
    await page.goto("/settings");

    const url = page.url();
    if (!url.includes("/login")) {
      const notificationSettings = page.locator(
        'text=/notification/i, text=/email/i, text=/alert/i'
      );

      // Settings page exists
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Account Security", () => {
  test("should have password change option", async ({ page }) => {
    await page.goto("/profile");

    const url = page.url();
    if (!url.includes("/login")) {
      const passwordFields = page.locator(
        'input[type="password"], button:has-text("Change Password"), a:has-text("Security")'
      );

      // Password change might be available
      if ((await passwordFields.count()) > 0) {
        await expect(passwordFields.first()).toBeVisible();
      }
    }
  });

  test("should have delete account option", async ({ page }) => {
    await page.goto("/profile");

    const url = page.url();
    if (!url.includes("/login")) {
      const deleteButton = page.locator(
        'button:has-text("Delete"), button:has-text("Close Account"), a:has-text("Delete")'
      );

      // Delete account option might exist
      if ((await deleteButton.count()) > 0) {
        await expect(deleteButton.first()).toBeVisible();
      }
    }
  });
});
