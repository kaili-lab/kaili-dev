/* global document, localStorage */
// T4.2: screenshot matrix of the real writing list (production preview).
// Usage: node scripts/capture-writing-list.mjs <baseURL> <outputDir>
import console from 'node:console'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const [base = 'http://127.0.0.1:4310', out = 'test-results/writing-list'] =
  process.argv.slice(2)
const widths = { 1440: 1000, 820: 1100, 390: 844 }
const states = {
  default: { path: '/zh/writing' },
  filtered: { path: '/zh/writing?category=engineering&tag=typescript' },
  empty: { path: '/zh/writing?category=engineering&tag=cloudflare' },
  notice: { from: '/en/writing/en-only-example', button: '中' },
  'en-default': { path: '/en/writing' },
  'en-notice': { from: '/zh/writing/zh-only-example', button: 'EN' },
}

await mkdir(resolve(out), { recursive: true })
const browser = await chromium.launch()
const rows = []
try {
  for (const theme of ['light', 'dark'])
    for (const [width, height] of Object.entries(widths))
      for (const [state, how] of Object.entries(states)) {
        const context = await browser.newContext({
          viewport: { width: Number(width), height },
          colorScheme: theme,
        })
        await context.addInitScript(
          (value) => localStorage.setItem('kaili-theme', value),
          theme,
        )
        const page = await context.newPage()
        if (how.path) await page.goto(`${base}${how.path}`)
        else {
          await page.goto(`${base}${how.from}`)
          await page.getByRole('button', { name: how.button }).click()
          await page.getByRole('status').waitFor()
        }
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth !==
            document.documentElement.clientWidth,
        )
        const file = `${state}-${width}-${theme}.png`
        await page.screenshot({ path: resolve(out, file), fullPage: true })
        rows.push({
          state,
          width: Number(width),
          theme,
          url: page.url(),
          overflow,
          file,
        })
        await context.close()
      }
} finally {
  await browser.close()
}
await writeFile(
  resolve(out, 'matrix.json'),
  `${JSON.stringify(rows, null, 2)}\n`,
)
const bad = rows.filter((row) => row.overflow)
console.log(
  `${rows.length} screenshots, ${bad.length} with horizontal overflow`,
)
if (bad.length) process.exitCode = 1
