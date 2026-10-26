import type { D1Database } from '#/server/data/db'
import {
  getStoredArticle as readStoredArticle,
  publishedPosts,
} from '#/server/data/articles'
import type { PublicPost } from '#/features/posts'

export { publishedPosts }

export async function getPost(
  database: D1Database,
  slug: string,
): Promise<PublicPost | undefined> {
  const posts = await publishedPosts(database)
  return posts.find((post) => post.slug === slug)
}

export { readStoredArticle }
