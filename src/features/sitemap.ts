import type { Language, PublicPost } from '#/features/posts'

// D-082 / R-SEO-06: only formal, public, language-prefixed pages. Neutral
// share links, filtered lists, 404s, drafts, admin and development routes
// are never members.

export const SITE_ORIGIN = 'https://kaili.dev'

const languages: Language[] = ['zh', 'en']
const hreflang: Record<Language, string> = { zh: 'zh-CN', en: 'en' }
const staticPaths = ['', '/writing', '/projects', '/bookshelf']

export type SitemapEntry = {
  loc: string
  alternates: { hreflang: string; href: string }[]
  lastmod?: string
}

export function sitemapEntries(posts: PublicPost[]): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  for (const path of staticPaths)
    for (const language of languages)
      entries.push({
        loc: `${SITE_ORIGIN}/${language}${path}`,
        alternates: languages.map((other) => ({
          hreflang: hreflang[other],
          href: `${SITE_ORIGIN}/${other}${path}`,
        })),
      })
  for (const post of posts) {
    // Same closed set as the article page's hreflang: published versions only.
    const published = languages.filter((language) => post[language])
    for (const language of published)
      entries.push({
        loc: `${SITE_ORIGIN}/${language}/writing/${post.slug}`,
        alternates: published.map((other) => ({
          hreflang: hreflang[other],
          href: `${SITE_ORIGIN}/${other}/writing/${post.slug}`,
        })),
        // Moves on every publish of this language (R-SEO-06).
        lastmod: post[language]!.updatedAt,
      })
  }
  return entries
}

const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      '  <url>',
      `    <loc>${escape(entry.loc)}</loc>`,
      ...(entry.lastmod
        ? [`    <lastmod>${escape(entry.lastmod)}</lastmod>`]
        : []),
      ...entry.alternates.map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escape(alternate.href)}"/>`,
      ),
      '  </url>',
    ].join('\n'),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
