import { defineConfig } from '@playwright/test'

// T5.4: the admin only exists in development (D-132), so its end-to-end
// tests run against the dev server. One worker: the prototype stores are
// shared module state, reset before every test via /_test-reset.
export default defineConfig({
  testDir: './tests/admin-e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3200', browserName: 'chromium' },
  webServer: {
    command:
      'pnpm og:fonts && pnpm exec vite dev --port 3200 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:3200/zh',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
