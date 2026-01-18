import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  timeout: 600_000, // 10 minutes for long-running scans
  retries: 0,
  use: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
