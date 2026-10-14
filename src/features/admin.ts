// Pure admin rules (T5.4). Data access lives in src/server/data; server
// functions in admin.functions.ts combine the two.

import type {
  Article,
  Language,
  VersionState,
} from '#/features/article-versions'
import { versionState } from '#/features/article-versions'

export type TaxonomyEntry = { slug: string; zh: string; en: string }
export type TaxonomyError =
  'zh-required' | 'en-required' | 'slug-format' | 'slug-taken' | 'slug-locked'

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff]/g

/** Same blank rule as article content (D-156 ⑤), for names and Ideas. */
export function isBlank(value: string | null | undefined): boolean {
  return !value || value.replace(ZERO_WIDTH, '').trim() === ''
}

/** D-158 ②: names required; slug format; unique within the same kind. */
export function validateTaxonomyEntry(
  entry: TaxonomyEntry,
  siblings: readonly TaxonomyEntry[],
  previousSlug: string | undefined,
  slugLocked: boolean,
): TaxonomyError[] {
  const errors: TaxonomyError[] = []
  if (isBlank(entry.zh)) errors.push('zh-required')
  if (isBlank(entry.en)) errors.push('en-required')
  if (previousSlug !== undefined && slugLocked && entry.slug !== previousSlug)
    errors.push('slug-locked')
  else if (!SLUG.test(entry.slug)) errors.push('slug-format')
  else if (
    siblings.some(
      (sibling) => sibling.slug === entry.slug && sibling.slug !== previousSlug,
    )
  )
    errors.push('slug-taken')
  return errors
}

/**
 * D-158 ③ / ④: how many articles use a category or tag, counting both the
 * shared editing value and every language's published snapshot, and whether
 * any published snapshot uses it (which locks its slug).
 */
export function taxonomyUsage(
  articles: readonly Article[],
  kind: 'categories' | 'tags',
  slug: string,
): { references: number; published: boolean } {
  let references = 0
  let published = false
  for (const article of articles) {
    const editing =
      kind === 'categories'
        ? article.category === slug
        : article.tags.includes(slug)
    const snapshots = (['zh', 'en'] as const).filter((language) => {
      const snapshot = article[language].published
      if (!snapshot) return false
      return kind === 'categories'
        ? snapshot.category === slug
        : snapshot.tags.includes(slug)
    })
    if (editing || snapshots.length > 0) references += 1
    if (snapshots.length > 0) published = true
  }
  return { references, published }
}

export type AdminRow = {
  id: string
  title: string
  zh: VersionState
  en: VersionState
  category?: string
  /** Later of the two first-publish times (D-158 ①). */
  publishedAt?: string
  savedAt: string
}

export function adminRow(
  id: string,
  article: Article,
  savedAt: string,
): AdminRow {
  const title = (language: Language) =>
    article[language].draft?.title.trim() || article[language].published?.title
  const published = (['zh', 'en'] as const)
    .map((language) => article[language].published?.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  return {
    id,
    title: title('zh') || title('en') || '（无标题）',
    zh: versionState(article, 'zh'),
    en: versionState(article, 'en'),
    category: article.category,
    publishedAt: published.at(-1),
    savedAt,
  }
}

/** D-104 / D-158 ①: never-published first by save time, then by publish time. */
export function sortAdminRows(rows: readonly AdminRow[]): AdminRow[] {
  return [...rows].sort((left, right) => {
    if (!left.publishedAt !== !right.publishedAt)
      return left.publishedAt ? 1 : -1
    if (!left.publishedAt) return right.savedAt.localeCompare(left.savedAt)
    return (
      right.publishedAt!.localeCompare(left.publishedAt!) ||
      left.id.localeCompare(right.id)
    )
  })
}

/** D-073: newest update first, then newest creation, then a stable id. */
export function sortIdeas<
  T extends { id: string; createdAt: string; updatedAt: string },
>(ideas: readonly T[]): T[] {
  return [...ideas].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      left.id.localeCompare(right.id),
  )
}

// ---- list pages (D-163) ------------------------------------------------------

/** Rows per page on every admin list. */
export const PAGE_SIZE = 15

export type ArticleStatusFilter =
  'all' | 'pending' | 'published' | 'unpublished'
export const articleStatusFilters: readonly ArticleStatusFilter[] = [
  'all',
  'pending',
  'published',
  'unpublished',
]

/** A page number from the address: anything but a positive integer is 1. */
export function parsePage(value: unknown): number {
  const page = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** One page of `items`; a page past the end shows the last page. */
export function paginate<T>(
  items: readonly T[],
  requested: number,
  size = PAGE_SIZE,
): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(parsePage(requested), pages)
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    pages,
    total: items.length,
  }
}

/** Case-insensitive substring match after trimming; an empty query matches. */
export function matchesQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return needle === '' || text.toLowerCase().includes(needle)
}

const live = (state: VersionState) =>
  state === 'published' || state === 'modified'

/** D-163 ②: the article list's title search, status and category filters. */
export function filterAdminRows<T extends AdminRow>(
  rows: readonly T[],
  filter: { q: string; status: ArticleStatusFilter; category: string },
): T[] {
  return rows.filter((row) => {
    if (!matchesQuery(row.title, filter.q)) return false
    if (filter.category !== '' && row.category !== filter.category) return false
    const states = [row.zh, row.en]
    if (filter.status === 'pending')
      return states.some((state) => state === 'draft' || state === 'modified')
    if (filter.status === 'published') return states.some(live)
    if (filter.status === 'unpublished') return !states.some(live)
    return true
  })
}
