import type { Article } from '#/features/article-versions'
import { mediaObjectKey } from '#/features/media-lifecycle'
import type { D1Database, D1PreparedStatement } from '#/server/data/db'

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024
export const MEDIA_CONTENT_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export type MediaBucket = {
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(
    key: string,
  ): Promise<{ body: ReadableStream<Uint8Array>; httpEtag?: string } | null>
  delete(key: string): Promise<void>
}

export async function registerUploadedMedia(
  database: D1Database,
  objectKey: string,
  contentType: string,
  byteLength: number,
  now: string,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO media_objects
       (object_key, content_type, byte_length, created_at, unreferenced_since, deleted_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .bind(objectKey, contentType, byteLength, now, now)
    .run()
}

/** Development/test reset helper; production paths never call this. */
export async function resetMediaObjects(
  database: D1Database,
): Promise<string[]> {
  const result = await database
    .prepare('SELECT object_key FROM media_objects')
    .all<{ object_key: string }>()
  await database.prepare('DELETE FROM media_objects').run()
  return result.results.map((row: { object_key: string }) => row.object_key)
}
export async function missingMediaObjects(
  database: D1Database,
  urls: readonly string[],
): Promise<string[]> {
  const keys = [
    ...new Set(urls.map(mediaObjectKey).filter((key) => key !== null)),
  ]
  if (keys.length === 0) return []
  const result = await database
    .prepare(
      `SELECT object_key FROM media_objects
       WHERE deleted_at IS NULL AND object_key IN (${keys.map(() => '?').join(', ')})`,
    )
    .bind(...keys)
    .all<{ object_key: string }>()
  const available = new Set(
    result.results.map((row: { object_key: string }) => row.object_key),
  )
  return keys.filter((key) => !available.has(key))
}

function slotKeys(images: readonly string[]): string[] {
  return [...new Set(images.map(mediaObjectKey).filter((key) => key !== null))]
}

export async function articleMediaObjectKeys(
  database: D1Database,
  articleId: string,
): Promise<string[]> {
  const result = await database
    .prepare(
      'SELECT DISTINCT object_key FROM media_references WHERE article_id = ?',
    )
    .bind(articleId)
    .all<{ object_key: string }>()
  return result.results.map((row: { object_key: string }) => row.object_key)
}

/** Rebuild one article's four reference slots in the same D1 batch as its content. */
export function articleMediaStatements(
  database: D1Database,
  articleId: string,
  article: Article,
  now: string,
  writeToken: string,
  previousObjectKeys: readonly string[] = [],
): D1PreparedStatement[] {
  const ownsWrite =
    'EXISTS (SELECT 1 FROM articles WHERE id = ? AND write_token = ?)'
  const currentObjectKeys = new Set<string>()
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `DELETE FROM media_references
         WHERE article_id = ? AND ${ownsWrite}`,
      )
      .bind(articleId, articleId, writeToken),
  ]
  for (const language of ['zh', 'en'] as const) {
    const version = article[language]
    const publishedSlot = version.published
      ? version.published.withdrawnAt
        ? (['withdrawn', version.published.images] as const)
        : (['published', version.published.images] as const)
      : null
    const slots = [
      ['draft', version.draft?.images ?? []] as const,
      ...(publishedSlot ? [publishedSlot] : []),
    ]
    for (const [visibility, images] of slots) {
      for (const objectKey of slotKeys(images)) {
        currentObjectKeys.add(objectKey)
        statements.push(
          database
            .prepare(
              `INSERT INTO media_references
               (object_key, article_id, language, visibility)
               SELECT ?, ?, ?, ? WHERE ${ownsWrite}`,
            )
            .bind(
              objectKey,
              articleId,
              language,
              visibility,
              articleId,
              writeToken,
            ),
        )
      }
    }
  }
  for (const objectKey of new Set([
    ...previousObjectKeys,
    ...currentObjectKeys,
  ]))
    statements.push(
      database
        .prepare(
          `UPDATE media_objects
           SET unreferenced_since = CASE
             WHEN EXISTS (
               SELECT 1 FROM media_references r
               WHERE r.object_key = media_objects.object_key
             ) THEN NULL
             ELSE COALESCE(unreferenced_since, ?)
           END
           WHERE object_key = ? AND deleted_at IS NULL AND ${ownsWrite}`,
        )
        .bind(now, objectKey, articleId, writeToken),
    )
  return statements
}

export type MediaAccess = {
  contentType: string
  byteLength: number
  publiclyReadable: boolean
}

export async function mediaAccess(
  database: D1Database,
  objectKey: string,
  authenticated: boolean,
): Promise<MediaAccess | null> {
  const result = await database
    .prepare(
      `SELECT m.content_type, m.byte_length,
        EXISTS (
          SELECT 1 FROM media_references r
          WHERE r.object_key = m.object_key AND r.visibility = 'published'
        ) AS publicly_readable
       FROM media_objects m
       WHERE m.object_key = ? AND m.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(objectKey)
    .all<{
      content_type: string
      byte_length: number
      publicly_readable: number
    }>()
  const row = result.results[0]
  if (!row || (!authenticated && row.publicly_readable !== 1)) return null
  return {
    contentType: row.content_type,
    byteLength: row.byte_length,
    publiclyReadable: row.publicly_readable === 1,
  }
}

export type CleanupResult = {
  deleted: number
  failed: number
  retained: number
}

/**
 * Tombstone in D1 first, then delete from R2. Failed R2 deletes retain the
 * tombstone and are retried by the next run; a trigger rejects new references.
 */
export async function cleanupUnreferencedMedia(
  database: D1Database,
  bucket: MediaBucket,
  now: string,
): Promise<CleanupResult> {
  const cutoff = new Date(
    Date.parse(now) - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const candidates = await database
    .prepare(
      `SELECT object_key, deleted_at FROM media_objects
       WHERE deleted_at IS NOT NULL
          OR (
            unreferenced_since IS NOT NULL AND unreferenced_since <= ?
            AND NOT EXISTS (
              SELECT 1 FROM media_references r
              WHERE r.object_key = media_objects.object_key
            )
          )
       ORDER BY COALESCE(deleted_at, unreferenced_since) ASC
       LIMIT 100`,
    )
    .bind(cutoff)
    .all<{ object_key: string; deleted_at: string | null }>()
  const result: CleanupResult = { deleted: 0, failed: 0, retained: 0 }
  for (const candidate of candidates.results) {
    let tombstoned = candidate.deleted_at !== null
    if (!tombstoned) {
      const marked = await database
        .prepare(
          `UPDATE media_objects SET deleted_at = ?
           WHERE object_key = ? AND deleted_at IS NULL
             AND unreferenced_since IS NOT NULL AND unreferenced_since <= ?
             AND NOT EXISTS (
               SELECT 1 FROM media_references r
               WHERE r.object_key = media_objects.object_key
             )`,
        )
        .bind(now, candidate.object_key, cutoff)
        .run()
      tombstoned = Number(marked.meta.changes ?? 0) === 1
    }
    if (!tombstoned) {
      result.retained += 1
      continue
    }
    try {
      await bucket.delete(candidate.object_key)
      await database
        .prepare(
          `DELETE FROM media_objects
           WHERE object_key = ? AND deleted_at IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM media_references r
               WHERE r.object_key = media_objects.object_key
             )`,
        )
        .bind(candidate.object_key)
        .run()
      result.deleted += 1
    } catch {
      result.failed += 1
    }
  }
  return result
}
