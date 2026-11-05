import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "core.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "node tests/support/supabase.mjs",
      url: "http://127.0.0.1:54329/health",
    },
    {
      command: "npm run start -- --port 3001",
      url: "http://127.0.0.1:3001",
      env: {
        APP_URL: "http://127.0.0.1:3001",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
        OWNER_AUTH_USER_ID: "00000000-0000-4000-8000-000000000001",
        OWNER_EMAIL: "owner@example.test",
      },
    },
  ],
});
