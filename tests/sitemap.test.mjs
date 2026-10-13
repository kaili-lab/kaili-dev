import { describe, expect, it } from 'vitest'

import { renderSitemap, sitemapEntries } from '../src/features/sitemap.ts'

const version = (date) => ({
  title: 't',
  summary: 's',
  body: 'b',
  publishedAt: date,
  updatedAt: date,
})
const posts = [
  {
    slug: 'both',
    category: 'c',
    tags: [],
    zh: version('2026-01-02'),
    en: version('2026-01-03'),
  },
  { slug: 'zh-only', category: 'c', tags: [], zh: version('2026-01-01') },
  { slug: 'none', category: 'c', tags: [] },
]

describe('T6.1 sitemap entries', () => {
  const entries = sitemapEntries(posts)
  const locs = entries.map((entry) =>
    entry.loc.replace('https://kaili.dev', ''),
  )

  it('lists static pages in both languages and only published article versions', () => {
    expect(locs).toEqual([
      '/zh',
      '/en',
      '/zh/writing',
      '/en/writing',
      '/zh/projects',
      '/en/projects',
      '/zh/bookshelf',
      '/en/bookshelf',
      '/zh/writing/both',
      '/en/writing/both',
      '/zh/writing/zh-only',
    ])
  })

  it('links alternates only between published versions', () => {
    const byLoc = Object.fromEntries(
      entries.map((entry) => [
        entry.loc.replace('https://kaili.dev', ''),
        entry,
      ]),
    )
    expect(byLoc['/zh/writing/zh-only'].alternates).toEqual([
      { hreflang: 'zh-CN', href: 'https://kaili.dev/zh/writing/zh-only' },
    ])
    expect(byLoc['/en/writing/both'].alternates.map((a) => a.hreflang)).toEqual(
      ['zh-CN', 'en'],
    )
    expect(byLoc['/en/writing/both'].lastmod).toBe('2026-01-03')
  })

  it('escapes special characters in text and attributes', () => {
    const xml = renderSitemap([
      {
        loc: 'https://kaili.dev/a&b<c>"d',
        lastmod: '2026&01',
        alternates: [{ hreflang: 'en', href: 'https://kaili.dev/x"y&z<w>' }],
      },
    ])
    expect(xml).toContain(
      '<loc>https://kaili.dev/a&amp;b&lt;c&gt;&quot;d</loc>',
    )
    expect(xml).toContain('<lastmod>2026&amp;01</lastmod>')
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://kaili.dev/x&quot;y&amp;z&lt;w&gt;"/>',
    )
    // No raw special character survives outside markup.
    const text = xml.replace(/<[^>]+>/g, '')
    expect(text).not.toMatch(/[<>"]|&(?!amp;|lt;|gt;|quot;)/)
  })

  it('escapes XML special characters', () => {
    const xml = renderSitemap([
      { loc: 'https://kaili.dev/a&b', alternates: [] },
    ])
    expect(xml).toContain('<loc>https://kaili.dev/a&amp;b</loc>')
  })
})
