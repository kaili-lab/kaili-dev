import { Buffer } from 'node:buffer'
import { setTimeout as delay } from 'node:timers/promises'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'
import { invokeChat } from '../src/features/ai-invoke.server.ts'
import { encryptSecret, maskSecret } from '../src/features/ai-secrets.ts'
import {
  createConnection,
  createModel,
  listConnections,
  listRecentAiCalls,
} from '../src/server/data/ai.ts'

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
  '0008_ai_connections.sql',
  '0009_ai_model_order.sql',
]
const masterKey = Buffer.from('a'.repeat(32)).toString('base64')
const apiKey = 'sk-test-0000'
const now = '2026-10-27T00:00:00.000Z'

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
        async all() {
          return { results: database.prepare(sql).all() }
        },
        async run() {
          const result = database.prepare(sql).run()
          return { meta: { changes: Number(result.changes) } }
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

function databaseFixture() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  for (const name of migrations) sqlite.exec(migration(name))
  return { sqlite, database: d1(sqlite) }
}

async function addConnection(database, overrides = {}) {
  const connection = {
    id: 'connection-main',
    name: 'Main',
    baseURL: 'https://main.test/v1',
    enabled: true,
    dataClasses: ['draft'],
    ...overrides,
  }
  const encrypted = await encryptSecret(apiKey, masterKey)
  await createConnection(database, {
    ...connection,
    secret: { ...encrypted, keyMask: maskSecret(apiKey) },
    createdAt: now,
    updatedAt: now,
  })
  return connection
}

async function addModel(database, overrides = {}) {
  const model = {
    id: 'model-main',
    connectionId: 'connection-main',
    providerModelId: 'provider-main',
    capabilities: ['chat'],
    enabled: true,
    source: 'manual',
    createdAt: now,
    ...overrides,
  }
  await createModel(database, model)
  return model
}

function input(database, overrides = {}) {
  return {
    database,
    masterKeyB64: masterKey,
    purpose: 'test-chat',
    capability: 'chat',
    dataClasses: ['draft'],
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 100,
    deadlineMs: 1_000,
    ...overrides,
  }
}

function successResponse(text = 'done') {
  return globalThis.Response.json({
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 9, completion_tokens: 4 },
  })
}

async function addPrimaryAndBackup(database) {
  await addConnection(database)
  await addModel(database)
  await addConnection(database, {
    id: 'connection-backup',
    name: 'Backup',
    baseURL: 'https://backup.test/v1',
  })
  await addModel(database, {
    id: 'model-backup',
    connectionId: 'connection-backup',
    providerModelId: 'provider-backup',
  })
}

describe('T8.3 AI invocation routing', () => {
  it('falls back after a retryable failure and writes one call record', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addPrimaryAndBackup(database)
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('main.test')
          ? globalThis.Response.json({ error: 'down' }, { status: 503 })
          : successResponse('from backup'),
      )

      await expect(invokeChat(input(database, { fetchImpl }))).resolves.toEqual(
        {
          ok: true,
          text: 'from backup',
          connectionName: 'Backup',
          providerModelId: 'provider-backup',
        },
      )
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          purpose: 'test-chat',
          connectionName: 'Backup',
          providerModelId: 'provider-backup',
          outcome: 'ok',
          fellBack: true,
          inputTokens: 9,
          outputTokens: 4,
        }),
      ])
      expect(await listConnections(database)).toEqual([
        expect.objectContaining({
          name: 'Backup',
          lastOk: true,
          lastFailure: null,
        }),
        expect.objectContaining({
          name: 'Main',
          lastOk: false,
          lastFailure: 'server-error',
        }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('skips the rest of a platform after a platform-level failure', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database)
      await addModel(database, {
        id: 'model-main-2',
        providerModelId: 'provider-main-2',
      })
      await addConnection(database, {
        id: 'connection-backup',
        name: 'Backup',
        baseURL: 'https://backup.test/v1',
      })
      await addModel(database, {
        id: 'model-backup',
        connectionId: 'connection-backup',
        providerModelId: 'provider-backup',
      })
      const fetchImpl = vi.fn(async (url) =>
        String(url).includes('main.test')
          ? globalThis.Response.json({ error: 'down' }, { status: 503 })
          : successResponse('from backup'),
      )

      await expect(invokeChat(input(database, { fetchImpl }))).resolves.toEqual(
        {
          ok: true,
          text: 'from backup',
          connectionName: 'Backup',
          providerModelId: 'provider-backup',
        },
      )
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({ outcome: 'ok', fellBack: true }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('tries the next model on the same platform after model-missing', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database)
      await addModel(database, {
        id: 'model-main-2',
        providerModelId: 'provider-main-2',
      })
      const fetchImpl = vi.fn(async (_url, init) =>
        JSON.parse(String(init?.body)).model === 'provider-main'
          ? globalThis.Response.json({ error: 'gone' }, { status: 404 })
          : successResponse('second model'),
      )

      await expect(invokeChat(input(database, { fetchImpl }))).resolves.toEqual(
        {
          ok: true,
          text: 'second model',
          connectionName: 'Main',
          providerModelId: 'provider-main-2',
        },
      )
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({ outcome: 'ok', fellBack: true }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('does not fall back after a non-retryable bad request', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addPrimaryAndBackup(database)
      const fetchImpl = vi.fn(async () =>
        globalThis.Response.json({ error: 'bad' }, { status: 400 }),
      )

      await expect(invokeChat(input(database, { fetchImpl }))).resolves.toEqual(
        {
          ok: false,
          kind: 'bad-request',
        },
      )
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          connectionName: 'Main',
          outcome: 'bad-request',
          fellBack: false,
        }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('returns the last retryable failure after all candidates fail', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addPrimaryAndBackup(database)
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(globalThis.Response.json({}, { status: 503 }))
        .mockResolvedValueOnce(globalThis.Response.json({}, { status: 401 }))

      await expect(invokeChat(input(database, { fetchImpl }))).resolves.toEqual(
        {
          ok: false,
          kind: 'auth-failed',
        },
      )
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          connectionName: 'Backup',
          outcome: 'auth-failed',
          fellBack: true,
        }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('rejects an ineligible explicit model without calling fetch', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database, { enabled: false })
      const fetchImpl = vi.fn()

      await expect(
        invokeChat(
          input(database, {
            modelId: 'model-main',
            fetchImpl,
          }),
        ),
      ).resolves.toEqual({ ok: false, kind: 'config' })
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          connectionName: null,
          providerModelId: null,
          outcome: 'config',
        }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('enforces the total deadline even when the injected fetch ignores its signal', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database)
      const fetchImpl = vi.fn(async () => {
        await delay(50)
        return successResponse('too late')
      })

      await expect(
        invokeChat(input(database, { deadlineMs: 10, fetchImpl })),
      ).resolves.toEqual({ ok: false, kind: 'deadline' })
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({ outcome: 'deadline', fellBack: false }),
      ])
      expect(await listConnections(database)).toEqual([
        expect.objectContaining({ lastOk: false, lastFailure: 'timeout' }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('returns config for an invalid master key without calling fetch', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database)
      const fetchImpl = vi.fn()

      await expect(
        invokeChat(input(database, { masterKeyB64: '', fetchImpl })),
      ).resolves.toEqual({ ok: false, kind: 'config' })
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          connectionName: 'Main',
          providerModelId: 'provider-main',
          outcome: 'config',
        }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('returns config when a different master key cannot decrypt the secret', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await addConnection(database)
      await addModel(database)
      const fetchImpl = vi.fn()
      const otherKey = Buffer.alloc(32, 7).toString('base64')

      await expect(
        invokeChat(input(database, { masterKeyB64: otherKey, fetchImpl })),
      ).resolves.toEqual({ ok: false, kind: 'config' })
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({ outcome: 'config' }),
      ])
    } finally {
      sqlite.close()
    }
  })

  it('records no-eligible-connection when routing finds no candidate', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await expect(invokeChat(input(database))).resolves.toEqual({
        ok: false,
        kind: 'no-eligible-connection',
      })
      expect(await listRecentAiCalls(database, 20)).toEqual([
        expect.objectContaining({
          connectionName: null,
          providerModelId: null,
          outcome: 'no-eligible-connection',
        }),
      ])
    } finally {
      sqlite.close()
    }
  })
})
