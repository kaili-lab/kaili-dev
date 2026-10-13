import type { Language } from '#/features/posts'
import { categories, tags } from '#/server/data/taxonomy'

/**
 * Display name of a category. Server-only: server functions attach the
 * result to what they return, so the category table never ships to the
 * client bundle.
 */
export function categoryLabel(slug: string, language: Language) {
  return categories.find((entry) => entry.slug === slug)?.[language] ?? slug
}

/** Display name of a tag (D-118: English pages show the English name). */
export function tagLabel(slug: string, language: Language) {
  return tags.find((entry) => entry.slug === slug)?.[language] ?? slug
}
