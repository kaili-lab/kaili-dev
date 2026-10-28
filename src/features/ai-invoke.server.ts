import { chatCompletion, isOpenAiError } from '#/features/ai-openai.server'
import type { ChatMessage, FetchImpl } from '#/features/ai-openai.server'
import {
  canTryNext,
  selectCandidates,
  skipsConnection,
} from '#/features/ai-routing'
import type { Capability, DataClass, FailureKind } from '#/features/ai-routing'
import { decryptSecret } from '#/features/ai-secrets'
import {
  getConnectionSecret,
  listConnections,
  listModels,
  recordAiCall,
  updateConnectionResult,
} from '#/server/data/ai'
import type { AiCallOutcome } from '#/server/data/ai'
import type { D1Database } from '#/server/data/db'

export type InvokeModelInput<T> = {
  database: D1Database
  masterKeyB64: string
  purpose: string
  capability: Capability
  dataClasses: DataClass[]
  modelId?: string
  deadlineMs: number
  attemptTimeoutMs?: number
  run: (attempt: {
    baseURL: string
    apiKey: string
    model: string
    signal: AbortSignal
  }) => Promise<{ value: T; inputTokens?: number; outputTokens?: number }>
}

export type InvokeModelResult<T> =
  | {
      ok: true
      value: T
      connectionName: string
      providerModelId: string
    }
  | { ok: false; kind: FailureKind }

export type InvokeChatInput = Omit<
  InvokeModelInput<string>,
  'run' | 'attemptTimeoutMs'
> & {
  fetchImpl?: FetchImpl
  messages: ChatMessage[]
  maxTokens: number
}

export type InvokeChatResult =
  | {
      ok: true
      text: string
      connectionName: string
      providerModelId: string
    }
  | { ok: false; kind: FailureKind }

export async function invokeChat({
  fetchImpl,
  messages,
  maxTokens,
  ...common
}: InvokeChatInput): Promise<InvokeChatResult> {
  const result = await invokeModel({
    ...common,
    run: async (attempt) => {
      const completion = await chatCompletion({
        ...attempt,
        messages,
        maxTokens,
        fetchImpl,
      })
      return { ...completion, value: completion.text }
    },
  })
  if (!result.ok) return result
  return {
    ok: true,
    text: result.value,
    connectionName: result.connectionName,
    providerModelId: result.providerModelId,
  }
}

export async function invokeModel<T>({
  database,
  masterKeyB64,
  purpose,
  capability,
  dataClasses,
  modelId,
  deadlineMs,
  attemptTimeoutMs = 10_000,
  run,
}: InvokeModelInput<T>): Promise<InvokeModelResult<T>> {
  const startedAt = Date.now()
  const deadlineAt = startedAt + Math.max(0, deadlineMs)
  let connectionName: string | null = null
  let providerModelId: string | null = null
  let fellBack = false

  const finish = async (
    result: InvokeModelResult<T>,
    outcome: AiCallOutcome,
    inputTokens: number | null = null,
    outputTokens: number | null = null,
  ): Promise<InvokeModelResult<T>> => {
    await recordAiCall(database, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      purpose,
      connectionName,
      providerModelId,
      outcome,
      latencyMs: Math.max(0, Date.now() - startedAt),
      fellBack,
      inputTokens,
      outputTokens,
    })
    return result
  }

  const [connections, models] = await Promise.all([
    listConnections(database),
    listModels(database),
  ])
  const selection = selectCandidates({
    connections,
    models,
    request: {
      capability,
      dataClasses,
      ...(modelId === undefined ? {} : { modelId }),
    },
  })
  if (!selection.ok) {
    return finish({ ok: false, kind: selection.kind }, selection.kind)
  }
  if (Date.now() >= deadlineAt) {
    return finish({ ok: false, kind: 'deadline' }, 'deadline')
  }

  const firstCandidate = selection.candidates[0]
  const skippedConnections = new Set<string>()
  const decryptedKeys = new Map<string, string>()
  let lastFailure: FailureKind = 'no-eligible-connection'

  for (const candidate of selection.candidates) {
    const { connection, model } = candidate
    if (skippedConnections.has(connection.id)) continue
    connectionName = connection.name
    providerModelId = model.providerModelId
    if (candidate !== firstCandidate) fellBack = true

    let apiKey = decryptedKeys.get(connection.id)
    if (apiKey === undefined) {
      const secret = await getConnectionSecret(database, connection.id)
      if (!secret) {
        return finish({ ok: false, kind: 'config' }, 'config')
      }
      try {
        apiKey = await decryptSecret(secret, masterKeyB64)
      } catch {
        // AiConfigError, or a master key that did not encrypt this secret.
        return finish({ ok: false, kind: 'config' }, 'config')
      }
      decryptedKeys.set(connection.id, apiKey)
    }

    const remainingMs = deadlineAt - Date.now()
    if (remainingMs <= 0) {
      return finish({ ok: false, kind: 'deadline' }, 'deadline')
    }
    const signal = AbortSignal.timeout(Math.min(remainingMs, attemptTimeoutMs))

    try {
      const completion = await run({
        baseURL: connection.baseURL,
        apiKey,
        model: model.providerModelId,
        signal,
      })
      await updateConnectionResult(
        database,
        connection.id,
        new Date().toISOString(),
        true,
        null,
      )
      if (Date.now() >= deadlineAt) {
        return finish({ ok: false, kind: 'deadline' }, 'deadline')
      }
      return finish(
        {
          ok: true,
          value: completion.value,
          connectionName: connection.name,
          providerModelId: model.providerModelId,
        },
        'ok',
        completion.inputTokens ?? null,
        completion.outputTokens ?? null,
      )
    } catch (error) {
      if (!isOpenAiError(error)) throw error
      lastFailure = error.kind
      await updateConnectionResult(
        database,
        connection.id,
        new Date().toISOString(),
        false,
        error.kind,
      )
      if (Date.now() >= deadlineAt) {
        return finish({ ok: false, kind: 'deadline' }, 'deadline')
      }
      if (!canTryNext(error.kind)) {
        return finish({ ok: false, kind: error.kind }, error.kind)
      }
      if (skipsConnection(error.kind)) skippedConnections.add(connection.id)
    }
  }

  return finish({ ok: false, kind: lastFailure }, lastFailure)
}
