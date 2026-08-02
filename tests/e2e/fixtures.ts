import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, chromium, type BrowserContext } from "@playwright/test";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const pathToExtension = path.resolve(dirname, "../../dist");

/**
 * Playwright fixtures that load the built extension from dist/.
 * Run `pnpm build` before `pnpm test:e2e`.
 * See: https://playwright.dev/docs/chrome-extensions
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
