import { renderSitemap, sitemapEntries } from '#/features/sitemap'
import { publishedPosts } from '#/server/data/posts'

export function sitemapResponse(): Response {
  return new Response(renderSitemap(sitemapEntries(publishedPosts())), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Publishing must show up at once (R-SEO-06); no long cache yet.
      'Cache-Control': 'no-cache',
    },
  })
}
