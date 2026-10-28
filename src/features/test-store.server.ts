import { env } from 'cloudflare:workers'

import { createGitHubSession } from '#/features/github-auth.server'
import { encryptSecret, maskSecret } from '#/features/ai-secrets'
import { createConnection, createModel, resetAiStores } from '#/server/data/ai'
import { SESSION_MAX_AGE } from '#/server/auth-session'
import {
  getStoredArticle,
  putStoredArticle,
  resetArticles,
  type StoreFixture,
} from '#/server/data/articles'
import { putStoredIdea, resetIdeas } from '#/server/data/ideas'
import { putTaxonomyEntry, resetTaxonomy } from '#/server/data/taxonomy'
import { runtimeDatabase, type D1Database } from '#/server/data/db'
import {
  cleanupUnreferencedMedia,
  registerUploadedMedia,
  resetMediaObjects,
  type MediaBucket,
} from '#/server/data/media'

const fixtures = ['default', 'en-only', 'empty', 'many', 'ai'] as const

async function addMany(database: D1Database) {
  const at = (index: number) =>
    new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
  for (let index = 1; index <= 40; index += 1) {
    const number = String(index).padStart(2, '0')
    await putStoredArticle(
      database,
      {
        id: `many-${number}`,
        article: {
          slug: `many-${number}`,
          category: 'engineering',
          tags: [],
          zh: {
            draft: {
              title: `批量草稿 ${number}`,
              summary: '分页用的草稿。',
              body: '草稿正文。',
              images: [],
            },
          },
          en: {},
        },
        savedAt: at(index),
        revision: 0,
        ideaIds: [],
        lastLanguage: 'zh',
      },
      undefined,
    )
    await putStoredIdea(database, {
      id: `many-idea-${number}`,
      text: `批量 Idea ${number}：分页用的想法。`,
      createdAt: at(index),
      updatedAt: at(index),
    })
  }
  for (let index = 1; index <= 20; index += 1) {
    const number = String(index).padStart(2, '0')
    for (const kind of ['categories', 'tags'] as const)
      await putTaxonomyEntry(database, kind, {
        slug: `many-${kind}-${number}`,
        zh: `批量${kind === 'categories' ? '分类' : '标签'} ${number}`,
        en: `Bulk ${kind === 'categories' ? 'category' : 'tag'} ${number}`,
      })
  }
}

/** Exercise a late D1 constraint failure against the synthetic fixture. */
export async function verifyArticleAtomicity(): Promise<boolean> {
  const database = await runtimeDatabase()
  const before = await getStoredArticle(database, 'boundary-example')
  const draft = before?.article.zh.draft
  if (!before || !draft) return false
  let failed = false
  try {
    await putStoredArticle(
      database,
      {
        ...before,
        article: {
          ...before.article,
          zh: {
            ...before.article.zh,
            draft: {
              ...draft,
              title: '这次写入必须整体回滚',
              images: ['/media/123e4567-e89b-42d3-a456-426614174000'],
            },
          },
        },
      },
      before.revision,
    )
  } catch {
    failed = true
  }
  const after = await getStoredArticle(database, before.id)
  return failed && JSON.stringify(after) === JSON.stringify(before)
}

export async function createSyntheticAdminSession(): Promise<string> {
  const now = new Date().toISOString()
  const sessionId = crypto.randomUUID()
  await createGitHubSession(
    await runtimeDatabase(),
    { id: 0, login: 'Kai Li' },
    now,
    new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
    sessionId,
  )
  return sessionId
}

/** Exercise one failed R2 delete followed by a successful scheduled retry. */
export async function verifyMediaCleanupRetry(): Promise<boolean> {
  if (!env.MEDIA) return false
  const database = await runtimeDatabase()
  const objectKey = crypto.randomUUID()
  await env.MEDIA.put(
    objectKey,
    new Blob([new Uint8Array([1, 2, 3])]).stream(),
    {
      httpMetadata: { contentType: 'image/png' },
    },
  )
  await registerUploadedMedia(
    database,
    objectKey,
    'image/png',
    3,
    '2026-10-01T00:00:00.000Z',
  )
  let firstDelete = true
  const flakyBucket: MediaBucket = {
    put: (key, body, options) => env.MEDIA.put(key, body, options),
    get: (key) => env.MEDIA.get(key),
    delete: async (key) => {
      if (firstDelete) {
        firstDelete = false
        throw new Error('synthetic R2 delete failure')
      }
      await env.MEDIA.delete(key)
    },
  }
  const first = await cleanupUnreferencedMedia(
    database,
    flakyBucket,
    '2026-10-09T00:00:00.000Z',
  )
  const second = await cleanupUnreferencedMedia(
    database,
    flakyBucket,
    '2026-10-09T00:01:00.000Z',
  )
  const row = await database
    .prepare('SELECT object_key FROM media_objects WHERE object_key = ?')
    .bind(objectKey)
    .first<{ object_key: string }>()
  return (
    first.failed === 1 &&
    first.deleted === 0 &&
    second.deleted === 1 &&
    second.failed === 0 &&
    row === null &&
    (await env.MEDIA.get(objectKey)) === null
  )
}

/** Exercise the exact seven-day boundary and exclude an active reference. */
export async function verifyMediaCleanupBoundary(): Promise<boolean> {
  if (!env.MEDIA) return false
  const database = await runtimeDatabase()
  const exact = crypto.randomUUID()
  const younger = crypto.randomUUID()
  const referenced = crypto.randomUUID()
  for (const [objectKey, createdAt] of [
    [exact, '2026-10-02T00:00:00.000Z'],
    [younger, '2026-10-02T00:00:00.001Z'],
    [referenced, '2026-10-01T00:00:00.000Z'],
  ] as const) {
    await env.MEDIA.put(objectKey, new Blob([new Uint8Array([1])]).stream(), {
      httpMetadata: { contentType: 'image/png' },
    })
    await registerUploadedMedia(database, objectKey, 'image/png', 1, createdAt)
  }
  await database
    .prepare(
      `INSERT INTO media_references
       (object_key, article_id, language, visibility) VALUES (?, ?, ?, ?)`,
    )
    .bind(referenced, 'boundary-example', 'en', 'published')
    .run()
  const result = await cleanupUnreferencedMedia(
    database,
    env.MEDIA,
    '2026-10-09T00:00:00.000Z',
  )
  const liveRows = await database
    .prepare(
      `SELECT object_key FROM media_objects
       WHERE object_key IN (?, ?) AND deleted_at IS NULL
       ORDER BY object_key`,
    )
    .bind(younger, referenced)
    .all<{ object_key: string }>()
  return (
    result.deleted === 1 &&
    result.failed === 0 &&
    result.retained === 0 &&
    (await env.MEDIA.get(exact)) === null &&
    (await env.MEDIA.get(younger)) !== null &&
    (await env.MEDIA.get(referenced)) !== null &&
    liveRows.results.length === 2
  )
}

async function addAiFixture(database: D1Database) {
  const apiKey = 'sk-test-0000'
  const keyMask = maskSecret(apiKey)
  const createdAt = '2026-10-27T00:00:00.000Z'
  const masterKey = env.AI_MASTER_KEY ?? ''
  const primarySecret = await encryptSecret(apiKey, masterKey)
  const backupSecret = await encryptSecret(apiKey, masterKey)

  await createConnection(database, {
    id: 'ai-primary',
    name: '主中转',
    baseURL: 'https://ai-mock.test/down/v1',
    enabled: true,
    dataClasses: ['public', 'draft'],
    secret: { ...primarySecret, keyMask },
    createdAt,
    updatedAt: createdAt,
  })
  await createConnection(database, {
    id: 'ai-backup',
    name: '备用中转',
    baseURL: 'https://ai-mock.test/ok/v1',
    enabled: true,
    dataClasses: ['public', 'draft'],
    secret: { ...backupSecret, keyMask },
    createdAt,
    updatedAt: createdAt,
  })
  await createModel(database, {
    id: 'ai-primary-mock-json',
    connectionId: 'ai-primary',
    providerModelId: 'mock-json',
    capability: 'chat',
    enabled: true,
    source: 'discovered',
    createdAt,
  })
  await createModel(database, {
    id: 'ai-backup-mock-json',
    connectionId: 'ai-backup',
    providerModelId: 'mock-json',
    capability: 'chat',
    enabled: true,
    source: 'discovered',
    createdAt,
  })
}

/** Development / e2e only: restore every local D1 fixture. */
export async function resetStores(fixture: string): Promise<boolean> {
  if (!fixtures.includes(fixture as (typeof fixtures)[number])) return false
  const database = await runtimeDatabase()
  const articleFixture =
    fixture === 'many' || fixture === 'ai'
      ? 'default'
      : (fixture as StoreFixture)
  await resetAiStores(database)
  // Referenced taxonomy cannot be deleted. Empty articles first, reset the
  // shared stores, then rebuild the requested article fixture.
  await resetArticles(database, 'empty')
  for (const objectKey of await resetMediaObjects(database))
    await env.MEDIA?.delete(objectKey)
  await resetIdeas(database)
  await resetTaxonomy(database)
  await resetArticles(database, articleFixture)
  if (fixture === 'many') await addMany(database)
  if (fixture === 'ai') await addAiFixture(database)
  return true
}
