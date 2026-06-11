import { test as setup, expect } from "@playwright/test";
import { demoPassword } from "../playwright.config";

const BACKEND = "http://localhost:12080";

setup("authenticate as koerier", async ({ page, request }) => {
  // fail fast with a clear message when the backend stack is down
  const health = await request.get(`${BACKEND}/actuator/health`).catch(() => null);
  if (!health?.ok()) {
    throw new Error(`dhl-backend is not running on ${BACKEND} — start compose deps + bootRun first`);
  }

  await page.goto("/");
  await page.locator("#username").fill("koerier");
  await page.locator("#password").fill(demoPassword());
  await page.locator("#kc-login").click();
  await expect(page.getByText("Ritoverzicht")).toBeVisible({ timeout: 15_000 });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
