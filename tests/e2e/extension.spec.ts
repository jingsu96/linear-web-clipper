import { test, expect } from "./fixtures";

test("service worker registers on install", async ({
  context,
  extensionId,
}) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);
  const [serviceWorker] = context.serviceWorkers();
  expect(serviceWorker.url()).toContain(extensionId);
});

test("options page renders settings tabs", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

  await expect(
    page.getByRole("heading", { name: "Linear Web Clipper Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Linear Integration" }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("lin_api_xxxxxxxxxxxxxxxxxxxx"),
  ).toBeVisible();
});

test("sidepanel shows setup guidance when unconfigured", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

  await expect(
    page.getByRole("heading", { name: "Linear Web Clipper" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Not Configured" }),
  ).toBeVisible();
  await expect(
    page.getByText("Please configure your Linear API key"),
  ).toBeVisible();
});
