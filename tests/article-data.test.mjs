import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { deleteStoredArticle } from '../src/server/data/articles.ts'
import { mediaAccess } from '../src/server/data/media.ts'

const migration = (name) =>
  readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')

const migrations = [
  '0000_left_patch.sql',
  '0001_nullable_article_slug.sql',
  '0002_media_reference_guard.sql',
  '0003_live_media_reference.sql',
  '0004_concurrency_taxonomy_guards.sql',
  '0005_article_withdrawal.sql',
  '0006_withdrawn_taxonomy.sql',
  '0007_withdrawn_guards.sql',
]

function d1(database) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          const statement = database.prepare(sql)
          return {
            async all() {
              return { results: statement.all(...params) }
            },
            async run() {
              const result = statement.run(...params)
              return { meta: { changes: Number(result.changes) } }
            },
          }
        },
      }
    },
    async batch(statements) {
      database.exec('BEGIN')
      try {
        for (const statement of statements) await statement.run()
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }
}

describe('文章数据删除边界', () => {
  it('删除撤下文章会级联关系并把媒体交给七天清理', async () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      for (const name of migrations) database.exec(migration(name))
      database.exec(`
        INSERT INTO taxonomy_entries (kind, slug, zh, en)
        VALUES ('categories', 'engineering', '工程', 'Engineering');
        INSERT INTO ideas (id, text, created_at, updated_at)
        VALUES ('idea-1', 'Idea', '2026-01-01', '2026-01-01');
        INSERT INTO articles
          (id, slug, category, tags_json, idea_ids_json, saved_at, revision, write_token)
        VALUES ('article-1', 'deleted', 'engineering', '[]', '["idea-1"]',
                '2026-01-01', 3, 'token');
        INSERT INTO article_languages
          (article_id, language, draft_title, draft_summary, draft_body,
           draft_images_json, published_title, published_summary, published_body,
           published_images_json, published_category, published_tags_json,
           published_at, published_updated_at, withdrawn_at)
        VALUES ('article-1', 'zh', '草稿', '摘要', '正文', '[]',
                '旧标题', '旧摘要', '旧正文', '[]', 'engineering', '[]',
                '2026-01-01', '2026-01-01', '2026-02-01');
        INSERT INTO article_ideas (article_id, idea_id)
        VALUES ('article-1', 'idea-1');
        INSERT INTO media_objects
          (object_key, content_type, byte_length, created_at, unreferenced_since, deleted_at)
        VALUES ('object-1', 'image/png', 10, '2026-01-01', NULL, NULL);
        INSERT INTO media_references (object_key, article_id, language, visibility)
        VALUES ('object-1', 'article-1', 'zh', 'withdrawn');
      `)
      expect(await mediaAccess(d1(database), 'object-1', false)).toBeNull()
      expect(await mediaAccess(d1(database), 'object-1', true)).toMatchObject({
        publiclyReadable: false,
      })

      const result = await deleteStoredArticle(
        d1(database),
        'article-1',
        3,
        '2026-10-27T00:00:00.000Z',
      )
      expect(result).toBe('deleted')
      expect(database.prepare('SELECT * FROM articles').all()).toEqual([])
      expect(database.prepare('SELECT * FROM article_languages').all()).toEqual(
        [],
      )
      expect(database.prepare('SELECT * FROM article_ideas').all()).toEqual([])
      expect(database.prepare('SELECT * FROM media_references').all()).toEqual(
        [],
      )
      expect(
        database.prepare('SELECT unreferenced_since FROM media_objects').all(),
      ).toEqual([{ unreferenced_since: '2026-10-27T00:00:00.000Z' }])
    } finally {
      database.close()
    }
  })
  it('活跃公开版本和过期 revision 都不能删除', async () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      for (const name of migrations) database.exec(migration(name))
      database.exec(`
        INSERT INTO taxonomy_entries (kind, slug, zh, en)
        VALUES ('categories', 'engineering', '工程', 'Engineering');
        INSERT INTO articles (id, slug, category, saved_at, revision, write_token)
        VALUES ('article-1', 'live', 'engineering', '2026-01-01', 3, 'token');
        INSERT INTO article_languages
          (article_id, language, published_title, published_summary, published_body,
           published_images_json, published_category, published_tags_json,
           published_at, published_updated_at)
        VALUES ('article-1', 'zh', '标题', '摘要', '正文', '[]', 'engineering', '[]',
                '2026-01-01', '2026-01-01');
      `)
      const wrapped = d1(database)
      expect(
        await deleteStoredArticle(
          wrapped,
          'article-1',
          3,
          '2026-10-27T00:00:00.000Z',
        ),
      ).toBe('still-published')
      expect(
        await deleteStoredArticle(
          wrapped,
          'article-1',
          2,
          '2026-10-27T00:00:00.000Z',
        ),
      ).toBe('stale-write')
    } finally {
      database.close()
    }
  })
})
