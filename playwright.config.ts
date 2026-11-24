import { defineConfig } from '@playwright/test';

// The e2e suite boots the real dev server (the same one the owner uses for
// manual play) and drives the full new-pilot flow in a real browser.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite --host 0.0.0.0 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
