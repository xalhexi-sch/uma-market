import { defineConfig } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, resolveAppEnv } from "./tests/browser/harness";

/**
 * Browser regression configuration.
 *
 * The application under test is a local Next.js dev server started with the
 * ISOLATED security-test credentials injected as real process variables.
 * `process.env` has the highest precedence in Next.js env resolution, so the
 * production `.env.local` is present on disk but is never the active config.
 *
 * No production credentials are used and nothing is written to .env files.
 */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: /.*\.spec\.ts/,
  // The two specs mutate shared fixtures in one isolated database; running them
  // serially keeps every assertion deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: E2E_BASE_URL,
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npx next dev --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    env: resolveAppEnv(),
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});