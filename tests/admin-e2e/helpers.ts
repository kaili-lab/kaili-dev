import { createHash } from 'node:crypto'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export async function reset(request: APIRequestContext, fixture = 'default') {
  const response = await request.post(`/_test-reset?fixture=${fixture}`)
  expect(response.status()).toBe(204)
}

/** Replace the whole CodeMirror document. */
export async function typeBody(page: Page, text: string) {
  const editor = page.locator('.cm-content').first()
  await editor.click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(text)
}

/** Everything public about one formal article page, for before/after diffs. */
export async function publicSnapshot(request: APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 })
  const html = response.status() === 200 ? await response.text() : ''
  const pick = (pattern: RegExp) => html.match(pattern)?.[1] ?? null
  const ogImage = pick(/<meta property="og:image" content="([^"]+)"/)
  let ogHash: string | null = null
  if (ogImage) {
    const card = await request.get(new URL(ogImage).pathname)
    expect(card.status(), ogImage).toBe(200)
    expect(card.headers()['content-type'], ogImage).toBe('image/png')
    ogHash = createHash('sha256')
      .update(await card.body())
      .digest('hex')
  }
  // All visible text of the page body: article prose, headings and meta.
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ''
  const mainText = main
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    status: response.status(),
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]+)"/),
    hreflang: [
      ...html.matchAll(
        /<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi,
      ),
    ].map(([, lang, href]) => `${lang} ${href}`),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/),
    ogDescription: pick(/<meta property="og:description" content="([^"]*)"/),
    h1: pick(/<h1[^>]*>([^<]*)<\/h1>/),
    ogHash,
    mainText,
  }
}

/** Sitemap members as `loc lastmod`. */
export async function sitemap(request: APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text()
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => {
    const loc = body!.match(/<loc>([^<]+)<\/loc>/)?.[1]
    const lastmod = body!.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? ''
    return `${loc} ${lastmod}`
  })
}

export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

/** Navigate and wait until React has attached its handlers. */
export async function open(page: Page, path: string) {
  await page.goto(path)
  await page.locator('.ad-root[data-hydrated]').waitFor()
}
