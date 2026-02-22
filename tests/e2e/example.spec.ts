import { test, expect } from "@playwright/test";

// Chrome extension e2e tests require loading the unpacked extension via
// chromium.launchPersistentContext with --load-extension and
// --disable-extensions-except flags pointing to the built dist/ folder.
// See: https://playwright.dev/docs/chrome-extensions

test("placeholder: Playwright is configured correctly", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page).toHaveTitle(/Example Domain/);
});
