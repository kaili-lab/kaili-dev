import { renderSitemap, sitemapEntries } from '#/features/sitemap'
import { publishedPosts } from '#/server/data/posts'
import { runtimeDatabase } from '#/server/data/db'

export async function sitemapResponse(): Promise<Response> {
  const posts = await publishedPosts(await runtimeDatabase())
  return new Response(renderSitemap(sitemapEntries(posts)), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
