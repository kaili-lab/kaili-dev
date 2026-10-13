import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

import golden from '../fixtures/og-golden.json' with { type: 'json' }

// PNG header: 8-byte signature, then the IHDR chunk with width/height.
function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) }
}

function ogImage(html: string) {
  return html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
}

test.describe('T3.4 OG cards in the production Worker', () => {
  for (const [header, language, title] of [
    ['zh-CN,zh;q=0.9', 'zh', '把边界写清楚'],
    ['en-US,en;q=0.9', 'en', 'Make boundaries visible'],
    ['', 'zh', '把边界写清楚'],
  ] as const) {
    test(`neutral share link with Accept-Language "${header}" uses the final ${language} page`, async ({
      request,
    }) => {
      const page = await request.get('/writing/boundary-example', {
        headers: header ? { 'Accept-Language': header } : {},
      })
      expect(page.status()).toBe(200)
      expect(new URL(page.url()).pathname).toBe(
        `/${language}/writing/boundary-example`,
      )
      const html = await page.text()
      expect(html).toContain(`<meta property="og:title" content="${title}"/>`)
      const image = ogImage(html)
      expect(image).toBe(`https://kaili.dev/og/${language}/boundary-example`)

      const card = await request.get(new URL(image!).pathname)
      expect(card.status()).toBe(200)
      expect(card.headers()['content-type']).toBe('image/png')
      const body = await card.body()
      expect(pngSize(body)).toEqual({ width: 1200, height: 630 })
      // Same bytes as tests/og-render.test.mjs renders from the published
      // version, so the Worker serves exactly the published card.
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        golden[language],
      )
    })
  }

  for (const path of ['/og/zh/zh-only-example', '/og/en/en-only-example']) {
    test(`${path} renders a 1200x630 PNG`, async ({ request }) => {
      const card = await request.get(path)
      expect(card.status()).toBe(200)
      expect(pngSize(await card.body())).toEqual({ width: 1200, height: 630 })
    })
  }

  for (const path of [
    '/og/en/zh-only-example',
    '/og/zh/en-only-example',
    '/og/zh/private-example',
    '/og/en/private-example',
    '/og/zh/missing',
    '/og/fr/boundary-example',
    '/_og-smoke?id=short',
  ]) {
    test(`${path} has no public card`, async ({ request }) => {
      const response = await request.get(path)
      expect(response.status()).toBe(404)
      expect(response.headers()['content-type']).not.toBe('image/png')
    })
  }
})
