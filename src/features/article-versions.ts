// Article version state rules (T5.1 / T5.2). Pure functions; the data layer
// stores what these return. Rules: D-034, D-048, D-123, D-155.

export type Language = 'zh' | 'en'

export type VersionContent = {
  title: string
  summary: string
  body: string
  /** Image object keys referenced by this content (D-048 slots). */
  images: string[]
}

export type PublishedSnapshot = VersionContent & {
  publishedAt: string
  updatedAt: string
  /** Shared metadata as it was when this language was last published. */
  category: string
  tags: string[]
  /** Set when this language is withdrawn; the snapshot remains restorable. */
  withdrawnAt?: string
}

export type LanguageVersion = {
  draft?: VersionContent
  published?: PublishedSnapshot
}

export type Article = {
  slug?: string
  category?: string
  tags: string[]
  zh: LanguageVersion
  en: LanguageVersion
}

export type VersionState =
  'missing' | 'draft' | 'published' | 'modified' | 'withdrawn'

export type EditInput = {
  language: Language
  content: VersionContent
  /** D-156 ④: omitted, null and "" all mean "not filled in". */
  slug?: string | null
  category?: string | null
  tags: string[]
}

export type ValidationError =
  | 'category-required'
  | 'title-required'
  | 'summary-required'
  | 'body-required'
  | 'slug-required'
  | 'slug-format'
  | 'slug-taken'
  | 'slug-locked'

export type Context = {
  /** ISO timestamp of this operation. */
  now: string
  /** Slugs used by other articles. */
  takenSlugs: ReadonlySet<string>
}

export type Result =
  { ok: true; article: Article } | { ok: false; errors: ValidationError[] }

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

// D-156 ⑤: Unicode white space (String#trim) plus zero-width characters.
const ZERO_WIDTH = /[\u200b-\u200d\u2060\ufeff]/g
// D-156 ④: only omitted, null and "" mean "not filled in". A slug of spaces
// is filled in and fails the format check (T51-V10 / V11).
const unfilled = (value: string | null | undefined) =>
  value === undefined || value === null || value === ''
const blank = (value: string | null | undefined) =>
  !value || value.replace(ZERO_WIDTH, '').trim() === ''

const sameList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  [...left].sort().every((value, index) => value === [...right].sort()[index])

function sameContent(left: VersionContent, right: VersionContent) {
  return (
    left.title === right.title &&
    left.summary === right.summary &&
    left.body === right.body &&
    sameList(left.images, right.images)
  )
}

/** D-155 ④: state is derived from what is stored, never stored itself. */
export function versionState(
  article: Article,
  language: Language,
): VersionState {
  const { draft, published } = article[language]
  if (!published) return draft ? 'draft' : 'missing'
  if (published.withdrawnAt) return 'withdrawn'
  const unchanged =
    (!draft || sameContent(draft, published)) &&
    published.category === article.category &&
    sameList(published.tags, article.tags)
  return unchanged ? 'published' : 'modified'
}

export function hasLivePublished(article: Article): boolean {
  return Boolean(
    (article.zh.published && !article.zh.published.withdrawnAt) ||
    (article.en.published && !article.en.published.withdrawnAt),
  )
}

export function canDeleteArticle(article: Article): boolean {
  return !hasLivePublished(article)
}

export function withdrawArticle(
  article: Article,
  language: Language,
  now: string,
): Article {
  const published = article[language].published
  if (!published || published.withdrawnAt) return article
  return {
    ...article,
    [language]: {
      ...article[language],
      published: { ...published, withdrawnAt: now },
    },
  }
}

function slugLocked(article: Article) {
  return Boolean(article.zh.published || article.en.published)
}

function slugErrors(
  article: Article,
  input: EditInput,
  context: Context,
  required: boolean,
): ValidationError[] {
  // Locked after the first publish (D-155 ⑥): an omitted slug keeps it, a
  // different one rejects the whole operation (D-156 ③).
  if (slugLocked(article))
    return !unfilled(input.slug) && input.slug !== article.slug
      ? ['slug-locked']
      : []
  if (unfilled(input.slug)) return required ? ['slug-required'] : []
  if (!SLUG.test(input.slug!)) return ['slug-format']
  if (input.slug !== article.slug && context.takenSlugs.has(input.slug!))
    return ['slug-taken']
  return []
}

/** D-155 ①: saving checks the category and, if given, the slug. */
export function validateSave(
  article: Article,
  input: EditInput,
  context: Context,
): ValidationError[] {
  const errors: ValidationError[] = []
  if (blank(input.category)) errors.push('category-required')
  errors.push(...slugErrors(article, input, context, false))
  return errors
}

/** D-155 ②: publishing also needs this language's content and a slug. */
export function validatePublish(
  article: Article,
  input: EditInput,
  context: Context,
): ValidationError[] {
  const errors: ValidationError[] = []
  if (blank(input.category)) errors.push('category-required')
  if (blank(input.content.title)) errors.push('title-required')
  if (blank(input.content.summary)) errors.push('summary-required')
  if (blank(input.content.body)) errors.push('body-required')
  errors.push(...slugErrors(article, input, context, true))
  return errors
}

function withShared(article: Article, input: EditInput): Article {
  return {
    ...article,
    slug: unfilled(input.slug) ? article.slug : input.slug!,
    category: input.category!,
    tags: [...input.tags],
  }
}

/** D-034: save writes only this language's draft (and shared metadata). */
export function saveArticle(
  article: Article,
  input: EditInput,
  context: Context,
): Result {
  const errors = validateSave(article, input, context)
  if (errors.length > 0) return { ok: false, errors }
  const next = withShared(article, input)
  next[input.language] = {
    ...article[input.language],
    draft: { ...input.content, images: [...input.content.images] },
  }
  return { ok: true, article: next }
}

/**
 * D-155 ③: publish = save this language's edits and make them public, as
 * one step. The other language is never read or changed.
 */
export function publishArticle(
  article: Article,
  input: EditInput,
  context: Context,
): Result {
  const errors = validatePublish(article, input, context)
  if (errors.length > 0) return { ok: false, errors }
  const next = withShared(article, input)
  const previous = article[input.language].published
  const content = { ...input.content, images: [...input.content.images] }
  next[input.language] = {
    draft: content,
    published: {
      ...content,
      images: [...content.images],
      publishedAt: previous?.publishedAt ?? context.now,
      updatedAt: context.now,
      category: input.category!,
      tags: [...input.tags],
    },
  }
  return { ok: true, article: next }
}
