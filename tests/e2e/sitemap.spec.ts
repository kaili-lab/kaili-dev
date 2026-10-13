import { expect, test } from '@playwright/test'

// T6.1 / D-082 / R-SEO-06 on the production Worker with the fixture data:
// boundary-example (zh + en), zh-only-example, en-only-example published;
// private-example has no published version.

const origin = 'https://kaili.dev'
const both = (path: string) => [
  { hreflang: 'zh-CN', href: `${origin}/zh${path}` },
  { hreflang: 'en', href: `${origin}/en${path}` },
]
// Independent expectation: every member with its exact alternates, in order.
const expected: Record<string, { hreflang: string; href: string }[]> = {}
for (const path of ['', '/writing', '/projects', '/bookshelf'])
  for (const language of ['zh', 'en'])
    expected[`${origin}/${language}${path}`] = both(path)
expected[`${origin}/zh/writing/boundary-example`] = both(
  '/writing/boundary-example',
)
expected[`${origin}/en/writing/boundary-example`] = both(
  '/writing/boundary-example',
)
expected[`${origin}/zh/writing/zh-only-example`] = [
  { hreflang: 'zh-CN', href: `${origin}/zh/writing/zh-only-example` },
]
expected[`${origin}/en/writing/en-only-example`] = [
  { hreflang: 'en', href: `${origin}/en/writing/en-only-example` },
]

type Parsed = {
  parseError: boolean
  root: string
  namespace: string | null
  members: {
    loc: string
    lastmod: string | null
    alternates: { hreflang: string; href: string }[]
  }[]
}

async function parseSitemap(
  page: import('@playwright/test').Page,
  xml: string,
): Promise<Parsed> {
  await page.goto('about:blank')
  return page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'application/xml')
    const sm = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    const xhtml = 'http://www.w3.org/1999/xhtml'
    return {
      parseError: doc.getElementsByTagName('parsererror').length > 0,
      root: doc.documentElement.localName,
      namespace: doc.documentElement.namespaceURI,
      members: [...doc.getElementsByTagNameNS(sm, 'url')].map((url) => ({
        loc: url.getElementsByTagNameNS(sm, 'loc')[0]?.textContent ?? '',
        lastmod:
          url.getElementsByTagNameNS(sm, 'lastmod')[0]?.textContent ?? null,
        alternates: [...url.getElementsByTagNameNS(xhtml, 'link')].map(
          (link) => ({
            hreflang: link.getAttribute('hreflang') ?? '',
            href: link.getAttribute('href') ?? '',
          }),
        ),
      })),
    }
  }, xml)
}

test('sitemap is valid XML listing exactly the public formal pages', async ({
  page,
  request,
}) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe(
    'application/xml; charset=utf-8',
  )
  const parsed = await parseSitemap(page, await response.text())
  expect(parsed.parseError).toBe(false)
  expect(parsed.root).toBe('urlset')
  expect(parsed.namespace).toBe('http://www.sitemaps.org/schemas/sitemap/0.9')
  // Full absolute URLs, exact set, no duplicates, exact alternates per member.
  const locs = parsed.members.map((member) => member.loc)
  expect(new Set(locs).size).toBe(locs.length)
  expect([...locs].sort()).toEqual(Object.keys(expected).sort())
  for (const member of parsed.members) {
    expect(member.alternates, member.loc).toEqual(expected[member.loc])
    for (const url of [member.loc, ...member.alternates.map((a) => a.href)]) {
      const parsedUrl = new URL(url)
      expect(parsedUrl.origin, url).toBe(origin)
      expect(parsedUrl.search, url).toBe('')
      expect(parsedUrl.hash, url).toBe('')
      expect(parsedUrl.pathname.startsWith('/writing/'), url).toBe(false)
    }
    expect(member.lastmod, member.loc).toBe(
      member.loc.includes('/writing/')
        ? member.loc.includes('en-only')
          ? '2026-07-01T00:00:00.000Z'
          : member.loc.includes('zh-only')
            ? '2026-08-01T00:00:00.000Z'
            : '2026-09-02T00:00:00.000Z'
        : null,
    )
  }
})

test('every member is a live page whose canonical and hreflang match', async ({
  page,
  request,
}) => {
  const parsed = await parseSitemap(
    page,
    await (await request.get('/sitemap.xml')).text(),
  )
  for (const member of parsed.members) {
    const path = new URL(member.loc).pathname
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(200)
    const html = await response.text()
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"\/>/)?.[1]
    expect(new URL(canonical!, origin).href, path).toBe(member.loc)
    const pageAlternates = [
      ...html.matchAll(
        /<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"\/>/gi,
      ),
    ].map(([, hreflang, href]) => ({
      hreflang: hreflang!,
      href: new URL(href!, origin).href,
    }))
    expect(pageAlternates, path).toEqual(member.alternates)
  }
})

test('special characters survive a real XML parse round trip', async ({
  page,
}) => {
  const { renderSitemap } = await import('../../src/features/sitemap.ts')
  const loc = 'https://kaili.dev/a&b<c>"d\'e'
  const href = 'https://kaili.dev/x"y&z<w>'
  const xml = renderSitemap([
    { loc, lastmod: '2026&01', alternates: [{ hreflang: 'en', href }] },
  ])
  const parsed = await parseSitemap(page, xml)
  expect(parsed.parseError).toBe(false)
  expect(parsed.members).toEqual([
    { loc, lastmod: '2026&01', alternates: [{ hreflang: 'en', href }] },
  ])
})
