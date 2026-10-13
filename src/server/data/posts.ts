import type { PublicPost } from '#/features/posts'
import { publishedPosts } from '#/server/data/articles'

export { publishedPosts }

export function getPost(slug: string): PublicPost | undefined {
  return publishedPosts().find((post) => post.slug === slug)
}
