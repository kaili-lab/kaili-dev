import {
  hasLivePublished,
  type Article,
  type LanguageVersion,
} from '#/features/article-versions'
import type { Language, PublicPost } from '#/features/posts'
import type { D1Database, D1PreparedStatement } from '#/server/data/db'
import {
  articleMediaObjectKeys,
  articleMediaStatements,
} from '#/server/data/media'
import { articleBodies } from '#/server/data/article-bodies'
export type StoredArticle = {
  id: string
  article: Article
  savedAt: string
  revision: number
  ideaIds: string[]
  lastLanguage?: Language
}

type SeedText = { title: string; summary: string; body: string }
type Seed = {
  slug: string
  category: string
  tags: string[]
  zh?: SeedText & { publishedAt: string }
  en?: SeedText & { publishedAt: string }
  drafts?: { zh?: SeedText; en?: SeedText }
}

const seeds: Seed[] = [
  {
    slug: 'boundary-example',
    category: 'engineering',
    tags: ['typescript'],
    zh: {
      title: '把边界写清楚',
      summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      body: '段落使用正文宋体。这里是一篇中文公开文章。',
      publishedAt: '2026-09-02',
    },
    en: {
      title: 'Make boundaries visible',
      summary:
        'Ownership, boundaries, and where the transaction ends make a service understandable.',
      body: 'This is the published English article.',
      publishedAt: '2026-09-02',
    },
    drafts: {
      zh: {
        title: '未发布中文标题不得出现',
        summary: '未发布中文摘要不得出现',
        body: '未发布中文修改不得出现',
      },
      en: {
        title: 'Unpublished English title must not appear',
        summary: '未发布英文摘要不得出现',
        body: 'Unpublished English edit must not appear',
      },
    },
  },
  {
    slug: 'zh-only-example',
    category: 'engineering',
    tags: ['typescript'],
    zh: {
      title: '只有中文的文章',
      summary: '这篇文章还没有英文版本。',
      body: '这篇文章只有中文公开版本。',
      publishedAt: '2026-08-01',
    },
  },
  {
    slug: 'en-only-example',
    category: 'engineering',
    tags: ['typescript'],
    en: {
      title: 'An English-only article',
      summary: 'This article is currently available in English only.',
      body: 'This article has only an English published version.',
      publishedAt: '2026-07-01',
    },
  },
  {
    slug: 'private-example',
    category: 'engineering',
    tags: [],
  },
]

const languages: Language[] = ['zh', 'en']
type ArticleRow = {
  id: string
  slug: string | null
  category: string | null
  tags_json: string
  idea_ids_json: string
  saved_at: string
  last_language: string | null
  revision: number
  write_token: string
}
type LanguageRow = {
  article_id: string
  language: string
  draft_title: string | null
  draft_summary: string | null
  draft_body: string | null
  draft_images_json: string
  published_title: string | null
  published_summary: string | null
  published_body: string | null
  published_images_json: string
  published_category: string | null
  published_tags_json: string
  published_at: string | null
  published_updated_at: string | null
  withdrawn_at: string | null
}
type SeedVersion = {
  draft?: { title: string; summary: string; body: string; images: string[] }
  published?: {
    title: string
    summary: string
    body: string
    images: string[]
    publishedAt: string
    updatedAt: string
    category: string
    tags: string[]
  }
}

function parseList(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  return Array.isArray(parsed) &&
    parsed.every((item) => typeof item === 'string')
    ? parsed
    : []
}

function rowVersion(row: LanguageRow): LanguageVersion {
  const draft =
    row.draft_title === null ||
    row.draft_summary === null ||
    row.draft_body === null
      ? undefined
      : {
          title: row.draft_title,
          summary: row.draft_summary,
          body: row.draft_body,
          images: parseList(row.draft_images_json),
        }
  const published =
    row.published_title === null ||
    row.published_summary === null ||
    row.published_body === null ||
    row.published_at === null ||
    row.published_updated_at === null ||
    row.published_category === null
      ? undefined
      : {
          title: row.published_title,
          summary: row.published_summary,
          body: row.published_body,
          images: parseList(row.published_images_json),
          publishedAt: row.published_at,
          updatedAt: row.published_updated_at,
          category: row.published_category,
          tags: parseList(row.published_tags_json),
          ...(row.withdrawn_at ? { withdrawnAt: row.withdrawn_at } : {}),
        }
  return { ...(draft ? { draft } : {}), ...(published ? { published } : {}) }
}

function toStoredArticle(
  row: ArticleRow,
  languageRows: LanguageRow[],
): StoredArticle {
  const tags = parseList(row.tags_json)
  const byLanguage = new Map(languageRows.map((item) => [item.language, item]))
  const article: Article = {
    ...(row.slug === null ? {} : { slug: row.slug }),
    ...(row.category === null ? {} : { category: row.category }),
    tags,
    zh: rowVersion(byLanguage.get('zh') ?? emptyLanguageRow(row.id, 'zh')),
    en: rowVersion(byLanguage.get('en') ?? emptyLanguageRow(row.id, 'en')),
  }
  return {
    id: row.id,
    article,
    savedAt: row.saved_at,
    revision: row.revision,
    ideaIds: parseList(row.idea_ids_json),
    ...(row.last_language === 'zh' || row.last_language === 'en'
      ? { lastLanguage: row.last_language }
      : {}),
  }
}

function emptyLanguageRow(articleId: string, language: Language): LanguageRow {
  return {
    article_id: articleId,
    language,
    draft_title: null,
    draft_summary: null,
    draft_body: null,
    draft_images_json: '[]',
    published_title: null,
    published_summary: null,
    published_body: null,
    published_images_json: '[]',
    published_category: null,
    published_tags_json: '[]',
    published_at: null,
    published_updated_at: null,
    withdrawn_at: null,
  }
}

function seedVersion(seed: Seed, language: Language): SeedVersion {
  const published = seed[language]
  const draft = seed.drafts?.[language]
  const withBody = (text: SeedText) => ({
    title: text.title,
    summary: text.summary,
    body: `${text.body}\n\n${articleBodies[seed.slug]?.[language] ?? ''}`.trim(),
    images: [],
  })
  if (!published) return draft ? { draft: withBody(draft) } : {}
  const at = `${published.publishedAt}T00:00:00.000Z`
  const content = withBody(published)
  return {
    draft: draft ? withBody(draft) : content,
    published: {
      ...content,
      publishedAt: at,
      updatedAt: at,
      category: seed.category,
      tags: [...seed.tags],
    },
  }
}

function seedRecord(seed: Seed): StoredArticle {
  return {
    id: seed.slug,
    savedAt: '2026-10-01T00:00:00.000Z',
    revision: 0,
    ideaIds: [],
    article: {
      slug: seed.slug,
      category: seed.category,
      tags: [...seed.tags],
      zh: seedVersion(seed, 'zh'),
      en: seedVersion(seed, 'en'),
    },
  }
}

function articleStatements(
  database: D1Database,
  record: StoredArticle,
  writeToken: string,
  expectedRevision: number | undefined,
  previousMediaKeys: readonly string[] = [],
): D1PreparedStatement[] {
  const { article } = record
  const ownsWrite =
    'EXISTS (SELECT 1 FROM articles WHERE id = ? AND write_token = ?)'
  const parentStatement =
    expectedRevision === undefined
      ? database
          .prepare(
            `INSERT INTO articles
             (id, slug, category, tags_json, idea_ids_json, saved_at, last_language, revision, write_token)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
             ON CONFLICT(id) DO NOTHING`,
          )
          .bind(
            record.id,
            article.slug ?? null,
            article.category ?? null,
            JSON.stringify(article.tags),
            JSON.stringify(record.ideaIds),
            record.savedAt,
            record.lastLanguage ?? null,
            writeToken,
          )
      : database
          .prepare(
            `UPDATE articles
             SET slug = ?, category = ?, tags_json = ?, idea_ids_json = ?,
                 saved_at = ?, last_language = ?, revision = revision + 1,
                 write_token = ?
             WHERE id = ? AND revision = ?`,
          )
          .bind(
            article.slug ?? null,
            article.category ?? null,
            JSON.stringify(article.tags),
            JSON.stringify(record.ideaIds),
            record.savedAt,
            record.lastLanguage ?? null,
            writeToken,
            record.id,
            expectedRevision,
          )
  const statements = [
    parentStatement,
    database
      .prepare(
        `DELETE FROM article_languages
         WHERE article_id = ? AND ${ownsWrite}`,
      )
      .bind(record.id, record.id, writeToken),
    database
      .prepare(
        `DELETE FROM article_ideas
         WHERE article_id = ? AND ${ownsWrite}`,
      )
      .bind(record.id, record.id, writeToken),
  ]
  for (const language of languages) {
    const version = article[language]
    statements.push(
      database
        .prepare(
          `INSERT INTO article_languages
           (article_id, language, draft_title, draft_summary, draft_body, draft_images_json,
            published_title, published_summary, published_body, published_images_json,
            published_category, published_tags_json, published_at, published_updated_at,
            withdrawn_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE ${ownsWrite}`,
        )
        .bind(
          record.id,
          language,
          version.draft?.title ?? null,
          version.draft?.summary ?? null,
          version.draft?.body ?? null,
          JSON.stringify(version.draft?.images ?? []),
          version.published?.title ?? null,
          version.published?.summary ?? null,
          version.published?.body ?? null,
          JSON.stringify(version.published?.images ?? []),
          version.published?.category ?? null,
          JSON.stringify(version.published?.tags ?? []),
          version.published?.publishedAt ?? null,
          version.published?.updatedAt ?? null,
          version.published?.withdrawnAt ?? null,
          record.id,
          writeToken,
        ),
    )
  }
  for (const ideaId of record.ideaIds)
    statements.push(
      database
        .prepare(
          `INSERT INTO article_ideas (article_id, idea_id)
           SELECT ?, ? WHERE ${ownsWrite}`,
        )
        .bind(record.id, ideaId, record.id, writeToken),
    )
  statements.push(
    ...articleMediaStatements(
      database,
      record.id,
      article,
      record.savedAt,
      writeToken,
      previousMediaKeys,
    ),
  )
  return statements
}

export async function listStoredArticles(
  database: D1Database,
): Promise<StoredArticle[]> {
  const [articleResult, languageResult] = await Promise.all([
    database
      .prepare('SELECT * FROM articles ORDER BY saved_at DESC, id ASC')
      .all<ArticleRow>(),
    database.prepare('SELECT * FROM article_languages').all<LanguageRow>(),
  ])
  const languagesByArticle = new Map<string, LanguageRow[]>()
  for (const row of languageResult.results) {
    const rows = languagesByArticle.get(row.article_id)
    if (rows) rows.push(row)
    else languagesByArticle.set(row.article_id, [row])
  }
  return articleResult.results.map((row: ArticleRow) =>
    toStoredArticle(row, languagesByArticle.get(row.id) ?? []),
  )
}

export async function getStoredArticle(
  database: D1Database,
  id: string,
): Promise<StoredArticle | undefined> {
  const [articleResult, languageResult] = await Promise.all([
    database
      .prepare('SELECT * FROM articles WHERE id = ?')
      .bind(id)
      .all<ArticleRow>(),
    database
      .prepare('SELECT * FROM article_languages WHERE article_id = ?')
      .bind(id)
      .all<LanguageRow>(),
  ])
  const row = articleResult.results[0]
  return row ? toStoredArticle(row, languageResult.results) : undefined
}

export class ArticleWriteConflictError extends Error {
  constructor() {
    super('Article changed since it was loaded')
    this.name = 'ArticleWriteConflictError'
  }
}

export async function putStoredArticle(
  database: D1Database,
  record: StoredArticle,
  expectedRevision: number | undefined,
): Promise<number> {
  const previousMediaKeys = await articleMediaObjectKeys(database, record.id)
  const writeToken = crypto.randomUUID()
  await database.batch(
    articleStatements(
      database,
      record,
      writeToken,
      expectedRevision,
      previousMediaKeys,
    ),
  )
  const result = await database
    .prepare('SELECT revision, write_token FROM articles WHERE id = ?')
    .bind(record.id)
    .all<{ revision: number; write_token: string }>()
  const current = result.results[0]
  if (!current || current.write_token !== writeToken)
    throw new ArticleWriteConflictError()
  return current.revision
}

export type ArticleDeleteResult =
  'deleted' | 'not-found' | 'stale-write' | 'still-published'

export async function deleteStoredArticle(
  database: D1Database,
  id: string,
  expectedRevision: number,
  now: string,
): Promise<ArticleDeleteResult> {
  const record = await getStoredArticle(database, id)
  if (!record) return 'not-found'
  if (record.revision !== expectedRevision) return 'stale-write'
  if (hasLivePublished(record.article)) return 'still-published'

  const mediaKeys = await articleMediaObjectKeys(database, id)
  await database.batch([
    database
      .prepare('DELETE FROM articles WHERE id = ? AND revision = ?')
      .bind(id, expectedRevision),
    ...mediaKeys.map((objectKey) =>
      database
        .prepare(
          `UPDATE media_objects
           SET unreferenced_since = COALESCE(unreferenced_since, ?)
           WHERE object_key = ? AND NOT EXISTS (
             SELECT 1 FROM media_references WHERE object_key = ?
           )`,
        )
        .bind(now, objectKey, objectKey),
    ),
  ])
  const remaining = await getStoredArticle(database, id)
  return remaining ? 'stale-write' : 'deleted'
}

export function newArticleId(): string {
  return crypto.randomUUID()
}

export type StoreFixture = 'default' | 'en-only' | 'empty'

/** Local/test reset only. Production callers must never invoke this function. */
export async function resetArticles(
  database: D1Database,
  fixture: StoreFixture = 'default',
): Promise<void> {
  const chosen =
    fixture === 'empty'
      ? []
      : fixture === 'en-only'
        ? seeds.filter((seed) => seed.slug === 'en-only-example')
        : seeds
  const statements = [
    database.prepare('DELETE FROM article_ideas'),
    database.prepare('DELETE FROM article_languages'),
    database.prepare('DELETE FROM articles'),
  ]
  for (const seed of chosen) {
    const record = seedRecord(seed)
    statements.push(
      ...articleStatements(database, record, crypto.randomUUID(), undefined),
    )
  }
  await database.batch(statements)
}

/** Public view reads only published columns; drafts are never selected. */
export async function publishedPosts(
  database: D1Database,
): Promise<PublicPost[]> {
  const result = await database
    .prepare(
      `SELECT a.slug, al.language, al.published_title, al.published_summary,
              al.published_body, al.published_at, al.published_updated_at,
              al.published_images_json, al.published_category, al.published_tags_json
       FROM articles a JOIN article_languages al ON al.article_id = a.id
       WHERE a.slug IS NOT NULL AND al.published_title IS NOT NULL
         AND al.published_summary IS NOT NULL AND al.published_body IS NOT NULL
         AND al.published_category IS NOT NULL AND al.published_at IS NOT NULL
         AND al.published_updated_at IS NOT NULL AND al.withdrawn_at IS NULL
       ORDER BY al.published_at DESC, a.id ASC`,
    )
    .all<{
      slug: string
      language: string
      published_title: string
      published_summary: string
      published_body: string
      published_at: string
      published_updated_at: string
      published_images_json: string
      published_category: string
      published_tags_json: string
    }>()
  const posts = new Map<string, PublicPost>()
  for (const row of result.results) {
    if (row.language !== 'zh' && row.language !== 'en') continue
    const post = posts.get(row.slug) ?? {
      slug: row.slug,
      zh: undefined,
      en: undefined,
    }
    const version = {
      title: row.published_title,
      summary: row.published_summary,
      body: row.published_body,
      publishedAt: row.published_at.slice(0, 10),
      updatedAt: row.published_updated_at,
      category: row.published_category,
      tags: parseList(row.published_tags_json),
    }
    const language = row.language as Language
    post[language] = version
    posts.set(row.slug, post)
  }
  return [...posts.values()]
}
