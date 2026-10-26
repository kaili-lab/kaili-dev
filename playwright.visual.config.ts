import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
  expect: {
    toHaveScreenshot: {
      pathTemplate: 'docs/notes/2026-10-25-visual-baseline/{arg}{ext}',
    },
  },
  webServer: {
    command: 'pnpm d1:seed && pnpm preview --host 0.0.0.0 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
})
