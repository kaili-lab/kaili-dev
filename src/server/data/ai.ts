import type {
  Capability,
  CapabilityDefaults,
  ConnectionSummary,
  DataClass,
  FailureKind,
  ModelSummary,
} from '#/features/ai-routing'
import type { EncryptedSecret } from '#/features/ai-secrets'
import type { D1Database } from '#/server/data/db'

type ConnectionRow = {
  id: string
  name: string
  base_url: string
  key_mask: string
  priority: number
  enabled: number
  data_classes_json: string
  last_checked_at: string | null
  last_ok: number | null
  last_failure: FailureKind | null
}

type ConnectionSecretRow = {
  key_iv: string
  key_ciphertext: string
}

type ModelRow = {
  id: string
  connection_id: string
  provider_model_id: string
  capabilities_json: string
  enabled: number
  source: 'discovered' | 'manual'
}

type DefaultRow = {
  capability: string
  model_id: string
}

type AiCallRow = {
  id: string
  created_at: string
  purpose: string
  connection_name: string | null
  provider_model_id: string | null
  outcome: AiCallOutcome
  latency_ms: number
  fell_back: number
  input_tokens: number | null
  output_tokens: number | null
}

export type StoredConnectionSecret = EncryptedSecret & { keyMask: string }

export type NewConnection = Omit<
  ConnectionSummary,
  'keyMask' | 'lastCheckedAt' | 'lastOk' | 'lastFailure'
> & {
  secret: StoredConnectionSecret
  createdAt: string
  updatedAt: string
}

export type ConnectionUpdate = Pick<
  ConnectionSummary,
  'id' | 'name' | 'baseURL' | 'priority' | 'enabled' | 'dataClasses'
> & {
  secret?: StoredConnectionSecret
  updatedAt: string
}

export type NewModel = ModelSummary & { createdAt: string }

export type AiCallOutcome = 'ok' | FailureKind

export type AiCall = {
  id: string
  createdAt: string
  purpose: string
  connectionName: string | null
  providerModelId: string | null
  outcome: AiCallOutcome
  latencyMs: number
  fellBack: boolean
  inputTokens: number | null
  outputTokens: number | null
}

function toConnection(row: ConnectionRow): ConnectionSummary {
  return {
    id: row.id,
    name: row.name,
    baseURL: row.base_url,
    keyMask: row.key_mask,
    priority: row.priority,
    enabled: row.enabled === 1,
    dataClasses: JSON.parse(row.data_classes_json) as DataClass[],
    lastCheckedAt: row.last_checked_at,
    lastOk: row.last_ok === null ? null : row.last_ok === 1,
    lastFailure: row.last_failure,
  }
}

function toModel(row: ModelRow): ModelSummary {
  return {
    id: row.id,
    connectionId: row.connection_id,
    providerModelId: row.provider_model_id,
    capabilities: JSON.parse(row.capabilities_json) as Capability[],
    enabled: row.enabled === 1,
    source: row.source,
  }
}

function toAiCall(row: AiCallRow): AiCall {
  return {
    id: row.id,
    createdAt: row.created_at,
    purpose: row.purpose,
    connectionName: row.connection_name,
    providerModelId: row.provider_model_id,
    outcome: row.outcome,
    latencyMs: row.latency_ms,
    fellBack: row.fell_back === 1,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
  }
}

const CONNECTION_COLUMNS = `id, name, base_url, key_mask, priority, enabled,
  data_classes_json, last_checked_at, last_ok, last_failure`
const MODEL_COLUMNS = `id, connection_id, provider_model_id, capabilities_json,
  enabled, source`
const CALL_COLUMNS = `id, created_at, purpose, connection_name, provider_model_id,
  outcome, latency_ms, fell_back, input_tokens, output_tokens`

export async function listConnections(
  database: D1Database,
): Promise<ConnectionSummary[]> {
  const result = await database
    .prepare(
      `SELECT ${CONNECTION_COLUMNS}
       FROM ai_connections ORDER BY priority ASC, id ASC`,
    )
    .all<ConnectionRow>()
  return result.results.map(toConnection)
}

export async function getConnection(
  database: D1Database,
  id: string,
): Promise<ConnectionSummary | undefined> {
  const result = await database
    .prepare(
      `SELECT ${CONNECTION_COLUMNS}
       FROM ai_connections WHERE id = ?`,
    )
    .bind(id)
    .all<ConnectionRow>()
  const row = result.results[0]
  return row ? toConnection(row) : undefined
}

export async function getConnectionSecret(
  database: D1Database,
  id: string,
): Promise<EncryptedSecret | undefined> {
  const result = await database
    .prepare(`SELECT key_iv, key_ciphertext FROM ai_connections WHERE id = ?`)
    .bind(id)
    .all<ConnectionSecretRow>()
  const row = result.results[0]
  return row ? { iv: row.key_iv, ciphertext: row.key_ciphertext } : undefined
}

export async function createConnection(
  database: D1Database,
  connection: NewConnection,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO ai_connections
       (id, name, base_url, key_iv, key_ciphertext, key_mask, priority, enabled,
        data_classes_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      connection.id,
      connection.name,
      connection.baseURL,
      connection.secret.iv,
      connection.secret.ciphertext,
      connection.secret.keyMask,
      connection.priority,
      connection.enabled ? 1 : 0,
      JSON.stringify(connection.dataClasses),
      connection.createdAt,
      connection.updatedAt,
    )
    .run()
}

export async function updateConnection(
  database: D1Database,
  connection: ConnectionUpdate,
): Promise<void> {
  const common = [
    connection.name,
    connection.baseURL,
    connection.priority,
    connection.enabled ? 1 : 0,
    JSON.stringify(connection.dataClasses),
    connection.updatedAt,
  ] as const
  if (connection.secret) {
    await database
      .prepare(
        `UPDATE ai_connections
         SET name = ?, base_url = ?, priority = ?, enabled = ?,
             data_classes_json = ?, updated_at = ?, key_iv = ?,
             key_ciphertext = ?, key_mask = ?
         WHERE id = ?`,
      )
      .bind(
        ...common,
        connection.secret.iv,
        connection.secret.ciphertext,
        connection.secret.keyMask,
        connection.id,
      )
      .run()
    return
  }
  await database
    .prepare(
      `UPDATE ai_connections
       SET name = ?, base_url = ?, priority = ?, enabled = ?,
           data_classes_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(...common, connection.id)
    .run()
}

export async function deleteConnection(
  database: D1Database,
  id: string,
): Promise<void> {
  await database
    .prepare('DELETE FROM ai_connections WHERE id = ?')
    .bind(id)
    .run()
}

export async function listModels(
  database: D1Database,
  connectionId?: string,
): Promise<ModelSummary[]> {
  const result = connectionId
    ? await database
        .prepare(
          `SELECT ${MODEL_COLUMNS} FROM ai_models
           WHERE connection_id = ? ORDER BY provider_model_id ASC, id ASC`,
        )
        .bind(connectionId)
        .all<ModelRow>()
    : await database
        .prepare(
          `SELECT ${MODEL_COLUMNS} FROM ai_models
           ORDER BY connection_id ASC, provider_model_id ASC, id ASC`,
        )
        .all<ModelRow>()
  return result.results.map(toModel)
}

export async function getModel(
  database: D1Database,
  id: string,
): Promise<ModelSummary | undefined> {
  const result = await database
    .prepare(`SELECT ${MODEL_COLUMNS} FROM ai_models WHERE id = ?`)
    .bind(id)
    .all<ModelRow>()
  const row = result.results[0]
  return row ? toModel(row) : undefined
}

export async function createModel(
  database: D1Database,
  model: NewModel,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO ai_models
       (id, connection_id, provider_model_id, capabilities_json, enabled,
        source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      model.id,
      model.connectionId,
      model.providerModelId,
      JSON.stringify(model.capabilities),
      model.enabled ? 1 : 0,
      model.source,
      model.createdAt,
    )
    .run()
}

export async function updateModel(
  database: D1Database,
  id: string,
  capabilities: Capability[],
  enabled: boolean,
): Promise<void> {
  await database
    .prepare(
      `UPDATE ai_models SET capabilities_json = ?, enabled = ? WHERE id = ?`,
    )
    .bind(JSON.stringify(capabilities), enabled ? 1 : 0, id)
    .run()
}

export async function deleteModel(
  database: D1Database,
  id: string,
): Promise<void> {
  await database.prepare('DELETE FROM ai_models WHERE id = ?').bind(id).run()
}

export async function insertDiscoveredModels(
  database: D1Database,
  connectionId: string,
  providerModelIds: readonly string[],
  createdAt: string,
): Promise<void> {
  const uniqueIds = new Set(providerModelIds)
  if (uniqueIds.size === 0) return
  const statements = []
  for (const providerModelId of uniqueIds) {
    statements.push(
      database
        .prepare(
          `INSERT INTO ai_models
           (id, connection_id, provider_model_id, capabilities_json, enabled,
            source, created_at)
           VALUES (?, ?, ?, '["chat"]', 1, 'discovered', ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(crypto.randomUUID(), connectionId, providerModelId, createdAt),
    )
  }
  await database.batch(statements)
}

export async function getCapabilityDefaults(
  database: D1Database,
): Promise<CapabilityDefaults> {
  const result = await database
    .prepare('SELECT capability, model_id FROM ai_defaults')
    .all<DefaultRow>()
  const defaults: CapabilityDefaults = {}
  for (const row of result.results as DefaultRow[]) {
    if (row.capability === 'chat' || row.capability === 'structured-output')
      defaults[row.capability] = row.model_id
  }
  return defaults
}

export async function setDefaultModel(
  database: D1Database,
  capability: Capability,
  modelId: string | null,
): Promise<void> {
  if (modelId === null) {
    await database
      .prepare('DELETE FROM ai_defaults WHERE capability = ?')
      .bind(capability)
      .run()
    return
  }
  await database
    .prepare(
      `INSERT INTO ai_defaults (capability, model_id) VALUES (?, ?)
       ON CONFLICT(capability) DO UPDATE SET model_id = excluded.model_id`,
    )
    .bind(capability, modelId)
    .run()
}

export async function recordAiCall(
  database: D1Database,
  call: AiCall,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO ai_calls
       (id, created_at, purpose, connection_name, provider_model_id, outcome,
        latency_ms, fell_back, input_tokens, output_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      call.id,
      call.createdAt,
      call.purpose,
      call.connectionName,
      call.providerModelId,
      call.outcome,
      call.latencyMs,
      call.fellBack ? 1 : 0,
      call.inputTokens,
      call.outputTokens,
    )
    .run()
}

export async function listRecentAiCalls(
  database: D1Database,
  limit: number,
): Promise<AiCall[]> {
  const result = await database
    .prepare(
      `SELECT ${CALL_COLUMNS} FROM ai_calls
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(Math.max(0, Math.trunc(limit)))
    .all<AiCallRow>()
  return result.results.map(toAiCall)
}

export async function updateConnectionResult(
  database: D1Database,
  id: string,
  checkedAt: string,
  ok: boolean,
  failure: FailureKind | null,
): Promise<void> {
  await database
    .prepare(
      `UPDATE ai_connections
       SET last_checked_at = ?, last_ok = ?, last_failure = ? WHERE id = ?`,
    )
    .bind(checkedAt, ok ? 1 : 0, failure, id)
    .run()
}

/** Local/test reset only; production never calls this helper. */
export async function resetAiStores(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare('DELETE FROM ai_calls'),
    database.prepare('DELETE FROM ai_defaults'),
    database.prepare('DELETE FROM ai_models'),
    database.prepare('DELETE FROM ai_connections'),
  ])
}
