import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    githubId: text('github_id').notNull(),
    githubLogin: text('github_login').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('accounts_github_id_idx').on(table.githubId)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('sessions_account_id_idx').on(table.accountId)],
)

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    slug: text('slug'),
    category: text('category'),
    tagsJson: text('tags_json').notNull().default('[]'),
    ideaIdsJson: text('idea_ids_json').notNull().default('[]'),
    savedAt: text('saved_at').notNull(),
    lastLanguage: text('last_language'),
    revision: integer('revision').notNull().default(0),
    writeToken: text('write_token').notNull().default(''),
  },
  (table) => [uniqueIndex('articles_slug_idx').on(table.slug)],
)

export const articleLanguages = sqliteTable(
  'article_languages',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    draftTitle: text('draft_title'),
    draftSummary: text('draft_summary'),
    draftBody: text('draft_body'),
    draftImagesJson: text('draft_images_json').notNull().default('[]'),
    publishedTitle: text('published_title'),
    publishedSummary: text('published_summary'),
    publishedBody: text('published_body'),
    publishedImagesJson: text('published_images_json').notNull().default('[]'),
    publishedCategory: text('published_category'),
    publishedTagsJson: text('published_tags_json').notNull().default('[]'),
    publishedAt: text('published_at'),
    publishedUpdatedAt: text('published_updated_at'),
    withdrawnAt: text('withdrawn_at'),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.language] }),
    index('article_languages_language_idx').on(table.language),
  ],
)

export const taxonomyEntries = sqliteTable(
  'taxonomy_entries',
  {
    kind: text('kind').notNull(),
    slug: text('slug').notNull(),
    zh: text('zh').notNull(),
    en: text('en').notNull(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.slug] })],
)

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const articleIdeas = sqliteTable(
  'article_ideas',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    ideaId: text('idea_id')
      .notNull()
      .references(() => ideas.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.ideaId] })],
)

export const mediaObjects = sqliteTable(
  'media_objects',
  {
    objectKey: text('object_key').primaryKey(),
    contentType: text('content_type').notNull(),
    byteLength: integer('byte_length').notNull(),
    createdAt: text('created_at').notNull(),
    unreferencedSince: text('unreferenced_since'),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('media_objects_cleanup_idx').on(table.unreferencedSince)],
)

export const mediaReferences = sqliteTable(
  'media_references',
  {
    objectKey: text('object_key')
      .notNull()
      .references(() => mediaObjects.objectKey, { onDelete: 'cascade' }),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    visibility: text('visibility').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.objectKey,
        table.articleId,
        table.language,
        table.visibility,
      ],
    }),
    index('media_references_article_idx').on(table.articleId),
  ],
)

export const aiConnections = sqliteTable(
  'ai_connections',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    baseURL: text('base_url').notNull(),
    keyIv: text('key_iv').notNull(),
    keyCiphertext: text('key_ciphertext').notNull(),
    keyMask: text('key_mask').notNull(),
    enabled: integer('enabled').notNull(),
    dataClassesJson: text('data_classes_json').notNull().default('["public"]'),
    lastCheckedAt: text('last_checked_at'),
    lastOk: integer('last_ok'),
    lastFailure: text('last_failure'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('ai_connections_enabled_check', sql`${table.enabled} IN (0, 1)`),
    check('ai_connections_last_ok_check', sql`${table.lastOk} IN (0, 1)`),
  ],
)

export const aiModels = sqliteTable(
  'ai_models',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => aiConnections.id, { onDelete: 'cascade' }),
    providerModelId: text('provider_model_id').notNull(),
    capabilitiesJson: text('capabilities_json').notNull().default('["chat"]'),
    enabled: integer('enabled').notNull().default(1),
    source: text('source').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('ai_models_connection_provider_idx').on(
      table.connectionId,
      table.providerModelId,
    ),
    check('ai_models_enabled_check', sql`${table.enabled} IN (0, 1)`),
    check(
      'ai_models_source_check',
      sql`${table.source} IN ('discovered', 'manual')`,
    ),
  ],
)

export const aiCalls = sqliteTable(
  'ai_calls',
  {
    id: text('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    purpose: text('purpose').notNull(),
    connectionName: text('connection_name'),
    providerModelId: text('provider_model_id'),
    outcome: text('outcome').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    fellBack: integer('fell_back').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
  },
  (table) => [
    index('ai_calls_created_at_idx').on(table.createdAt),
    check(
      'ai_calls_outcome_check',
      sql`${table.outcome} IN (
        'ok', 'timeout', 'network', 'redirect', 'rate-limited', 'server-error',
        'auth-failed', 'model-missing', 'bad-request', 'bad-format', 'config',
        'no-eligible-connection', 'deadline'
      )`,
    ),
    check('ai_calls_fell_back_check', sql`${table.fellBack} IN (0, 1)`),
  ],
)
