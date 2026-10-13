import type { Language, PublicPost } from '#/features/posts'
import { visiblePosts } from '#/features/routing'

export type WritingFilter = { category?: string; tag?: string }
export type FilterKey = keyof WritingFilter
export type FilterOption = { slug: string; label: string }
type Known = { categories: readonly string[]; tags: readonly string[] }

const keys: FilterKey[] = ['category', 'tag']

/**
 * D-132 / D-154: reduce a raw query string to the filter it means, and the
 * canonical query string when the address must change. Unknown parameters
 * are kept in place; only `category` / `tag` are rewritten.
 */
export function normalizeWritingSearch(
  search: string,
  known: Known,
): { filter: WritingFilter; canonicalSearch?: string } {
  const params = new URLSearchParams(search)
  const filter: WritingFilter = {}
  let changed = false
  for (const key of keys) {
    const values = params.getAll(key)
    if (values.length === 0) continue
    if (values.length > 1) changed = true
    const value = values[0]!
    const slug = value.toLowerCase()
    const list = key === 'category' ? known.categories : known.tags
    if (value !== '' && list.includes(slug)) {
      if (slug !== value) changed = true
      filter[key] = slug
    } else {
      changed = true
    }
  }
  if (!changed) return { filter }

  // Rewrite only the filter keys; every other segment is copied verbatim so
  // its encoding (`%20` vs `+`, a bare `flag`) survives the redirect.
  const raw = search.startsWith('?') ? search.slice(1) : search
  const output: string[] = []
  const written = new Set<FilterKey>()
  for (const segment of raw === '' ? [] : raw.split('&')) {
    const key = decodeKey(segment)
    if (key === 'category' || key === 'tag') {
      if (written.has(key)) continue
      written.add(key)
      const slug = filter[key]
      if (slug) output.push(`${key}=${encodeURIComponent(slug)}`)
    } else {
      output.push(segment)
    }
  }
  return {
    filter,
    canonicalSearch: output.length > 0 ? `?${output.join('&')}` : '',
  }
}

function decodeKey(segment: string): string {
  const key = segment.split('=')[0] ?? ''
  try {
    return decodeURIComponent(key.replaceAll('+', ' '))
  } catch {
    return key
  }
}

/** Current-language published posts matching both conditions, newest first. */
export function filterWritingPosts(
  posts: PublicPost[],
  language: Language,
  filter: WritingFilter,
): PublicPost[] {
  return visiblePosts(posts, language).filter(
    (post) =>
      // The language's published snapshot, not the shared editing value
      // (D-155 ⑤).
      (!filter.category || post[language]!.category === filter.category) &&
      (!filter.tag || post[language]!.tags.includes(filter.tag)),
  )
}

/**
 * D-154: list the entries that have at least one published post in this
 * language, plus the current selection so it can still be shown as current.
 */
export function filterOptions(
  entries: readonly { slug: string; zh: string; en: string }[],
  used: ReadonlySet<string>,
  language: Language,
  current: string | undefined,
): FilterOption[] {
  return entries
    .filter((entry) => used.has(entry.slug) || entry.slug === current)
    .map((entry) => ({ slug: entry.slug, label: entry[language] }))
}

/** Query string for a filter link; `undefined` removes that condition. */
export function writingHref(language: Language, filter: WritingFilter): string {
  const query = new URLSearchParams()
  if (filter.category) query.set('category', filter.category)
  if (filter.tag) query.set('tag', filter.tag)
  const search = query.toString()
  return `/${language}/writing${search ? `?${search}` : ''}`
}

/** Empty-result sentence (design.md §9, D-154), given the selected labels. */
export function emptyListText(
  language: Language,
  category?: string,
  tag?: string,
): string {
  if (language === 'zh') {
    if (category && tag)
      return `「${category}」分类下没有带「${tag}」标签的文章。`
    if (category) return `「${category}」分类下还没有文章。`
    if (tag) return `还没有带「${tag}」标签的文章。`
    return '还没有已发布的文章。'
  }
  if (category && tag)
    return `No articles in “${category}” are tagged “${tag}”.`
  if (category) return `No articles in “${category}” yet.`
  if (tag) return `No articles are tagged “${tag}” yet.`
  return 'No articles published yet.'
}

type Entry = { slug: string; zh: string; en: string }

/**
 * Everything the list page shows for one language and filter. Pure, so the
 * "this language has no published posts yet" path is testable without a
 * second fixture site (T4.2 review).
 */
export function writingListView(
  posts: PublicPost[],
  language: Language,
  filter: WritingFilter,
  taxonomy: { categories: readonly Entry[]; tags: readonly Entry[] },
  label: (slug: string) => string,
) {
  const known = (list: readonly Entry[], value?: string) =>
    value && list.some((entry) => entry.slug === value) ? value : undefined
  const applied = {
    category: known(taxonomy.categories, filter.category),
    tag: known(taxonomy.tags, filter.tag),
  }
  const published = visiblePosts(posts, language)
  const categories = filterOptions(
    taxonomy.categories,
    new Set(published.map((post) => post[language]!.category)),
    language,
    applied.category,
  )
  const tags = filterOptions(
    taxonomy.tags,
    new Set(published.flatMap((post) => post[language]!.tags)),
    language,
    applied.tag,
  )
  const shown = filterWritingPosts(posts, language, applied).map((post) => ({
    slug: post.slug,
    categoryName: label(post[language]!.category),
    version: post[language]!,
  }))
  const name = (options: FilterOption[], slug?: string) =>
    options.find((option) => option.slug === slug)?.label
  return {
    filter: applied,
    posts: shown,
    categories,
    tags,
    emptyText:
      shown.length > 0
        ? undefined
        : emptyListText(
            language,
            name(categories, applied.category),
            name(tags, applied.tag),
          ),
  }
}
