import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 15_000,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'node apps/web/node_modules/next/dist/bin/next dev apps/web --turbopack',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_URL: 'https://api.not-hosted.invalid',
      NEXT_PUBLIC_PREVIEW_MODE: 'true',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
