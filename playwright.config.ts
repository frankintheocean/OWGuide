import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:1420",
    headless: true,
    launchOptions: process.env.OWGUIDE_CHROMIUM
      ? { executablePath: process.env.OWGUIDE_CHROMIUM }
      : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "small", use: { viewport: { width: 850, height: 720 } } },
  ],
});
