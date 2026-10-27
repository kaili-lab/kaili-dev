import { chatCompletion, isOpenAiError } from '#/features/ai-openai.server'
import type { ChatMessage, FetchImpl } from '#/features/ai-openai.server'
import { canTryNext, selectCandidates } from '#/features/ai-routing'
import type { Capability, DataClass, FailureKind } from '#/features/ai-routing'
import { decryptSecret } from '#/features/ai-secrets'
import {
  getCapabilityDefaults,
  getConnectionSecret,
  listConnections,
  listModels,
  recordAiCall,
  updateConnectionResult,
} from '#/server/data/ai'
import type { AiCallOutcome } from '#/server/data/ai'
import type { D1Database } from '#/server/data/db'

export type InvokeChatInput = {
  database: D1Database
  masterKeyB64: string
  fetchImpl?: FetchImpl
  purpose: string
  capability: Capability
  dataClasses: DataClass[]
  modelId?: string
  messages: ChatMessage[]
  maxTokens: number
  deadlineMs: number
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
  database,
  masterKeyB64,
  fetchImpl,
  purpose,
  capability,
  dataClasses,
  modelId,
  messages,
  maxTokens,
  deadlineMs,
}: InvokeChatInput): Promise<InvokeChatResult> {
  const startedAt = Date.now()
  const deadlineAt = startedAt + Math.max(0, deadlineMs)
  let connectionName: string | null = null
  let providerModelId: string | null = null
  let fellBack = false

  const finish = async (
    result: InvokeChatResult,
    outcome: AiCallOutcome,
    inputTokens: number | null = null,
    outputTokens: number | null = null,
  ): Promise<InvokeChatResult> => {
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

  const [connections, models, defaults] = await Promise.all([
    listConnections(database),
    listModels(database),
    getCapabilityDefaults(database),
  ])
  const selection = selectCandidates({
    connections,
    models,
    defaults,
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

  const firstConnectionId = selection.candidates[0]?.connection.id
  const decryptedKeys = new Map<string, string>()
  let lastFailure: FailureKind = 'no-eligible-connection'

  for (const { connection, model } of selection.candidates) {
    connectionName = connection.name
    providerModelId = model.providerModelId
    if (connection.id !== firstConnectionId) fellBack = true

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
    const signal = AbortSignal.timeout(Math.min(remainingMs, 10_000))

    try {
      const completion = await chatCompletion({
        baseURL: connection.baseURL,
        apiKey,
        model: model.providerModelId,
        messages,
        maxTokens,
        signal,
        fetchImpl,
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
          text: completion.text,
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
    }
  }

  return finish({ ok: false, kind: lastFailure }, lastFailure)
}
