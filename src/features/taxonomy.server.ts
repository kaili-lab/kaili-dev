import type { Language } from '#/features/posts'
import type { TaxonomyEntry } from '#/server/data/taxonomy'

export function categoryLabel(
  entries: readonly TaxonomyEntry[],
  slug: string,
  language: Language,
): string {
  return entries.find((entry) => entry.slug === slug)?.[language] ?? slug
}

export function tagLabel(
  entries: readonly TaxonomyEntry[],
  slug: string,
  language: Language,
): string {
  return entries.find((entry) => entry.slug === slug)?.[language] ?? slug
}
