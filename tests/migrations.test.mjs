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
        '0005_article_withdrawal.sql',
        '0006_withdrawn_taxonomy.sql',
        '0007_withdrawn_guards.sql',
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
      database.exec(`
        INSERT INTO taxonomy_entries (kind, slug, zh, en)
        VALUES ('categories', 'withdrawn-category', '撤下分类', 'Withdrawn category'),
               ('tags', 'withdrawn-tag', '撤下标签', 'Withdrawn tag');
        INSERT INTO article_languages
          (article_id, language, published_title, published_summary, published_body,
           published_images_json, published_category, published_tags_json,
           published_at, published_updated_at, withdrawn_at)
        VALUES
          ('article-1', 'en', 'Old', 'Old', 'Old', '[]', 'withdrawn-category',
           '["withdrawn-tag"]', '2026-01-01', '2026-01-01', '2026-02-01');
        UPDATE articles SET category = 'engineering', tags_json = '[]'
        WHERE id = 'article-1';
      `)
      expect(() =>
        database
          .prepare(
            `DELETE FROM taxonomy_entries
             WHERE kind = 'categories' AND slug = 'withdrawn-category'`,
          )
          .run(),
      ).not.toThrow()
      expect(() =>
        database
          .prepare(
            `DELETE FROM taxonomy_entries
             WHERE kind = 'tags' AND slug = 'withdrawn-tag'`,
          )
          .run(),
      ).not.toThrow()
      expect(() =>
        database
          .prepare(
            `INSERT INTO media_references
             (object_key, article_id, language, visibility)
             VALUES ('object-1', 'article-1', 'en', 'withdrawn')`,
          )
          .run(),
      ).not.toThrow()
      database.exec(`
        INSERT INTO articles (id, slug, category, saved_at)
        VALUES ('article-2', 'live-check', NULL, '2026-01-01');
      `)
      expect(() =>
        database
          .prepare(
            `INSERT INTO article_languages
             (article_id, language, published_title, published_summary,
              published_body, published_images_json, published_category,
              published_tags_json, published_at, published_updated_at)
             VALUES ('article-2', 'zh', '标题', '摘要', '正文', '[]',
                     'missing-category', '[]', '2026-01-01', '2026-01-01')`,
          )
          .run(),
      ).toThrow(/published taxonomy is unavailable/)
      expect(() =>
        database
          .prepare(
            `INSERT INTO media_references
             (object_key, article_id, language, visibility)
             VALUES ('object-1', 'article-1', 'fr', 'withdrawn')`,
          )
          .run(),
      ).toThrow(/invalid media reference slot/)
      expect(() =>
        database
          .prepare(
            `INSERT INTO media_references
             (object_key, article_id, language, visibility)
             VALUES ('object-1', 'article-1', 'en', 'bogus')`,
          )
          .run(),
      ).toThrow(/invalid media reference slot/)
    } finally {
      database.close()
    }
  })

  it('adds AI storage with unique models and cascading defaults', () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      for (const name of [
        '0000_left_patch.sql',
        '0001_nullable_article_slug.sql',
        '0002_media_reference_guard.sql',
        '0003_live_media_reference.sql',
        '0004_concurrency_taxonomy_guards.sql',
        '0005_article_withdrawal.sql',
        '0006_withdrawn_taxonomy.sql',
        '0007_withdrawn_guards.sql',
        '0008_ai_connections.sql',
      ])
        database.exec(migration(name))

      database.exec(`
        INSERT INTO ai_connections
          (id, name, base_url, key_iv, key_ciphertext, key_mask, priority,
           enabled, created_at, updated_at)
        VALUES
          ('connection-1', 'Main', 'https://example.com/v1', 'iv', 'ciphertext',
           'sk-…0000', 1, 1, '2026-10-27', '2026-10-27');
        INSERT INTO ai_models
          (id, connection_id, provider_model_id, source, created_at)
        VALUES
          ('model-1', 'connection-1', 'provider-model', 'discovered',
           '2026-10-27');
        INSERT INTO ai_defaults (capability, model_id)
        VALUES ('chat', 'model-1');
      `)

      expect(() =>
        database
          .prepare(
            `INSERT INTO ai_models
             (id, connection_id, provider_model_id, source, created_at)
             VALUES ('model-2', 'connection-1', 'provider-model', 'manual',
                     '2026-10-27')`,
          )
          .run(),
      ).toThrow(/UNIQUE constraint failed/)

      database
        .prepare("DELETE FROM ai_connections WHERE id = 'connection-1'")
        .run()
      expect(
        database.prepare('SELECT count(*) AS count FROM ai_models').get(),
      ).toEqual({ count: 0 })
      expect(
        database.prepare('SELECT count(*) AS count FROM ai_defaults').get(),
      ).toEqual({ count: 0 })
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      database.close()
    }
  })

  it('moves AI models to an explicit call order and drops defaults and priority', () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      for (const name of [
        '0000_left_patch.sql',
        '0001_nullable_article_slug.sql',
        '0002_media_reference_guard.sql',
        '0003_live_media_reference.sql',
        '0004_concurrency_taxonomy_guards.sql',
        '0005_article_withdrawal.sql',
        '0006_withdrawn_taxonomy.sql',
        '0007_withdrawn_guards.sql',
        '0008_ai_connections.sql',
      ])
        database.exec(migration(name))

      database.exec(`
        INSERT INTO ai_connections
          (id, name, base_url, key_iv, key_ciphertext, key_mask, priority,
           enabled, created_at, updated_at)
        VALUES
          ('connection-1', 'Main', 'https://example.com/v1', 'iv', 'ciphertext',
           'sk-…0000', 1, 1, '2026-10-27', '2026-10-27');
        INSERT INTO ai_models
          (id, connection_id, provider_model_id, capabilities_json, source,
           created_at)
        VALUES
          ('model-1', 'connection-1', 'first', '["chat","structured-output"]',
           'discovered', '2026-10-27'),
          ('model-2', 'connection-1', 'second', '["chat"]', 'manual',
           '2026-10-27');
        INSERT INTO ai_defaults (capability, model_id)
        VALUES ('structured-output', 'model-1');
      `)

      database.exec(migration('0009_ai_model_order.sql'))

      expect(
        database
          .prepare("SELECT name FROM sqlite_master WHERE name = 'ai_defaults'")
          .all(),
      ).toEqual([])
      expect(
        database
          .prepare("SELECT name FROM pragma_table_info('ai_connections')")
          .all()
          .map((column) => column.name),
      ).not.toContain('priority')
      const models = database
        .prepare(
          'SELECT id, capabilities_json, sort_order FROM ai_models ORDER BY sort_order',
        )
        .all()
      expect(models.map((model) => model.id)).toEqual(['model-1', 'model-2'])
      expect(models.map((model) => model.capabilities_json)).toEqual([
        '["chat"]',
        '["chat"]',
      ])
      expect(models.every((model) => model.sort_order !== 0)).toBe(true)
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      database.close()
    }
  })

  it('collapses AI model capability arrays into a single type', () => {
    const database = new DatabaseSync(':memory:')
    try {
      database.exec('PRAGMA foreign_keys = ON')
      for (const name of [
        '0000_left_patch.sql',
        '0001_nullable_article_slug.sql',
        '0002_media_reference_guard.sql',
        '0003_live_media_reference.sql',
        '0004_concurrency_taxonomy_guards.sql',
        '0005_article_withdrawal.sql',
        '0006_withdrawn_taxonomy.sql',
        '0007_withdrawn_guards.sql',
        '0008_ai_connections.sql',
        '0009_ai_model_order.sql',
      ])
        database.exec(migration(name))

      database.exec(`
        INSERT INTO ai_connections
          (id, name, base_url, key_iv, key_ciphertext, key_mask, enabled,
           created_at, updated_at)
        VALUES
          ('connection-1', 'Main', 'https://example.com/v1', 'iv', 'ciphertext',
           'sk-…0000', 1, '2026-10-27', '2026-10-27');
        INSERT INTO ai_models
          (id, connection_id, provider_model_id, capabilities_json, source,
           created_at)
        VALUES
          ('both', 'connection-1', 'both', '["chat","embedding"]', 'manual',
           '2026-10-27'),
          ('embedding', 'connection-1', 'embedding', '["embedding"]', 'manual',
           '2026-10-27'),
          ('image', 'connection-1', 'image', '["image"]', 'manual',
           '2026-10-27'),
          ('empty', 'connection-1', 'empty', '[]', 'manual', '2026-10-27');
      `)

      database.exec(migration('0010_ai_model_capability.sql'))

      expect(
        database
          .prepare('SELECT id, capability FROM ai_models ORDER BY id')
          .all(),
      ).toEqual([
        { id: 'both', capability: 'chat' },
        { id: 'embedding', capability: 'embedding' },
        { id: 'empty', capability: 'chat' },
        { id: 'image', capability: 'image' },
      ])
      expect(
        database
          .prepare("SELECT name FROM pragma_table_info('ai_models')")
          .all()
          .map((column) => column.name),
      ).not.toContain('capabilities_json')
      expect(() =>
        database.exec(
          `UPDATE ai_models SET capability = 'speech' WHERE id = 'both'`,
        ),
      ).toThrow()
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally {
      database.close()
    }
  })
})
