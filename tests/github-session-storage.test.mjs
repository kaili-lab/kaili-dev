import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  createGitHubSession,
  findGitHubSession,
  revokeGitHubSession,
} from '../src/features/github-auth.server.ts'

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

class FakeStatement {
  constructor(database, sql) {
    this.database = database
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async all() {
    if (!this.sql.includes('FROM sessions s JOIN accounts'))
      throw new Error(`Unexpected query: ${this.sql}`)
    const session = this.database.sessions.get(this.values[0])
    const account = session && this.database.accounts.get(session.accountId)
    return {
      results:
        session && account
          ? [
              {
                account_id: account.id,
                github_id: account.githubId,
                github_login: account.githubLogin,
                expires_at: session.expiresAt,
              },
            ]
          : [],
    }
  }

  async run() {
    if (!this.sql.startsWith('DELETE FROM sessions'))
      throw new Error(`Unexpected statement: ${this.sql}`)
    this.database.sessions.delete(this.values[0])
    return { success: true }
  }
}

class FakeDatabase {
  accounts = new Map()
  sessions = new Map()

  prepare(sql) {
    return new FakeStatement(this, sql)
  }

  async batch(statements) {
    for (const statement of statements) {
      if (statement.sql.startsWith('INSERT INTO accounts')) {
        const [id, githubId, githubLogin] = statement.values
        this.accounts.set(id, { id, githubId, githubLogin })
      } else if (statement.sql.startsWith('DELETE FROM sessions')) {
        this.sessions.delete(statement.values[0])
      } else if (statement.sql.startsWith('INSERT INTO sessions')) {
        const [id, accountId, expiresAt] = statement.values
        this.sessions.set(id, { accountId, expiresAt })
      } else {
        throw new Error(`Unexpected statement: ${statement.sql}`)
      }
    }
    return []
  }
}

describe('GitHub session storage', () => {
  it('stores and queries only SHA-256 digests of browser session IDs', async () => {
    const database = new FakeDatabase()
    const identity = { id: 123, login: 'kai' }
    const now = '2026-10-26T00:00:00.000Z'
    const expiresAt = '2026-10-27T00:00:00.000Z'
    const previousSessionId = 'previous-browser-secret'
    const sessionId = 'current-browser-secret'

    await createGitHubSession(
      database,
      identity,
      now,
      expiresAt,
      previousSessionId,
    )
    await createGitHubSession(
      database,
      identity,
      now,
      expiresAt,
      sessionId,
      previousSessionId,
    )

    expect([...database.sessions.keys()]).toEqual([digest(sessionId)])
    expect(database.sessions.has(sessionId)).toBe(false)
    expect(database.sessions.has(previousSessionId)).toBe(false)
    expect(await findGitHubSession(database, sessionId, now)).toEqual({
      accountId: 'github:123',
      githubId: '123',
      name: 'kai',
    })

    const stolenDatabaseValue = digest(sessionId)
    expect(
      await findGitHubSession(database, stolenDatabaseValue, now),
    ).toBeNull()

    await revokeGitHubSession(database, sessionId)
    expect(database.sessions.size).toBe(0)
  })
})
