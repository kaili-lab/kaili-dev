import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  createConnection,
  createModel,
  getConnectionSecret,
  insertModels,
  listConnections,
  listModels,
  listRecentAiCalls,
  recordAiCall,
  resetAiStores,
  swapModelOrder,
  updateConnection,
  updateConnectionResult,
  updateModel,
} from '../src/server/data/ai.ts'

const migrations = [
  '0008_ai_connections.sql',
  '0009_ai_model_order.sql',
  '0010_ai_model_capability.sql',
].map((name) =>
  readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'),
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
  for (const migration of migrations) sqlite.exec(migration)
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
        enabled: false,
        dataClasses: ['public', 'draft'],
        updatedAt: '2026-10-27T01:00:00.000Z',
      })
      expect(await listConnections(database)).toEqual([
        expect.objectContaining({
          name: 'Renamed',
          baseURL: 'https://example.com/openai',
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

  it('inserts selected models with their types and does not alter an existing model', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())
      await insertModels(
        database,
        'connection-a',
        [
          { providerModelId: 'model-a', capability: 'chat' },
          { providerModelId: 'model-b', capability: 'embedding' },
          { providerModelId: 'model-a', capability: 'image' },
        ],
        '2026-10-27T00:00:00.000Z',
      )
      const first = await listModels(database, 'connection-a')
      const modelA = first.find((model) => model.providerModelId === 'model-a')
      expect(first).toHaveLength(2)
      expect(first.map((model) => model.sortOrder)).toEqual([1, 2])
      expect(first.map((model) => model.capability)).toEqual([
        'chat',
        'embedding',
      ])

      await updateModel(database, modelA.id, 'image', false)
      await insertModels(
        database,
        'connection-a',
        [
          { providerModelId: 'model-a', capability: 'chat' },
          { providerModelId: 'model-c', capability: 'chat' },
        ],
        '2026-10-27T01:00:00.000Z',
      )

      const models = await listModels(database, 'connection-a')
      expect(models).toHaveLength(3)
      expect(models.map((model) => model.sortOrder)).toEqual([1, 2, 3])
      expect(
        models.find((model) => model.providerModelId === 'model-a'),
      ).toEqual(
        expect.objectContaining({
          id: modelA.id,
          capability: 'image',
          enabled: false,
        }),
      )
    } finally {
      sqlite.close()
    }
  })

  it('assigns max sort order plus one and swaps two models', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())
      for (const id of ['model-a', 'model-b', 'model-c']) {
        await createModel(database, {
          id,
          connectionId: 'connection-a',
          providerModelId: id,
          capability: 'chat',
          enabled: true,
          source: 'manual',
          createdAt: '2026-10-27T00:00:00.000Z',
        })
      }
      const order = async () =>
        (await listModels(database)).map((model) => model.id)
      expect(await order()).toEqual(['model-a', 'model-b', 'model-c'])

      await swapModelOrder(database, 'model-a', 'model-b')
      expect(await order()).toEqual(['model-b', 'model-a', 'model-c'])

      // Equal sort orders are renumbered 1..n before swapping.
      sqlite.exec('UPDATE ai_models SET sort_order = 5')
      expect(await order()).toEqual(['model-a', 'model-b', 'model-c'])
      await swapModelOrder(database, 'model-a', 'model-b')
      expect(await order()).toEqual(['model-b', 'model-a', 'model-c'])
      expect((await listModels(database)).map((m) => m.sortOrder)).toEqual([
        1, 2, 3,
      ])
    } finally {
      sqlite.close()
    }
  })

  it('reads recent calls, updates status, and resets all stores', async () => {
    const { sqlite, database } = databaseFixture()
    try {
      await createConnection(database, connection())
      await createModel(database, {
        id: 'model-a',
        connectionId: 'connection-a',
        providerModelId: 'provider-a',
        capability: 'chat',
        enabled: true,
        source: 'manual',
        createdAt: '2026-10-27T00:00:00.000Z',
      })
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
      expect(await listRecentAiCalls(database, 20)).toEqual([])
    } finally {
      sqlite.close()
    }
  })
})
