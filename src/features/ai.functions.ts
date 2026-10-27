import { createServerFn } from '@tanstack/react-start'
import { takenSlugs } from '#/features/admin.functions'
import { invokeChat } from '#/features/ai-invoke.server'
import { parseSlugCandidates, slugPrompt } from '#/features/ai-slug'

import {
  isOpenAiError,
  listModels as listProviderModels,
} from '#/features/ai-openai.server'
import {
  normalizeBaseURL,
  normalizeCapabilities,
  validateConnectionInput,
  type Capability,
  type CapabilityDefaults,
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
  getCapabilityDefaults,
  getConnection,
  getConnectionSecret,
  getModel,
  insertDiscoveredModels,
  listConnections,
  listModels,
  listRecentAiCalls,
  setDefaultModel,
  updateConnection,
  updateConnectionResult,
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

function number(value: unknown, name: string): number {
  if (typeof value !== 'number') throw new Error(`Invalid ${name}`)
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
    priority: number(value.priority, 'priority'),
    enabled: boolean(value.enabled, 'enabled'),
    dataClasses: strings(value.dataClasses, 'dataClasses') as DataClass[],
  }
}

const capabilityValues: Capability[] = ['chat', 'structured-output']
function capabilities(value: unknown): Capability[] {
  const values = strings(value, 'capabilities')
  if (
    values.some(
      (capability) => !capabilityValues.includes(capability as Capability),
    )
  )
    throw new Error('Invalid capabilities')
  return values as Capability[]
}

async function masterKey(): Promise<string> {
  const { env } = await import('cloudflare:workers')
  return env.AI_MASTER_KEY ?? ''
}

export type AiOverview = {
  connections: ConnectionSummary[]
  models: ModelSummary[]
  defaults: CapabilityDefaults
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
    const [connections, models, defaults, calls] = await Promise.all([
      listConnections(database),
      listModels(database),
      getCapabilityDefaults(database),
      listRecentAiCalls(database, 20),
    ])
    return { connections, models, defaults, calls }
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
      priority: data.priority,
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
  discover: boolean,
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
    if (discover)
      await insertDiscoveredModels(database, id, modelIds, checkedAt)
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
  .validator(idRequest)
  .handler(async ({ data }) =>
    checkConnection(await runtimeDatabase(), data.id, false),
  )

export const discoverAiModels = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }) =>
    checkConnection(await runtimeDatabase(), data.id, true),
  )

export const addAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      connectionId: text(value.connectionId, 'connectionId'),
      providerModelId: text(value.providerModelId, 'providerModelId'),
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

    await createModel(database, {
      id: crypto.randomUUID(),
      connectionId: data.connectionId,
      providerModelId,
      capabilities: ['chat'],
      enabled: true,
      source: 'manual',
      createdAt: new Date().toISOString(),
    })
    return { ok: true as const }
  })

export const saveAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      id: text(value.id, 'id'),
      capabilities: capabilities(value.capabilities),
      enabled: boolean(value.enabled, 'enabled'),
    }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    if (!(await getModel(database, data.id)))
      return { ok: false as const, error: 'config' as const }
    await updateModel(
      database,
      data.id,
      normalizeCapabilities(data.capabilities),
      data.enabled,
    )
    return { ok: true as const }
  })

export const removeAiModel = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator(idRequest)
  .handler(async ({ data }) => {
    await deleteModel(await runtimeDatabase(), data.id)
    return { ok: true as const }
  })

export const saveStructuredOutputDefault = createServerFn({ method: 'POST' })
  .middleware([requireAdminFunctionSession])
  .validator((input: unknown) => {
    const value = object(input)
    return {
      modelId: value.modelId === null ? null : text(value.modelId, 'modelId'),
    }
  })
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    if (data.modelId !== null) {
      const model = await getModel(database, data.modelId)
      if (
        !model ||
        !model.enabled ||
        !model.capabilities.includes('structured-output')
      )
        return { ok: false as const, error: 'config' as const }
    }
    await setDefaultModel(database, 'structured-output', data.modelId)
    return { ok: true as const }
  })

export type AiConnectionValidationError = ConnectionValidationError

const SLUG_FAILURE_TEXT: Record<FailureKind, string> = {
  timeout: '请求超时',
  network: '网络错误',
  redirect: '上游返回重定向，已拒绝',
  'rate-limited': '上游限流',
  'server-error': '上游服务错误',
  'auth-failed': 'API key 无效或无权限',
  'model-missing': '模型不存在',
  'bad-request': '上游拒绝了请求',
  'bad-format': '上游返回格式不对',
  config: '配置错误',
  'no-eligible-connection': '没有允许发送这类内容的可用连接',
  deadline: '超过总等待时间',
}

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
      capability: 'structured-output',
      dataClasses: ['draft'],
      messages: slugPrompt({ title, summary }),
      maxTokens: 200,
      deadlineMs: 20_000,
    })
    if (!result.ok)
      return { ok: false as const, error: SLUG_FAILURE_TEXT[result.kind] }

    const slugs = parseSlugCandidates(
      result.text,
      await takenSlugs(database, data.articleId),
    )
    if (slugs.length === 0)
      return { ok: false as const, error: '没有生成可用的 slug，请手动填写' }
    return { ok: true as const, slugs }
  })
