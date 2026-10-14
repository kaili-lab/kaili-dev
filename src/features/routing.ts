import type { Language, PublicPost, PublishedVersion } from '#/features/posts'
export type { Language, PublicPost } from '#/features/posts'

export type LanguagePreference = Language | undefined

export function parseLanguageTag(tag: string): Language | undefined {
  const value = tag.toLowerCase().split('-')[0]
  return value === 'zh' || value === 'en' ? value : undefined
}

export function parseAcceptLanguage(
  header: string | null | undefined,
): Language {
  const candidates = (header ?? '')
    .split(',')
    .map((part, index) => {
      const [rawTag, ...parameters] = part.trim().split(';')
      const qParameter = parameters.find((parameter) =>
        parameter.trim().startsWith('q='),
      )
      const q = qParameter ? Number(qParameter.trim().slice(2)) : 1
      return { tag: rawTag ?? '', q: Number.isFinite(q) ? q : 0, index }
    })
    .filter((candidate) => candidate.q > 0)
    .sort((left, right) => right.q - left.q || left.index - right.index)

  for (const candidate of candidates) {
    const language = parseLanguageTag(candidate.tag)
    if (language) return language
  }
  return 'zh'
}

export function resolveLanguage(
  preference: LanguagePreference,
  acceptLanguage: string | null | undefined,
): Language {
  return preference ?? parseAcceptLanguage(acceptLanguage)
}
export function requireLanguage(value: unknown): Language {
  if (value === 'zh' || value === 'en') return value
  throw new Error('Unsupported language')
}

export function requireArticleRequest(input: unknown): {
  slug: string
  language: Language
} {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid article request')
  }
  const value = input as { slug?: unknown; language?: unknown }
  if (typeof value.slug !== 'string' || value.slug.length === 0) {
    throw new Error('Invalid article slug')
  }
  return { slug: value.slug, language: requireLanguage(value.language) }
}

export function requireWritingListRequest(input: unknown): {
  language: Language
  category?: string
  tag?: string
} {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid writing list request')
  }
  const value = input as {
    language?: unknown
    category?: unknown
    tag?: unknown
  }
  const optional = (field: unknown) => {
    if (field === undefined) return undefined
    if (typeof field !== 'string') throw new Error('Invalid writing filter')
    return field
  }
  return {
    language: requireLanguage(value.language),
    category: optional(value.category),
    tag: optional(value.tag),
  }
}

export function getPublishedVersion(
  post: PublicPost,
  language: Language,
): PublishedVersion | undefined {
  return post[language]
}

export function visiblePosts(
  posts: PublicPost[],
  language: Language,
): PublicPost[] {
  return posts
    .filter((post) => Boolean(getPublishedVersion(post, language)))
    .sort((left, right) =>
      (getPublishedVersion(right, language)?.publishedAt ?? '').localeCompare(
        getPublishedVersion(left, language)?.publishedAt ?? '',
      ),
    )
}

export function alternateLanguage(language: Language): Language {
  return language === 'zh' ? 'en' : 'zh'
}

/**
 * D-165: whether a link points at a public page this app renders, so a click
 * can be handled by the router instead of reloading the document. Anything
 * else (other sites, mail, in-page anchors, OG images, the sitemap, static
 * files, server-chosen language redirects) stays a browser navigation.
 */
export function isClientPageHref(href: string): boolean {
  const path = href.split(/[?#]/, 1)[0]!
  // Only language-prefixed pages. `/` and the neutral `/writing/<slug>` pick a
  // language on the server (D-142), so they always load as documents.
  return /^\/(zh|en)(\/|$)/.test(path) && !/\.[a-z0-9]+$/i.test(path)
}
