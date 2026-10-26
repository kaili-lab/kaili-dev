import type { D1Database } from '#/server/data/db'

export type TaxonomyEntry = { slug: string; zh: string; en: string }
export type TaxonomyKind = 'categories' | 'tags'

type TaxonomyRow = { kind: string; slug: string; zh: string; en: string }

function toEntry(row: TaxonomyRow): TaxonomyEntry {
  return { slug: row.slug, zh: row.zh, en: row.en }
}

export async function listTaxonomy(
  database: D1Database,
  kind: TaxonomyKind,
): Promise<TaxonomyEntry[]> {
  const result = await database
    .prepare(
      'SELECT kind, slug, zh, en FROM taxonomy_entries WHERE kind = ? ORDER BY rowid ASC',
    )
    .bind(kind)
    .all<TaxonomyRow>()
  return result.results.map(toEntry)
}

export async function putTaxonomyEntry(
  database: D1Database,
  kind: TaxonomyKind,
  entry: TaxonomyEntry,
  previousSlug?: string,
): Promise<void> {
  const statements = [
    database
      .prepare(
        `INSERT INTO taxonomy_entries (kind, slug, zh, en) VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, slug) DO UPDATE SET zh=excluded.zh, en=excluded.en`,
      )
      .bind(kind, entry.slug, entry.zh, entry.en),
  ]
  if (previousSlug && previousSlug !== entry.slug) {
    const records = await database
      .prepare('SELECT id, category, tags_json FROM articles')
      .all<{ id: string; category: string | null; tags_json: string }>()
    for (const record of records.results) {
      const tags: unknown = JSON.parse(record.tags_json)
      const nextTags =
        kind === 'tags' && Array.isArray(tags)
          ? tags.map((tag) => (tag === previousSlug ? entry.slug : tag))
          : tags
      const category =
        kind === 'categories' && record.category === previousSlug
          ? entry.slug
          : record.category
      if (
        category !== record.category ||
        JSON.stringify(nextTags) !== record.tags_json
      )
        statements.push(
          database
            .prepare(
              'UPDATE articles SET category = ?, tags_json = ? WHERE id = ?',
            )
            .bind(category, JSON.stringify(nextTags), record.id),
        )
    }
    statements.push(
      database
        .prepare('DELETE FROM taxonomy_entries WHERE kind = ? AND slug = ?')
        .bind(kind, previousSlug),
    )
  }
  await database.batch(statements)
}

export async function deleteTaxonomyEntry(
  database: D1Database,
  kind: TaxonomyKind,
  slug: string,
): Promise<void> {
  await database
    .prepare('DELETE FROM taxonomy_entries WHERE kind = ? AND slug = ?')
    .bind(kind, slug)
    .run()
}

const seed: Record<TaxonomyKind, TaxonomyEntry[]> = {
  categories: [
    { slug: 'engineering', zh: '工程', en: 'Engineering' },
    { slug: 'ai', zh: 'AI', en: 'AI' },
  ],
  tags: [
    { slug: 'typescript', zh: 'TypeScript', en: 'TypeScript' },
    { slug: 'cloudflare', zh: 'Cloudflare', en: 'Cloudflare' },
  ],
}

/** Local/test reset only; production never seeds the remote database. */
export async function resetTaxonomy(database: D1Database): Promise<void> {
  const statements = [database.prepare('DELETE FROM taxonomy_entries')]
  for (const kind of ['categories', 'tags'] as const)
    for (const entry of seed[kind])
      statements.push(
        database
          .prepare(
            'INSERT INTO taxonomy_entries (kind, slug, zh, en) VALUES (?, ?, ?, ?)',
          )
          .bind(kind, entry.slug, entry.zh, entry.en),
      )
  await database.batch(statements)
}
