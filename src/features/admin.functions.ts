import { createServerFn } from '@tanstack/react-start'

import {
  adminRow,
  articleStatusFilters,
  filterAdminRows,
  isBlank,
  matchesQuery,
  paginate,
  parsePage,
  sortAdminRows,
  type ArticleStatusFilter,
  sortIdeas,
  taxonomyUsage,
  validateTaxonomyEntry,
  type TaxonomyEntry,
} from '#/features/admin'
import {
  publishArticle,
  saveArticle,
  versionState,
  type Article,
  type EditInput,
  type Language,
  type ValidationError,
} from '#/features/article-versions'
import { referencedImages } from '#/features/markdown-images'
import { requireAdmin } from '#/server/admin-auth'
import {
  getStoredArticle,
  listStoredArticles,
  newArticleId,
  putStoredArticle,
} from '#/server/data/articles'
import {
  deleteStoredIdea,
  getStoredIdea,
  listStoredIdeas,
  putStoredIdea,
} from '#/server/data/ideas'
import {
  deleteTaxonomyEntry,
  listTaxonomy,
  putTaxonomyEntry,
  type TaxonomyKind,
} from '#/server/data/taxonomy'

// ---- input checks (never trust the form; T51-O04) -------------------------

function object(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null)
    throw new Error('Invalid request')
  return input as Record<string, unknown>
}
const text = (value: unknown, name: string) => {
  if (typeof value !== 'string') throw new Error(`Invalid ${name}`)
  return value
}
const optionalText = (value: unknown, name: string) =>
  value === undefined || value === null ? value : text(value, name)
const strings = (value: unknown, name: string) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new Error(`Invalid ${name}`)
  return value as string[]
}
const language = (value: unknown): Language => {
  if (value !== 'zh' && value !== 'en') throw new Error('Invalid language')
  return value
}
const kind = (value: unknown): TaxonomyKind => {
  if (value !== 'categories' && value !== 'tags')
    throw new Error('Invalid kind')
  return value
}

/** List-page query from the address (D-163); bad values fall back quietly. */
function listQuery(input: unknown) {
  const value = typeof input === 'object' && input !== null ? input : {}
  const field = (name: string) => {
    const item = (value as Record<string, unknown>)[name]
    return typeof item === 'string' ? item : ''
  }
  const status = field('status') as ArticleStatusFilter
  return {
    page: parsePage((value as Record<string, unknown>).page),
    q: field('q'),
    status: articleStatusFilters.includes(status) ? status : 'all',
    category: field('category'),
    tab: field('tab') === 'tags' ? ('tags' as const) : ('categories' as const),
  }
}

type EditRequest = { id: string | null; input: EditInput; ideaIds: string[] }

function editRequest(input: unknown): EditRequest {
  const value = object(input)
  const edit = object(value.input)
  const content = object(edit.content)
  const body = text(content.body, 'body')
  return {
    id: value.id === null ? null : text(value.id, 'id'),
    ideaIds: strings(value.ideaIds ?? [], 'ideaIds'),
    input: {
      language: language(edit.language),
      content: {
        title: text(content.title, 'title'),
        summary: text(content.summary, 'summary'),
        body,
        // Slots follow what the body references (D-048), not what the client claims.
        images: referencedImages(body),
      },
      slug: optionalText(edit.slug, 'slug'),
      category: optionalText(edit.category, 'category'),
      tags: strings(edit.tags ?? [], 'tags'),
    },
  }
}

// ---- views ----------------------------------------------------------------

const label = (entries: TaxonomyEntry[], slug?: string) =>
  entries.find((entry) => entry.slug === slug)?.zh ?? slug

function editorView(id: string | null, article: Article, ideaIds: string[]) {
  const ideas = sortIdeas(listStoredIdeas())
  return {
    id,
    article,
    states: {
      zh: versionState(article, 'zh'),
      en: versionState(article, 'en'),
    },
    slugLocked: Boolean(article.zh.published || article.en.published),
    categories: listTaxonomy('categories'),
    tags: listTaxonomy('tags'),
    references: ideaIds
      .map((ideaId) => ideas.find((idea) => idea.id === ideaId))
      .filter((idea) => idea !== undefined),
    ideas,
  }
}
export type EditorView = ReturnType<typeof editorView>

const emptyArticle = (): Article => ({ tags: [], zh: {}, en: {} })
const takenSlugs = (id: string | null) =>
  new Set(
    listStoredArticles()
      .filter((record) => record.id !== id && record.article.slug)
      .map((record) => record.article.slug!),
  )

// ---- articles ---------------------------------------------------------------

export const listAdminArticles = createServerFn({ method: 'GET' })
  .validator(listQuery)
  .handler(({ data }) => {
    requireAdmin()
    const categories = listTaxonomy('categories')
    const records = listStoredArticles()
    const last = new Map(
      records.map((record) => [record.id, record.lastLanguage]),
    )
    const rows = filterAdminRows(
      sortAdminRows(
        records.map((record) =>
          adminRow(record.id, record.article, record.savedAt),
        ),
      ),
      data,
    )
    const page = paginate(rows, data.page)
    return {
      ...page,
      items: page.items.map((row) => ({
        ...row,
        slug: records.find((record) => record.id === row.id)?.article.slug,
        categoryName: label(categories, row.category),
        // Open the language edited last (admin-design-note §2); Chinese if none.
        lastLanguage: last.get(row.id) ?? ('zh' as const),
      })),
      categories,
    }
  })

export const loadAdminArticle = createServerFn({ method: 'GET' })
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(({ data }) => {
    requireAdmin()
    const record = getStoredArticle(data.id)
    return record ? editorView(record.id, record.article, record.ideaIds) : null
  })

export const loadNewArticle = createServerFn({ method: 'GET' })
  .validator((input: unknown) => ({
    ideaId: optionalText(object(input ?? {}).ideaId, 'ideaId') ?? undefined,
  }))
  .handler(({ data }) => {
    requireAdmin()
    // "用它写文章" pre-attaches the Idea (D-103).
    const ideaIds =
      data.ideaId && getStoredIdea(data.ideaId) ? [data.ideaId] : []
    return editorView(null, emptyArticle(), ideaIds)
  })

/** Beyond the pure rules: references must name real taxonomy entries. */
export type CommitError = ValidationError | 'category-unknown' | 'tag-unknown'
type EditResult =
  { ok: true; view: EditorView } | { ok: false; errors: CommitError[] }

function commit(
  operation: 'save' | 'publish',
  request: EditRequest,
): EditResult {
  requireAdmin()
  const existing = request.id ? getStoredArticle(request.id) : undefined
  if (request.id && !existing) throw new Error('Article not found')
  // A bypassed form must not attach a category or tag that does not exist.
  const unknown: CommitError[] = []
  const { category, tags } = request.input
  if (
    category &&
    !listTaxonomy('categories').some((entry) => entry.slug === category)
  )
    unknown.push('category-unknown')
  const tagSlugs = new Set(listTaxonomy('tags').map((entry) => entry.slug))
  if (tags.some((tag) => !tagSlugs.has(tag))) unknown.push('tag-unknown')
  if (unknown.length > 0) return { ok: false, errors: unknown }
  const now = new Date().toISOString()
  const result = (operation === 'save' ? saveArticle : publishArticle)(
    existing?.article ?? emptyArticle(),
    request.input,
    { now, takenSlugs: takenSlugs(request.id) },
  )
  if (!result.ok) return result
  const known = new Set(listStoredIdeas().map((idea) => idea.id))
  const ideaIds = [...new Set(request.ideaIds)].filter((ideaId) =>
    known.has(ideaId),
  )
  const id = existing?.id ?? newArticleId()
  putStoredArticle({
    id,
    article: result.article,
    savedAt: now,
    ideaIds,
    lastLanguage: request.input.language,
  })
  return { ok: true, view: editorView(id, result.article, ideaIds) }
}

export const saveAdminArticle = createServerFn({ method: 'POST' })
  .validator(editRequest)
  .handler(({ data }) => commit('save', data))

export const publishAdminArticle = createServerFn({ method: 'POST' })
  .validator(editRequest)
  .handler(({ data }) => commit('publish', data))

// ---- categories and tags ----------------------------------------------------

export const loadTaxonomy = createServerFn({ method: 'GET' })
  .validator(listQuery)
  .handler(({ data }) => {
    requireAdmin()
    const articles = listStoredArticles().map((record) => record.article)
    const rows = listTaxonomy(data.tab).map((entry) => ({
      ...entry,
      ...taxonomyUsage(articles, data.tab, entry.slug),
    }))
    return {
      ...paginate(rows, data.page),
      counts: {
        categories: listTaxonomy('categories').length,
        tags: listTaxonomy('tags').length,
      },
    }
  })

export const saveTaxonomyEntry = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const value = object(input)
    const entry = object(value.entry)
    return {
      kind: kind(value.kind),
      previousSlug:
        optionalText(value.previousSlug, 'previousSlug') ?? undefined,
      entry: {
        slug: text(entry.slug, 'slug'),
        zh: text(entry.zh, 'zh'),
        en: text(entry.en, 'en'),
      },
    }
  })
  .handler(({ data }) => {
    requireAdmin()
    const articles = listStoredArticles().map((record) => record.article)
    const locked =
      data.previousSlug !== undefined &&
      taxonomyUsage(articles, data.kind, data.previousSlug).published
    const errors = validateTaxonomyEntry(
      { ...data.entry, zh: data.entry.zh.trim(), en: data.entry.en.trim() },
      listTaxonomy(data.kind),
      data.previousSlug,
      locked,
    )
    if (errors.length > 0) return { ok: false as const, errors }
    const entry = {
      ...data.entry,
      zh: data.entry.zh.trim(),
      en: data.entry.en.trim(),
    }
    putTaxonomyEntry(data.kind, entry, data.previousSlug)
    // An unpublished slug change follows into the articles that use it.
    if (data.previousSlug && data.previousSlug !== entry.slug)
      for (const record of listStoredArticles()) {
        const article = record.article
        const next =
          data.kind === 'categories'
            ? article.category === data.previousSlug
              ? { ...article, category: entry.slug }
              : article
            : {
                ...article,
                tags: article.tags.map((tag) =>
                  tag === data.previousSlug ? entry.slug : tag,
                ),
              }
        if (next !== article) putStoredArticle({ ...record, article: next })
      }
    return { ok: true as const, entry }
  })

export const removeTaxonomyEntry = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const value = object(input)
    return { kind: kind(value.kind), slug: text(value.slug, 'slug') }
  })
  .handler(({ data }) => {
    requireAdmin()
    const articles = listStoredArticles().map((record) => record.article)
    const usage = taxonomyUsage(articles, data.kind, data.slug)
    if (usage.references > 0)
      return { ok: false as const, references: usage.references }
    deleteTaxonomyEntry(data.kind, data.slug)
    return { ok: true as const }
  })

// ---- Ideas ----------------------------------------------------------------

/** Articles that list this Idea as a reference (D-163 ② / D-164 ③). */
function ideaArticles(
  records: ReturnType<typeof listStoredArticles>,
  id: string,
) {
  return records
    .filter((record) => record.ideaIds.includes(id))
    .map((record) => ({
      id: record.id,
      title: adminRow(record.id, record.article, record.savedAt).title,
      lastLanguage: record.lastLanguage ?? ('zh' as const),
    }))
}

export const listIdeas = createServerFn({ method: 'GET' })
  .validator(listQuery)
  .handler(({ data }) => {
    requireAdmin()
    const records = listStoredArticles()
    const all = sortIdeas(listStoredIdeas())
    const page = paginate(
      all.filter((idea) => matchesQuery(idea.text, data.q)),
      data.page,
    )
    return {
      ...page,
      items: page.items.map((idea) => ({
        ...idea,
        articles: ideaArticles(records, idea.id),
      })),
      // Every Idea exists, regardless of the search (for the page heading).
      all: all.length,
    }
  })

export const loadIdea = createServerFn({ method: 'GET' })
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(({ data }) => {
    requireAdmin()
    const idea = getStoredIdea(data.id)
    return idea
      ? { ...idea, articles: ideaArticles(listStoredArticles(), idea.id) }
      : null
  })

export const saveIdea = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const value = object(input)
    return {
      id: value.id === null ? null : text(value.id, 'id'),
      text: text(value.text, 'text'),
    }
  })
  .handler(({ data }) => {
    requireAdmin()
    // D-076: blank Ideas never save, whichever way the request arrives.
    if (isBlank(data.text))
      return { ok: false as const, error: 'text-required' as const }
    const now = new Date().toISOString()
    const previous = data.id ? getStoredIdea(data.id) : undefined
    if (data.id && !previous) throw new Error('Idea not found')
    const idea = {
      id: previous?.id ?? newArticleId(),
      text: data.text,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    putStoredIdea(idea)
    return { ok: true as const, idea }
  })

export const removeIdea = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(({ data }) => {
    requireAdmin()
    deleteStoredIdea(data.id)
    // D-068: drop every article reference; articles themselves stay.
    for (const record of listStoredArticles())
      if (record.ideaIds.includes(data.id))
        putStoredArticle({
          ...record,
          ideaIds: record.ideaIds.filter((id) => id !== data.id),
        })
    return { ok: true as const }
  })

// ---- editor preview ----------------------------------------------------------

export const previewMarkdown = createServerFn({ method: 'POST' })
  .validator((input: unknown) => ({ body: text(object(input).body, 'body') }))
  .handler(async ({ data }) => {
    requireAdmin()
    // Same renderer as the public article page, so the preview matches it.
    const { renderMarkdown } = await import('#/features/markdown')
    return (await renderMarkdown(data.body)).html
  })
