/* global document, localStorage */
// T5.4: screenshot matrix of the real admin on the dev server.
// Usage: node scripts/capture-admin.mjs <baseURL> <outputDir>
import console from 'node:console'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const [base = 'http://127.0.0.1:3100', out = 'test-results/admin'] =
  process.argv.slice(2)
const widths = { 1440: 1000, 820: 1100, 390: 844 }
const ready = (page) => page.locator('.ad-root[data-hydrated]').waitFor()
const states = {
  list: async (page) => {
    await page.goto(`${base}/admin/posts`)
  },
  'editor-zh-modified': async (page) => {
    await page.goto(`${base}/admin/posts/boundary-example?lang=zh`)
  },
  'editor-en-unsaved': async (page) => {
    await page.goto(`${base}/admin/posts/boundary-example?lang=en`)
    await ready(page)
    await page.getByLabel('标题').fill('Unsaved English title')
  },
  'editor-new-error': async (page) => {
    await page.goto(`${base}/admin/posts/new`)
    await ready(page)
    await page.getByRole('button', { name: '发布中文' }).click()
    await page.locator('.ad-toolbar [role="alert"]').waitFor()
  },
  'editor-published': async (page) => {
    await page.goto(`${base}/admin/posts/zh-only-example?lang=zh`)
    await ready(page)
    await page.getByRole('button', { name: '发布中文' }).click()
    await page.locator('.ad-toolbar [role="status"]').waitFor()
  },
  'new-category-dialog': async (page) => {
    await page.goto(`${base}/admin/posts/new`)
    await ready(page)
    await page.getByRole('button', { name: '新建分类' }).click()
  },
  ideas: async (page) => {
    await page.goto(`${base}/admin/ideas`)
  },
  'idea-edit': async (page) => {
    await page.goto(`${base}/admin/ideas/idea-boundaries`)
  },
  'taxonomy-categories': async (page) => {
    await page.goto(`${base}/admin/taxonomy?tab=categories`)
  },
  'taxonomy-tags': async (page) => {
    await page.goto(`${base}/admin/taxonomy?tab=tags`)
  },
}

await mkdir(resolve(out), { recursive: true })
const browser = await chromium.launch()
const rows = []
try {
  for (const theme of ['light', 'dark'])
    for (const [width, height] of Object.entries(widths))
      for (const [state, act] of Object.entries(states)) {
        const context = await browser.newContext({
          viewport: { width: Number(width), height },
          colorScheme: theme,
        })
        await context.addInitScript(
          (value) => localStorage.setItem('kaili-theme', value),
          theme,
        )
        const page = await context.newPage()
        await page.request.post(`${base}/_test-reset?fixture=default`)
        await act(page)
        await ready(page)
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth !==
            document.documentElement.clientWidth,
        )
        const file = `${state}-${width}-${theme}.png`
        // Fixed overlays do not survive a full-page capture; shoot the viewport.
        await page.screenshot({
          path: resolve(out, file),
          fullPage: !state.includes('dialog'),
        })
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
if (bad.length) {
  console.log(bad)
  process.exitCode = 1
}
