import type { GitHubIdentity } from '#/features/github-oauth'
import type { D1Database } from '#/server/data/db'

export type GitHubSession = {
  accountId: string
  githubId: string
  name: string
}

const sessionIdEncoder = new TextEncoder()

async function digestSessionId(sessionId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', sessionIdEncoder.encode(sessionId)),
  )
  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** Create the account/session and revoke this browser's old session atomically. */
export async function createGitHubSession(
  database: D1Database,
  identity: GitHubIdentity,
  now: string,
  expiresAt: string,
  sessionId: string,
  previousSessionId?: string,
): Promise<void> {
  const [sessionDigest, previousSessionDigest] = await Promise.all([
    digestSessionId(sessionId),
    previousSessionId ? digestSessionId(previousSessionId) : undefined,
  ])
  const githubId = String(identity.id)
  const accountId = `github:${githubId}`
  const statements = [
    database
      .prepare(
        `INSERT INTO accounts (id, github_id, github_login, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(github_id) DO UPDATE SET github_login=excluded.github_login`,
      )
      .bind(accountId, githubId, identity.login, now),
  ]
  if (previousSessionDigest)
    statements.push(
      database
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(previousSessionDigest),
    )
  statements.push(
    database
      .prepare(
        'INSERT INTO sessions (id, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(sessionDigest, accountId, expiresAt, now),
  )
  await database.batch(statements)
}

export async function findGitHubSession(
  database: D1Database,
  sessionId: string,
  now: string,
): Promise<GitHubSession | null> {
  const sessionDigest = await digestSessionId(sessionId)
  const result = await database
    .prepare(
      `SELECT a.id AS account_id, a.github_id, a.github_login, s.expires_at
       FROM sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.id = ? LIMIT 1`,
    )
    .bind(sessionDigest)
    .all<{
      account_id: string
      github_id: string
      github_login: string
      expires_at: string
    }>()
  const session = result.results[0]
  if (!session || session.expires_at <= now) return null
  return {
    accountId: session.account_id,
    githubId: session.github_id,
    name: session.github_login,
  }
}

export async function revokeGitHubSession(
  database: D1Database,
  sessionId: string,
): Promise<void> {
  const sessionDigest = await digestSessionId(sessionId)
  await database
    .prepare('DELETE FROM sessions WHERE id = ?')
    .bind(sessionDigest)
    .run()
}
