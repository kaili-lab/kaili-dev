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
  canDeleteArticle,
  publishArticle,
  saveArticle,
  versionState,
  withdrawArticle,
  type Article,
  type EditInput,
  type Language,
  type ValidationError,
} from '#/features/article-versions'
import { referencedImages } from '#/features/markdown-images'
import { requireAdminFunctionSession } from '#/lib/require-admin-session'
import { runtimeDatabase, type D1Database } from '#/server/data/db'
import {
  ArticleWriteConflictError,
  deleteStoredArticle,
  getStoredArticle,
  listStoredArticles,
  newArticleId,
  putStoredArticle,
  type StoredArticle,
} from '#/server/data/articles'
import { missingMediaObjects } from '#/server/data/media'
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
const revision = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    throw new Error('Invalid revision')
  return value
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

type EditRequest = {
  id: string | null
  revision: number
  input: EditInput
  ideaIds: string[]
}

function editRequest(input: unknown): EditRequest {
  const value = object(input)
  const edit = object(value.input)
  const content = object(edit.content)
  const body = text(content.body, 'body')
  return {
    id: value.id === null ? null : text(value.id, 'id'),
    revision: revision(value.revision),
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

type ArticleActionRequest = {
  id: string
  revision: number
  language?: Language
}

function articleActionRequest(input: unknown): ArticleActionRequest {
  const value = object(input)
  return {
    id: text(value.id, 'id'),
    revision: revision(value.revision),
    language:
      value.language === undefined ? undefined : language(value.language),
  }
}

// ---- views ----------------------------------------------------------------

const label = (entries: TaxonomyEntry[], slug?: string) =>
  entries.find((entry) => entry.slug === slug)?.zh ?? slug

async function editorView(
  database: D1Database,
  id: string | null,
  article: Article,
  ideaIds: string[],
  revision: number,
) {
  const [ideas, categories, tags] = await Promise.all([
    listStoredIdeas(database),
    listTaxonomy(database, 'categories'),
    listTaxonomy(database, 'tags'),
  ])
  const sortedIdeas = sortIdeas(ideas)
  return {
    id,
    revision,
    article,
    states: {
      zh: versionState(article, 'zh'),
      en: versionState(article, 'en'),
    },
    canDelete: id !== null && canDeleteArticle(article),
    slugLocked: Boolean(article.zh.published || article.en.published),
    categories,
    tags,
    references: ideaIds
      .map((ideaId) => sortedIdeas.find((idea) => idea.id === ideaId))
      .filter((idea) => idea !== undefined),
    ideas: sortedIdeas,
  }
}
export type EditorView = Awaited<ReturnType<typeof editorView>>

const emptyArticle = (): Article => ({ tags: [], zh: {}, en: {} })
async function takenSlugs(database: D1Database, id: string | null) {
  return new Set(
    (await listStoredArticles(database))
      .filter((record) => record.id !== id && record.article.slug)
      .map((record) => record.article.slug!),
  )
}

// ---- articles ---------------------------------------------------------------

export const listAdminArticles = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator(listQuery)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [categories, records] = await Promise.all([
      listTaxonomy(database, 'categories'),
      listStoredArticles(database),
    ])
    const last = new Map(
      records.map((record) => [record.id, record.lastLanguage]),
    )
    const slugs = new Map(
      records.map((record) => [record.id, record.article.slug]),
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
        slug: slugs.get(row.id),
        categoryName: label(categories, row.category),
        lastLanguage: last.get(row.id) ?? ('zh' as const),
      })),
      categories,
    }
  })

export const loadAdminArticle = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const record = await getStoredArticle(database, data.id)
    return record
      ? editorView(
          database,
          record.id,
          record.article,
          record.ideaIds,
          record.revision,
        )
      : null
  })

export const loadNewArticle = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => ({
    ideaId: optionalText(object(input ?? {}).ideaId, 'ideaId') ?? undefined,
  }))
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const ideaIds =
      data.ideaId && (await getStoredIdea(database, data.ideaId))
        ? [data.ideaId]
        : []
    return editorView(database, null, emptyArticle(), ideaIds, 0)
  })

/** Beyond the pure rules: references must name real taxonomy entries. */
export type CommitError =
  | ValidationError
  | 'category-unknown'
  | 'tag-unknown'
  | 'image-unavailable'
  | 'stale-write'
  | 'not-found'
type EditResult =
  { ok: true; view: EditorView } | { ok: false; errors: CommitError[] }

async function commit(
  operation: 'save' | 'publish',
  request: EditRequest,
): Promise<EditResult> {
  const database = await runtimeDatabase()
  const existing = request.id
    ? await getStoredArticle(database, request.id)
    : undefined
  if (request.id && !existing) return { ok: false, errors: ['not-found'] }
  if (existing && request.revision !== existing.revision)
    return { ok: false, errors: ['stale-write'] }
  const [categories, tags, ideas] = await Promise.all([
    listTaxonomy(database, 'categories'),
    listTaxonomy(database, 'tags'),
    listStoredIdeas(database),
  ])
  const unknown: CommitError[] = []
  const { category } = request.input
  if (category && !categories.some((entry) => entry.slug === category))
    unknown.push('category-unknown')
  const tagSlugs = new Set(tags.map((entry) => entry.slug))
  if (request.input.tags.some((tag) => !tagSlugs.has(tag)))
    unknown.push('tag-unknown')
  if (
    (await missingMediaObjects(database, request.input.content.images)).length >
    0
  )
    unknown.push('image-unavailable')
  if (unknown.length > 0) return { ok: false, errors: unknown }
  const now = new Date().toISOString()
  const result = (operation === 'save' ? saveArticle : publishArticle)(
    existing?.article ?? emptyArticle(),
    request.input,
    { now, takenSlugs: await takenSlugs(database, request.id) },
  )
  if (!result.ok) return result
  const known = new Set(ideas.map((idea) => idea.id))
  const ideaIds = [...new Set(request.ideaIds)].filter((ideaId) =>
    known.has(ideaId),
  )
  const id = existing?.id ?? newArticleId()
  let nextRevision: number
  try {
    nextRevision = await putStoredArticle(
      database,
      {
        id,
        article: result.article,
        savedAt: now,
        revision: existing?.revision ?? 0,
        ideaIds,
        lastLanguage: request.input.language,
      },
      existing?.revision,
    )
  } catch (error) {
    if (error instanceof ArticleWriteConflictError)
      return { ok: false, errors: ['stale-write'] }
    const slug = result.article.slug
    if (slug && (await takenSlugs(database, id)).has(slug))
      return { ok: false, errors: ['slug-taken'] }
    throw error
  }
  return {
    ok: true,
    view: await editorView(database, id, result.article, ideaIds, nextRevision),
  }
}

export const saveAdminArticle = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(editRequest)
  .handler(({ data }) => commit('save', data))

export const publishAdminArticle = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(editRequest)
  .handler(({ data }) => commit('publish', data))

export const withdrawAdminArticle = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(articleActionRequest)
  .handler(async ({ data }) => {
    if (!data.language) throw new Error('Language required')
    const database = await runtimeDatabase()
    const existing = await getStoredArticle(database, data.id)
    if (!existing) return { ok: false as const, error: 'not-found' as const }
    if (existing.revision !== data.revision)
      return { ok: false as const, error: 'stale-write' as const }
    const nextArticle = withdrawArticle(
      existing.article,
      data.language,
      new Date().toISOString(),
    )
    if (nextArticle === existing.article)
      return { ok: false as const, error: 'not-published' as const }
    try {
      const nextRevision = await putStoredArticle(
        database,
        { ...existing, article: nextArticle },
        existing.revision,
      )
      return {
        ok: true as const,
        view: await editorView(
          database,
          existing.id,
          nextArticle,
          existing.ideaIds,
          nextRevision,
        ),
      }
    } catch (error) {
      if (error instanceof ArticleWriteConflictError)
        return { ok: false as const, error: 'stale-write' as const }
      throw error
    }
  })

export const deleteAdminArticle = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(articleActionRequest)
  .handler(async ({ data }) => {
    const result = await deleteStoredArticle(
      await runtimeDatabase(),
      data.id,
      data.revision,
      new Date().toISOString(),
    )
    return result === 'deleted'
      ? { ok: true as const }
      : { ok: false as const, error: result }
  })

// ---- categories and tags ----------------------------------------------------

export const loadTaxonomy = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator(listQuery)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [articles, entries, categories, tags] = await Promise.all([
      listStoredArticles(database),
      listTaxonomy(database, data.tab),
      listTaxonomy(database, 'categories'),
      listTaxonomy(database, 'tags'),
    ])
    const articleValues = articles.map((record) => record.article)
    const rows = entries.map((entry) => ({
      ...entry,
      ...taxonomyUsage(articleValues, data.tab, entry.slug),
    }))
    return {
      ...paginate(rows, data.page),
      counts: { categories: categories.length, tags: tags.length },
    }
  })

export const saveTaxonomyEntry = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
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
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [records, entries] = await Promise.all([
      listStoredArticles(database),
      listTaxonomy(database, data.kind),
    ])
    const articles = records.map((record) => record.article)
    const locked =
      data.previousSlug !== undefined &&
      taxonomyUsage(articles, data.kind, data.previousSlug).published
    const errors = validateTaxonomyEntry(
      { ...data.entry, zh: data.entry.zh.trim(), en: data.entry.en.trim() },
      entries,
      data.previousSlug,
      locked,
    )
    if (errors.length > 0) return { ok: false as const, errors }
    const entry = {
      ...data.entry,
      zh: data.entry.zh.trim(),
      en: data.entry.en.trim(),
    }
    await putTaxonomyEntry(database, data.kind, entry, data.previousSlug)
    return { ok: true as const, entry }
  })

export const removeTaxonomyEntry = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return { kind: kind(value.kind), slug: text(value.slug, 'slug') }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const articles = (await listStoredArticles(database)).map(
      (record) => record.article,
    )
    const usage = taxonomyUsage(articles, data.kind, data.slug)
    if (usage.references > 0)
      return { ok: false as const, references: usage.references }
    await deleteTaxonomyEntry(database, data.kind, data.slug)
    return { ok: true as const }
  })

// ---- Ideas ----------------------------------------------------------------

/** Articles that list this Idea as a reference (D-163 ② / D-164 ③). */
function ideaArticles(records: StoredArticle[], id: string) {
  return records
    .filter((record) => record.ideaIds.includes(id))
    .map((record) => ({
      id: record.id,
      title: adminRow(record.id, record.article, record.savedAt).title,
      lastLanguage: record.lastLanguage ?? ('zh' as const),
    }))
}

export const listIdeas = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator(listQuery)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [records, storedIdeas] = await Promise.all([
      listStoredArticles(database),
      listStoredIdeas(database),
    ])
    const all = sortIdeas(storedIdeas)
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
      all: all.length,
    }
  })

export const loadIdea = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [idea, records] = await Promise.all([
      getStoredIdea(database, data.id),
      listStoredArticles(database),
    ])
    return idea ? { ...idea, articles: ideaArticles(records, idea.id) } : null
  })

export const saveIdea = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      id: value.id === null ? null : text(value.id, 'id'),
      text: text(value.text, 'text'),
    }
  })
  .handler(async ({ data }) => {
    if (isBlank(data.text))
      return { ok: false as const, error: 'text-required' as const }
    const database = await runtimeDatabase()
    const now = new Date().toISOString()
    const previous = data.id
      ? await getStoredIdea(database, data.id)
      : undefined
    if (data.id && !previous) throw new Error('Idea not found')
    const idea = {
      id: previous?.id ?? newArticleId(),
      text: data.text,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    await putStoredIdea(database, idea)
    return { ok: true as const, idea }
  })

export const removeIdea = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => ({ id: text(object(input).id, 'id') }))
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    await deleteStoredIdea(database, data.id)
    return { ok: true as const }
  })

// ---- editor preview ----------------------------------------------------------

export const previewMarkdown = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => ({ body: text(object(input).body, 'body') }))
  .handler(async ({ data }) => {
    // Same renderer as the public article page, so the preview matches it.
    const { renderMarkdown } = await import('#/features/markdown')
    return (await renderMarkdown(data.body)).html
  })
