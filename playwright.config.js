const path = require("path");
const { defineConfig, devices } = require("@playwright/test");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "e2e", ".env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, ".env"), override: false, quiet: true });

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";
const isCI = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: "npm --prefix backend run dev",
      url: "http://localhost:5000/api/health",
      reuseExistingServer: !isCI,
      timeout: 120000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm --prefix frontend run dev",
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
