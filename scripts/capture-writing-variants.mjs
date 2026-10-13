/* global document, localStorage */
// T4.1b: screenshots of the writing-list variants on the dev server.
// Usage: node scripts/capture-writing-variants.mjs <baseURL> <outputDir>
import console from 'node:console'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const [base = 'http://127.0.0.1:3100', out = 'test-results/writing-variants'] =
  process.argv.slice(2)
const widths = { 1440: 1000, 820: 1100, 390: 844 }
const runs = []
for (const variant of ['links', 'pills', 'select'])
  for (const state of ['default', 'filtered', 'empty', 'notice'])
    runs.push({ variant, state, lang: 'zh' })
for (const variant of ['links', 'pills', 'select'])
  for (const state of ['default', 'notice'])
    runs.push({ variant, state, lang: 'en' })

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
      for (const run of runs) {
        const url = `${base}/_writing-variants?variant=${run.variant}&state=${run.state}&lang=${run.lang}`
        const response = await page.goto(url, { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth !==
            document.documentElement.clientWidth,
        )
        const file = `${run.variant}-${run.state}-${run.lang}-${width}-${theme}.png`
        await page.screenshot({ path: resolve(out, file), fullPage: true })
        rows.push({
          ...run,
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
