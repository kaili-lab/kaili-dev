import type { D1Database } from '#/server/data/db'

export type StoredIdea = {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

const seed: StoredIdea[] = [
  {
    id: 'idea-boundaries',
    text: '边界的本质是归属：谁改、谁负责。也许可以写成一篇关于服务边界的文章。',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
]

type IdeaRow = {
  id: string
  text: string
  created_at: string
  updated_at: string
}

function toStoredIdea(row: IdeaRow): StoredIdea {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listStoredIdeas(
  database: D1Database,
): Promise<StoredIdea[]> {
  const result = await database
    .prepare(
      'SELECT id, text, created_at, updated_at FROM ideas ORDER BY updated_at DESC, id ASC',
    )
    .all<IdeaRow>()
  return result.results.map(toStoredIdea)
}

export async function getStoredIdea(
  database: D1Database,
  id: string,
): Promise<StoredIdea | undefined> {
  const result = await database
    .prepare('SELECT id, text, created_at, updated_at FROM ideas WHERE id = ?')
    .bind(id)
    .all<IdeaRow>()
  const row = result.results[0]
  return row ? toStoredIdea(row) : undefined
}

export async function putStoredIdea(
  database: D1Database,
  idea: StoredIdea,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO ideas (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at`,
    )
    .bind(idea.id, idea.text, idea.createdAt, idea.updatedAt)
    .run()
}

export async function deleteStoredIdea(
  database: D1Database,
  id: string,
): Promise<void> {
  const result = await database
    .prepare('SELECT id, idea_ids_json FROM articles')
    .all<{ id: string; idea_ids_json: string }>()
  const statements = []
  for (const article of result.results) {
    const parsed: unknown = JSON.parse(article.idea_ids_json)
    if (!Array.isArray(parsed) || !parsed.includes(id)) continue
    statements.push(
      database
        .prepare('UPDATE articles SET idea_ids_json = ? WHERE id = ?')
        .bind(
          JSON.stringify(parsed.filter((value) => value !== id)),
          article.id,
        ),
    )
  }
  statements.push(database.prepare('DELETE FROM ideas WHERE id = ?').bind(id))
  await database.batch(statements)
}

/** Local/test reset only; production never seeds the remote database. */
export async function resetIdeas(
  database: D1Database,
  ideas: StoredIdea[] = seed,
): Promise<void> {
  const statements = [database.prepare('DELETE FROM ideas')]
  for (const idea of ideas)
    statements.push(
      database
        .prepare(
          'INSERT INTO ideas (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)',
        )
        .bind(idea.id, idea.text, idea.createdAt, idea.updatedAt),
    )
  await database.batch(statements)
}
