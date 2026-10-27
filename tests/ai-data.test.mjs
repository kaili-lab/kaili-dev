import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  createConnection,
  createModel,
  getCapabilityDefaults,
  getConnectionSecret,
  insertDiscoveredModels,
  listConnections,
  listModels,
  listRecentAiCalls,
  recordAiCall,
  resetAiStores,
  setDefaultModel,
  updateConnection,
  updateConnectionResult,
  updateModel,
} from '../src/server/data/ai.ts'

const migration = readFileSync(
  new URL('../drizzle/0008_ai_connections.sql', import.meta.url),
  'utf8',
)

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

function connection(overrides = {}) {
  return {
    id: 'connection-a',
    name: 'Main',
    baseURL: 'https://example.com/v1',
    priority: 1,
    enabled: true,
    dataClasses: ['public'],
    secret: {
      iv: 'iv-base64',
      ciphertext: 'ciphertext-base64',
      keyMask: 'sk-…0000',
    },
    createdAt: '2026-10-27T00:00:00.000Z',
    updatedAt: '2026-10-27T00:00:00.000Z',
    ...overrides,
  }
}

function databaseFixture() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec(migration)
  return { sqlite, database: d1(sqlite) }
}

describe('T8.2 AI data access', () => {
  it('returns camelCase connection summaries without encrypted key fields', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())

      expect(await listConnections(database)).toEqual([
        {
          id: 'connection-a',
          name: 'Main',
          baseURL: 'https://example.com/v1',
          keyMask: 'sk-…0000',
          priority: 1,
          enabled: true,
          dataClasses: ['public'],
          lastCheckedAt: null,
          lastOk: null,
          lastFailure: null,
        },
      ])
      expect(await getConnectionSecret(database, 'connection-a')).toEqual({
        iv: 'iv-base64',
        ciphertext: 'ciphertext-base64',
      })

      await updateConnection(database, {
        id: 'connection-a',
        name: 'Renamed',
        baseURL: 'https://example.com/openai',
        priority: 2,
        enabled: false,
        dataClasses: ['public', 'draft'],
        updatedAt: '2026-10-27T01:00:00.000Z',
      })
      expect(await listConnections(database)).toEqual([
        expect.objectContaining({
          name: 'Renamed',
          baseURL: 'https://example.com/openai',
          priority: 2,
          enabled: false,
          dataClasses: ['public', 'draft'],
        }),
      ])
      expect(await getConnectionSecret(database, 'connection-a')).toEqual({
        iv: 'iv-base64',
        ciphertext: 'ciphertext-base64',
      })
    } finally {
      sqlite.close()
    }
  })

  it('does not duplicate discovered models or alter an existing model', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())
      await insertDiscoveredModels(
        database,
        'connection-a',
        ['model-a', 'model-b', 'model-a'],
        '2026-10-27T00:00:00.000Z',
      )
      const first = await listModels(database, 'connection-a')
      const modelA = first.find((model) => model.providerModelId === 'model-a')
      expect(first).toHaveLength(2)
      expect(modelA).toBeDefined()

      await updateModel(
        database,
        modelA.id,
        ['chat', 'structured-output'],
        false,
      )
      await insertDiscoveredModels(
        database,
        'connection-a',
        ['model-a', 'model-c'],
        '2026-10-27T01:00:00.000Z',
      )

      const models = await listModels(database, 'connection-a')
      expect(models).toHaveLength(3)
      expect(
        models.find((model) => model.providerModelId === 'model-a'),
      ).toEqual(
        expect.objectContaining({
          id: modelA.id,
          capabilities: ['chat', 'structured-output'],
          enabled: false,
        }),
      )
    } finally {
      sqlite.close()
    }
  })

  it('reads defaults and recent calls, updates status, and resets all stores', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())
      await createModel(database, {
        id: 'model-a',
        connectionId: 'connection-a',
        providerModelId: 'provider-a',
        capabilities: ['chat'],
        enabled: true,
        source: 'manual',
        createdAt: '2026-10-27T00:00:00.000Z',
      })
      await setDefaultModel(database, 'chat', 'model-a')
      expect(await getCapabilityDefaults(database)).toEqual({ chat: 'model-a' })

      await updateConnectionResult(
        database,
        'connection-a',
        '2026-10-27T00:01:00.000Z',
        false,
        'server-error',
      )
      expect(await listConnections(database)).toEqual([
        expect.objectContaining({
          lastCheckedAt: '2026-10-27T00:01:00.000Z',
          lastOk: false,
          lastFailure: 'server-error',
        }),
      ])

      await recordAiCall(database, {
        id: 'call-a',
        createdAt: '2026-10-27T00:02:00.000Z',
        purpose: 'slug-candidates',
        connectionName: 'Main',
        providerModelId: 'provider-a',
        outcome: 'ok',
        latencyMs: 25,
        fellBack: true,
        inputTokens: 10,
        outputTokens: 5,
      })
      expect(await listRecentAiCalls(database, 20)).toEqual([
        {
          id: 'call-a',
          createdAt: '2026-10-27T00:02:00.000Z',
          purpose: 'slug-candidates',
          connectionName: 'Main',
          providerModelId: 'provider-a',
          outcome: 'ok',
          latencyMs: 25,
          fellBack: true,
          inputTokens: 10,
          outputTokens: 5,
        },
      ])

      await resetAiStores(database)
      expect(await listConnections(database)).toEqual([])
      expect(await listModels(database)).toEqual([])
      expect(await getCapabilityDefaults(database)).toEqual({})
      expect(await listRecentAiCalls(database, 20)).toEqual([])
    } finally {
      sqlite.close()
    }
  })
})
