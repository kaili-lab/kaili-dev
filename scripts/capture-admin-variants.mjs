/* global document, localStorage */
// T5.3b: screenshots of the admin list and editor variants (dev server).
// Usage: node scripts/capture-admin-variants.mjs <baseURL> <outputDir>
import console from 'node:console'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const [base = 'http://127.0.0.1:3100', out = 'test-results/admin-variants'] =
  process.argv.slice(2)
const widths = { 1440: 1000, 820: 1100, 390: 844 }
// Representative of the 16 combinations: each state appears in each tab.
const states = {
  list: 'page=list',
  'list-empty': 'page=list-empty',
  'editor-zh-P-M-published': 'page=editor&tab=zh&zh=P&en=M&feedback=published',
  'editor-en-P-M-unsaved': 'page=editor&tab=en&zh=P&en=M&unsaved=1',
  'editor-zh-D-N-error': 'page=editor&tab=zh&zh=D&en=N&feedback=error',
  'editor-en-N-D-saved': 'page=editor&tab=en&zh=N&en=D&feedback=saved',
  'editor-zh-M-M-unsaved': 'page=editor&tab=zh&zh=M&en=M&unsaved=1',
}

await mkdir(resolve(out), { recursive: true })
const browser = await chromium.launch()
const rows = []
try {
  for (const theme of ['light', 'dark'])
    for (const [width, height] of Object.entries(widths)) {
      const context = await browser.newContext({
        viewport: { width: Number(width), height },
        colorScheme: theme,
      })
      await context.addInitScript(
        (value) => localStorage.setItem('kaili-theme', value),
        theme,
      )
      const page = await context.newPage()
      for (const variant of ['a', 'b'])
        for (const [state, query] of Object.entries(states)) {
          const response = await page.goto(
            `${base}/_admin-variants?variant=${variant}&${query}`,
            { waitUntil: 'networkidle' },
          )
          await page.evaluate(() => document.fonts.ready)
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth !==
              document.documentElement.clientWidth,
          )
          const file = `${variant}-${state}-${width}-${theme}.png`
          await page.screenshot({ path: resolve(out, file), fullPage: true })
          rows.push({
            variant,
            state,
            width: Number(width),
            theme,
            status: response?.status(),
            overflow,
            file,
          })
        }
      await context.close()
    }
} finally {
  await browser.close()
}
await writeFile(
  resolve(out, 'matrix.json'),
  `${JSON.stringify(rows, null, 2)}\n`,
)
const bad = rows.filter((row) => row.status !== 200 || row.overflow)
console.log(
  `${rows.length} screenshots, ${bad.length} with non-200 or horizontal overflow`,
)
if (bad.length) {
  console.log(bad)
  process.exitCode = 1
}
