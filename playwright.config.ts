import { defineConfig, devices } from "@playwright/test";

// Lokale Browser-Kernsuite gegen den selbst gestarteten Production-Build
// (bewusst kein Deploy-Gate, siehe README/AGENTS.md). Der webServer-Befehl
// prüft den Build, legt eine Wegwerf-SQLite an, seedet Fixtures und startet
// `next start` auf Port 3900.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3900",
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec tsx e2e/start-app.ts",
    url: "http://127.0.0.1:3900/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    // SIGTERM statt SIGKILL, damit start-app.ts die Wegwerf-DB aufräumen kann.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
});
