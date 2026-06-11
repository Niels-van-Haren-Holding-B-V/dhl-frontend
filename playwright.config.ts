import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

// The demo password lives in dhl-backend/infra/.env, never in git.
export function demoPassword(): string {
  if (process.env.E2E_PASSWORD) return process.env.E2E_PASSWORD;
  const env = readFileSync(new URL("../dhl-backend/infra/.env", import.meta.url), "utf8");
  const match = /^DEMO_USER_PASSWORD=(.+)$/m.exec(env);
  if (!match) throw new Error("DEMO_USER_PASSWORD not found; set E2E_PASSWORD or fill infra/.env");
  return match[1].trim();
}

/**
 * E2E against the real local stack. Prerequisite: the dhl-backend runs on
 * :12080 (compose deps + bootRun). The machine state is shared, so the suite
 * runs serially and starts every test from a demo reset.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
