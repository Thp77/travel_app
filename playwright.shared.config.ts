import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'shared.spec.ts',
  outputDir: 'test-results/shared',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-travel-app.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-travel-app', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_FIREBASE_EMULATORS: 'true' },
  },
})
