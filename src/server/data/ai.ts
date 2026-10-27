import type {
  Capability,
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
  sort_order: number
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
  'id' | 'name' | 'baseURL' | 'enabled' | 'dataClasses'
> & {
  secret?: StoredConnectionSecret
  updatedAt: string
}

export type NewModel = Omit<ModelSummary, 'sortOrder'> & { createdAt: string }

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
    sortOrder: row.sort_order,
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

const CONNECTION_COLUMNS = `id, name, base_url, key_mask, enabled,
  data_classes_json, last_checked_at, last_ok, last_failure`
const MODEL_COLUMNS = `id, connection_id, provider_model_id, capabilities_json,
  enabled, source, sort_order`
const CALL_COLUMNS = `id, created_at, purpose, connection_name, provider_model_id,
  outcome, latency_ms, fell_back, input_tokens, output_tokens`

export async function listConnections(
  database: D1Database,
): Promise<ConnectionSummary[]> {
  const result = await database
    .prepare(
      `SELECT ${CONNECTION_COLUMNS}
       FROM ai_connections ORDER BY name ASC, id ASC`,
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
       (id, name, base_url, key_iv, key_ciphertext, key_mask, enabled,
        data_classes_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      connection.id,
      connection.name,
      connection.baseURL,
      connection.secret.iv,
      connection.secret.ciphertext,
      connection.secret.keyMask,
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
    connection.enabled ? 1 : 0,
    JSON.stringify(connection.dataClasses),
    connection.updatedAt,
  ] as const
  if (connection.secret) {
    await database
      .prepare(
        `UPDATE ai_connections
         SET name = ?, base_url = ?, enabled = ?,
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
       SET name = ?, base_url = ?, enabled = ?,
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
           WHERE connection_id = ? ORDER BY sort_order ASC, id ASC`,
        )
        .bind(connectionId)
        .all<ModelRow>()
    : await database
        .prepare(
          `SELECT ${MODEL_COLUMNS} FROM ai_models
           ORDER BY sort_order ASC, id ASC`,
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
        source, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ai_models), ?)`,
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

export async function insertModels(
  database: D1Database,
  connectionId: string,
  models: readonly { providerModelId: string; capabilities: Capability[] }[],
  createdAt: string,
): Promise<void> {
  const seen = new Set<string>()
  const statements = []
  for (const { providerModelId, capabilities } of models) {
    if (seen.has(providerModelId)) continue
    seen.add(providerModelId)
    statements.push(
      database
        .prepare(
          `INSERT INTO ai_models
           (id, connection_id, provider_model_id, capabilities_json, enabled,
            source, sort_order, created_at)
           VALUES (?, ?, ?, ?, 1, 'discovered',
            (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ai_models), ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          crypto.randomUUID(),
          connectionId,
          providerModelId,
          JSON.stringify(capabilities),
          createdAt,
        ),
    )
  }
  if (statements.length > 0) await database.batch(statements)
}

/**
 * Swaps the order of two models. When their sort_order values are equal,
 * every model is first renumbered 1..n in its current order.
 */
export async function swapModelOrder(
  database: D1Database,
  firstId: string,
  secondId: string,
): Promise<void> {
  const first = await getModel(database, firstId)
  const second = await getModel(database, secondId)
  if (!first || !second) return
  if (first.sortOrder === second.sortOrder) {
    const all = await listModels(database)
    await database.batch(
      all.map((model, index) =>
        database
          .prepare('UPDATE ai_models SET sort_order = ? WHERE id = ?')
          .bind(index + 1, model.id),
      ),
    )
    return swapModelOrder(database, firstId, secondId)
  }
  await database.batch([
    database
      .prepare('UPDATE ai_models SET sort_order = ? WHERE id = ?')
      .bind(second.sortOrder, first.id),
    database
      .prepare('UPDATE ai_models SET sort_order = ? WHERE id = ?')
      .bind(first.sortOrder, second.id),
  ])
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
    database.prepare('DELETE FROM ai_models'),
    database.prepare('DELETE FROM ai_connections'),
  ])
}
