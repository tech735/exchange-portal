import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * End-to-end tests. They run against a production build (vite preview) that
 * talks to the real Supabase project, using temporary accounts and E2E-TEST-…
 * records created by e2e/seed.mjs and removed by e2e/cleanup.mjs.
 *
 *   E2E_SECRETS=<env file> E2E_STATE=<state.json> node e2e/seed.mjs
 *   E2E_STATE=<state.json> npx playwright test
 *   E2E_SECRETS=<env file> E2E_STATE=<state.json> node e2e/cleanup.mjs
 */
const stateDir = process.env.E2E_STATE ? path.dirname(process.env.E2E_STATE) : '.e2e';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(stateDir, 'e2e-report') }]],
  outputDir: path.join(stateDir, 'e2e-results'),
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, dependencies: ['setup'], testIgnore: /(auth\.setup|responsive)\.spec\.ts|auth\.setup\.ts/ },
    { name: 'devices', use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'], testMatch: /responsive\.spec\.ts/ },
  ],
});
