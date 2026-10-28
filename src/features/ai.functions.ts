import { createServerFn } from '@tanstack/react-start'
import { takenSlugs } from '#/features/admin.functions'
import { invokeChat, invokeModel } from '#/features/ai-invoke.server'
import { parseSlugCandidates, slugPrompt } from '#/features/ai-slug'

import {
  createEmbedding,
  generateImage,
  isOpenAiError,
  listModels as listProviderModels,
} from '#/features/ai-openai.server'
import {
  normalizeBaseURL,
  FAILURE_TEXT,
  validateConnectionInput,
  type Capability,
  type ConnectionSummary,
  type ConnectionValidationError,
  type DataClass,
  type FailureKind,
  type ModelSummary,
} from '#/features/ai-routing'
import {
  AiConfigError,
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '#/features/ai-secrets'
import { requireAdminFunctionSession } from '#/lib/require-admin-session'
import {
  createConnection,
  createModel,
  deleteConnection,
  deleteModel,
  getConnection,
  getConnectionSecret,
  getModel,
  insertModels,
  listConnections,
  listModels,
  listRecentAiCalls,
  updateConnection,
  updateConnectionResult,
  swapModelOrder,
  updateModel,
  type AiCall,
} from '#/server/data/ai'
import { getStoredArticle } from '#/server/data/articles'
import { runtimeDatabase, type D1Database } from '#/server/data/db'

function object(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null)
    throw new Error('Invalid request')
  return input as Record<string, unknown>
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${name}`)
  return value
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${name}`)
  return value
}

function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new Error(`Invalid ${name}`)
  return value
}

function idRequest(input: unknown): { id: string } {
  return { id: text(object(input).id, 'id') }
}

function connectionRequest(input: unknown) {
  const value = object(input)
  return {
    id: value.id === null ? null : text(value.id, 'id'),
    name: text(value.name, 'name'),
    baseURL: text(value.baseURL, 'baseURL'),
    key: text(value.key, 'key'),
    enabled: boolean(value.enabled, 'enabled'),
    dataClasses: strings(value.dataClasses, 'dataClasses') as DataClass[],
  }
}

const capabilityValues: Capability[] = ['chat', 'image', 'embedding']
function capability(value: unknown): Capability {
  const name = text(value, 'capability')
  if (!capabilityValues.includes(name as Capability))
    throw new Error('Invalid capability')
  return name as Capability
}

async function masterKey(): Promise<string> {
  const { env } = await import('cloudflare:workers')
  return env.AI_MASTER_KEY ?? ''
}

export type AiOverview = {
  connections: ConnectionSummary[]
  models: ModelSummary[]
  calls: AiCall[]
}

export type AiConnectionView = {
  connection: ConnectionSummary
  models: ModelSummary[]
}

export const loadAiOverview = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .handler(async (): Promise<AiOverview> => {
    const database = await runtimeDatabase()
    const [connections, models, calls] = await Promise.all([
      listConnections(database),
      listModels(database),
      listRecentAiCalls(database, 20),
    ])
    return { connections, models, calls }
  })

export const loadAiConnection = createServerFn({ method: 'GET' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }): Promise<AiConnectionView | null> => {
    const database = await runtimeDatabase()
    const connection = await getConnection(database, data.id)
    if (!connection) return null
    return {
      connection,
      models: await listModels(database, connection.id),
    }
  })

export const saveAiConnection = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(connectionRequest)
  .handler(async ({ data }) => {
    const errors = validateConnectionInput(data)
    if (errors.length > 0)
      return {
        ok: false as const,
        error: 'validation' as const,
        errors,
      }

    const database = await runtimeDatabase()
    if (data.id !== null && !(await getConnection(database, data.id)))
      return { ok: false as const, error: 'config' as const }

    const key = data.key.trim()
    if (data.id === null && key === '')
      return { ok: false as const, error: 'key-required' as const }

    let secret: { iv: string; ciphertext: string; keyMask: string } | undefined
    if (key !== '') {
      try {
        secret = {
          ...(await encryptSecret(key, await masterKey())),
          keyMask: maskSecret(key),
        }
      } catch (error) {
        if (error instanceof AiConfigError)
          return { ok: false as const, error: 'master-key' as const }
        throw error
      }
    }

    const now = new Date().toISOString()
    const common = {
      name: data.name.trim(),
      baseURL: normalizeBaseURL(data.baseURL.trim()),
      enabled: data.enabled,
      dataClasses: data.dataClasses,
    }

    if (data.id === null) {
      const id = crypto.randomUUID()
      if (!secret) return { ok: false as const, error: 'key-required' as const }
      await createConnection(database, {
        id,
        ...common,
        secret,
        createdAt: now,
        updatedAt: now,
      })
      return { ok: true as const, id }
    }

    await updateConnection(database, {
      id: data.id,
      ...common,
      secret,
      updatedAt: now,
    })
    return { ok: true as const, id: data.id }
  })

export const removeAiConnection = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }) => {
    await deleteConnection(await runtimeDatabase(), data.id)
    return { ok: true as const }
  })

type CheckResult =
  | { ok: true; modelIds: string[] }
  | { ok: false; error: FailureKind | 'master-key' }

async function checkConnection(
  database: D1Database,
  id: string,
): Promise<CheckResult> {
  const [connection, secret] = await Promise.all([
    getConnection(database, id),
    getConnectionSecret(database, id),
  ])
  if (!connection || !secret) return { ok: false, error: 'config' }

  let apiKey: string
  try {
    apiKey = await decryptSecret(secret, await masterKey())
  } catch (error) {
    if (error instanceof AiConfigError)
      return { ok: false, error: 'master-key' }
    return { ok: false, error: 'config' }
  }

  const checkedAt = new Date().toISOString()
  try {
    const modelIds = await listProviderModels({
      baseURL: connection.baseURL,
      apiKey,
      signal: AbortSignal.timeout(10_000),
    })
    await updateConnectionResult(database, id, checkedAt, true, null)
    return { ok: true, modelIds }
  } catch (error) {
    const failure = isOpenAiError(error) ? error.kind : 'network'
    await updateConnectionResult(database, id, checkedAt, false, failure)
    return { ok: false, error: failure }
  }
}

export const testAiConnection = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      id: value.id === null ? null : text(value.id, 'id'),
      baseURL: text(value.baseURL, 'baseURL'),
      key: text(value.key, 'key'),
    }
  })
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; modelIds: string[] }
      | { ok: false; error: FailureKind | 'master-key' | 'key-required' }
      | { ok: false; error: 'base-url-invalid' }
    > => {
      const baseURL = data.baseURL.trim()
      const invalid = validateConnectionInput({
        name: 'x',
        baseURL,
        dataClasses: ['public'],
      }).includes('base-url-invalid')
      if (invalid) return { ok: false, error: 'base-url-invalid' }
      const normalized = normalizeBaseURL(baseURL)

      const database = await runtimeDatabase()
      let apiKey = data.key.trim()
      let usedSaved = false
      if (apiKey === '') {
        if (data.id === null) return { ok: false, error: 'key-required' }
        const secret = await getConnectionSecret(database, data.id)
        if (!secret) return { ok: false, error: 'config' }
        try {
          apiKey = await decryptSecret(secret, await masterKey())
        } catch (error) {
          if (error instanceof AiConfigError)
            return { ok: false, error: 'master-key' }
          return { ok: false, error: 'config' }
        }
        usedSaved = true
      }

      const saved =
        usedSaved && data.id !== null
          ? await getConnection(database, data.id)
          : null
      const record = saved?.baseURL === normalized
      const checkedAt = new Date().toISOString()
      try {
        const modelIds = await listProviderModels({
          baseURL: normalized,
          apiKey,
          signal: AbortSignal.timeout(10_000),
        })
        if (record && data.id !== null)
          await updateConnectionResult(database, data.id, checkedAt, true, null)
        return { ok: true, modelIds }
      } catch (error) {
        const failure = isOpenAiError(error) ? error.kind : 'network'
        if (record && data.id !== null)
          await updateConnectionResult(
            database,
            data.id,
            checkedAt,
            false,
            failure,
          )
        return { ok: false, error: failure }
      }
    },
  )

export const tryAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; latencyMs: number } | { ok: false; error: string }
    > => {
      const database = await runtimeDatabase()
      const model = await getModel(database, data.id)
      if (!model) return { ok: false, error: FAILURE_TEXT.config }

      const masterKeyB64 = await masterKey()
      try {
        if (atob(masterKeyB64).length !== 32)
          return { ok: false, error: '未配置 AI_MASTER_KEY' }
      } catch {
        return { ok: false, error: '未配置 AI_MASTER_KEY' }
      }

      const startedAt = Date.now()
      const common = {
        database,
        masterKeyB64,
        purpose: 'model-test',
        dataClasses: [],
        modelId: data.id,
      }
      // Each type is checked against the endpoint it is meant for.
      const result =
        model.capability === 'embedding'
          ? await invokeModel({
              ...common,
              capability: 'embedding',
              deadlineMs: 15_000,
              run: async (attempt) => {
                const embedding = await createEmbedding({
                  ...attempt,
                  input: 'ok',
                })
                return { ...embedding, value: embedding.dimensions }
              },
            })
          : model.capability === 'image'
            ? await invokeModel({
                ...common,
                capability: 'image',
                deadlineMs: 60_000,
                attemptTimeoutMs: 60_000,
                run: async (attempt) => ({
                  value: await generateImage({
                    ...attempt,
                    prompt: 'A small red circle on a white background.',
                  }),
                }),
              })
            : await invokeChat({
                ...common,
                capability: 'chat',
                messages: [{ role: 'user', content: 'Reply with OK.' }],
                maxTokens: 20,
                deadlineMs: 15_000,
              })
      if (!result.ok) return { ok: false, error: FAILURE_TEXT[result.kind] }
      return { ok: true, latencyMs: Date.now() - startedAt }
    },
  )

export const discoverAiModels = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }) =>
    checkConnection(await runtimeDatabase(), data.id),
  )

export const addAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      connectionId: text(value.connectionId, 'connectionId'),
      providerModelId: text(value.providerModelId, 'providerModelId'),
      capability: capability(value.capability),
    }
  })
  .handler(async ({ data }) => {
    const providerModelId = data.providerModelId.trim()
    if (providerModelId === '')
      return { ok: false as const, error: 'model-required' as const }

    const database = await runtimeDatabase()
    if (!(await getConnection(database, data.connectionId)))
      return { ok: false as const, error: 'config' as const }
    if (
      (await listModels(database, data.connectionId)).some(
        (model) => model.providerModelId === providerModelId,
      )
    )
      return { ok: false as const, error: 'duplicate' as const }

    const id = crypto.randomUUID()
    await createModel(database, {
      id,
      connectionId: data.connectionId,
      providerModelId,
      capability: data.capability,
      enabled: true,
      source: 'manual',
      createdAt: new Date().toISOString(),
    })
    return { ok: true as const, id, capability: data.capability }
  })

export const saveAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      id: text(value.id, 'id'),
      capability: capability(value.capability),
      enabled: boolean(value.enabled, 'enabled'),
    }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    if (!(await getModel(database, data.id)))
      return { ok: false as const, error: 'config' as const }
    await updateModel(database, data.id, data.capability, data.enabled)
    return { ok: true as const }
  })

export const removeAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }) => {
    await deleteModel(await runtimeDatabase(), data.id)
    return { ok: true as const }
  })

export const addAiModels = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    if (!Array.isArray(value.models)) throw new Error('Invalid models')
    return {
      connectionId: text(value.connectionId, 'connectionId'),
      models: value.models.map((item: unknown) => {
        const model = object(item)
        return {
          providerModelId: text(
            model.providerModelId,
            'providerModelId',
          ).trim(),
          capability: capability(model.capability),
        }
      }),
    }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    if (!(await getConnection(database, data.connectionId)))
      return { ok: false as const, error: 'config' as const }
    const existing = new Set(
      (await listModels(database, data.connectionId)).map(
        (model) => model.providerModelId,
      ),
    )
    const added = await insertModels(
      database,
      data.connectionId,
      data.models.filter(
        (model) =>
          model.providerModelId !== '' && !existing.has(model.providerModelId),
      ),
      new Date().toISOString(),
    )
    return { ok: true as const, added }
  })

export const moveAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    const direction = text(value.direction, 'direction')
    if (direction !== 'up' && direction !== 'down')
      throw new Error('Invalid direction')
    return {
      id: text(value.id, 'id'),
      capability: capability(value.capability),
      direction,
    }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const order = (await listModels(database)).filter(
      (model) => model.enabled && model.capability === data.capability,
    )
    const index = order.findIndex((model) => model.id === data.id)
    const current = order[index]
    const neighbor = order[data.direction === 'up' ? index - 1 : index + 1]
    if (!current || !neighbor)
      return { ok: false as const, error: 'config' as const }
    await swapModelOrder(database, current.id, neighbor.id)
    return { ok: true as const }
  })

export type AiConnectionValidationError = ConnectionValidationError

export const generateSlugCandidates = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    if (value.language !== 'zh' && value.language !== 'en')
      throw new Error('Invalid language')
    return {
      articleId:
        value.articleId === null ? null : text(value.articleId, 'articleId'),
      language: value.language,
      title: text(value.title, 'title'),
      summary: text(value.summary, 'summary'),
    }
  })
  .handler(async ({ data }) => {
    const title = data.title.trim()
    const summary = data.summary.trim()
    if (!title || !summary)
      return { ok: false as const, error: '先填写标题和摘要' }

    const database = await runtimeDatabase()
    if (data.articleId !== null) {
      const stored = await getStoredArticle(database, data.articleId)
      if (!stored)
        return { ok: false as const, error: '文章已被删除，请返回文章列表' }
      if (stored.article.zh.published || stored.article.en.published)
        return { ok: false as const, error: 'slug 已锁定' }
    }

    const masterKeyB64 = await masterKey()
    try {
      if (atob(masterKeyB64).length !== 32)
        return { ok: false as const, error: '未配置 AI_MASTER_KEY' }
    } catch {
      return { ok: false as const, error: '未配置 AI_MASTER_KEY' }
    }

    const result = await invokeChat({
      database,
      masterKeyB64,
      purpose: 'slug-candidates',
      capability: 'chat',
      dataClasses: ['draft'],
      messages: slugPrompt({ title, summary }),
      maxTokens: 200,
      deadlineMs: 20_000,
    })
    if (!result.ok)
      return { ok: false as const, error: FAILURE_TEXT[result.kind] }

    const slugs = parseSlugCandidates(
      result.text,
      await takenSlugs(database, data.articleId),
    )
    if (slugs.length === 0)
      return { ok: false as const, error: '没有生成可用的 slug，请手动填写' }
    return { ok: true as const, slugs }
  })
