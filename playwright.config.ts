import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`next build && next start`)
 * using a dedicated database that the global setup resets and seeds.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5433/corpweb_e2e?schema=public";

const serverEnv = {
  NODE_ENV: "production",
  APP_ENV: "test",
  SITE_URL: BASE_URL,
  SITE_INDEXABLE: "false",
  DATABASE_URL: E2E_DATABASE_URL,
  APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  ADMIN_MFA_REQUIRED: "true",
  EMAIL_PROVIDER: "console",
  MEDIA_STORAGE_DIR: "./storage/e2e-media",
  NEXT_DIST_DIR: ".next-e2e",
  LOG_LEVEL: "warn",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npx next start -p ${PORT} -H 127.0.0.1`
      : `npx next build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: `${BASE_URL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: serverEnv,
    stdout: "ignore",
    stderr: "pipe",
  },
});

export { serverEnv };
