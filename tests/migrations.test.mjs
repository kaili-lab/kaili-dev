import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

const migration = (name) =>
  readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')

describe('D1 migration chain', () => {
  it('preserves article children while rebuilding articles and enforces live taxonomy', () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      database.exec(migration('0000_left_patch.sql'))
      database.exec(`
        INSERT INTO taxonomy_entries (kind, slug, zh, en)
        VALUES ('categories', 'engineering', '工程', 'Engineering'),
               ('tags', 'typescript', 'TypeScript', 'TypeScript');
        INSERT INTO ideas (id, text, created_at, updated_at)
        VALUES ('idea-1', 'Keep me', '2026-01-01', '2026-01-01');
        INSERT INTO articles
          (id, slug, category, tags_json, idea_ids_json, saved_at, last_language)
        VALUES
          ('article-1', 'before-migration', 'engineering', '["typescript"]',
           '["idea-1"]', '2026-01-01', 'zh');
        INSERT INTO article_languages
          (article_id, language, draft_title, draft_summary, draft_body,
           draft_images_json, published_title, published_summary, published_body,
           published_images_json, published_at, published_updated_at)
        VALUES
          ('article-1', 'zh', '标题', '摘要', '正文', '[]',
           '标题', '摘要', '正文', '[]', '2026-01-01', '2026-01-01');
        INSERT INTO article_ideas (article_id, idea_id)
        VALUES ('article-1', 'idea-1');
        INSERT INTO media_objects
          (object_key, content_type, byte_length, created_at, unreferenced_since, deleted_at)
        VALUES ('object-1', 'image/png', 10, '2026-01-01', NULL, NULL);
        INSERT INTO media_references (object_key, article_id, language, visibility)
        VALUES ('object-1', 'article-1', 'zh', 'draft');
      `)

      for (const name of [
        '0001_nullable_article_slug.sql',
        '0002_media_reference_guard.sql',
        '0003_live_media_reference.sql',
        '0004_concurrency_taxonomy_guards.sql',
      ])
        database.exec(migration(name))

      expect(
        database
          .prepare(
            `SELECT draft_title, published_category
             FROM article_languages WHERE article_id = 'article-1'`,
          )
          .get(),
      ).toEqual({ draft_title: '标题', published_category: null })
      expect(
        database
          .prepare(
            `SELECT idea_id FROM article_ideas WHERE article_id = 'article-1'`,
          )
          .get(),
      ).toEqual({ idea_id: 'idea-1' })
      expect(
        database
          .prepare(
            `SELECT object_key FROM media_references
             WHERE article_id = 'article-1'`,
          )
          .get(),
      ).toEqual({ object_key: 'object-1' })
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])

      expect(() =>
        database
          .prepare(
            `DELETE FROM taxonomy_entries
             WHERE kind = 'categories' AND slug = 'engineering'`,
          )
          .run(),
      ).toThrow(/taxonomy entry is referenced/)
      expect(() =>
        database
          .prepare(
            `UPDATE articles SET tags_json = '["missing"]'
             WHERE id = 'article-1'`,
          )
          .run(),
      ).toThrow(/article taxonomy is unavailable/)
    } finally {
      database.close()
    }
  })
})
