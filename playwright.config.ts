import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests in a real browser.
 *
 * These run against the system Google Chrome (`channel: 'chrome'`) rather than a
 * Playwright-managed build, so nothing has to download a browser to check the
 * game out and run `npm run test:e2e`.
 *
 * The jsdom tests in `src/` cover the click wiring. These cover what jsdom
 * cannot: that the plot actually lays out as a 5×5 grid, that the legal-cell
 * highlight is a visible colour change, and that a real browser reaches the end
 * of a game without a console error.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
