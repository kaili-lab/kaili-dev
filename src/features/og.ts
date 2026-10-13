import type { OgCardInput } from '#/server/og-card'
import { categoryLabel } from '#/features/taxonomy.server'
import { getPost } from '#/server/data/posts'

/**
 * The share card for one formal article URL. Only that language's published
 * version is read (D-084); a language without a published version has no
 * public card, and there is no fallback to the other language (D-143).
 */
export function publishedOgCard(
  language: string,
  slug: string,
): OgCardInput | undefined {
  if (language !== 'zh' && language !== 'en') return undefined
  const post = getPost(slug)
  const version = post?.[language]
  if (!post || !version) return undefined
  return {
    language,
    title: version.title,
    summary: version.summary,
    category: categoryLabel(version.category, language),
    publishedAt: version.publishedAt,
  }
}
