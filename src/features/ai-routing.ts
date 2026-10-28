export type DataClass = 'public' | 'draft' | 'idea' | 'resource' | 'image'
export type Capability = 'chat' | 'image' | 'embedding'
export type FailureKind =
  | 'timeout'
  | 'network'
  | 'redirect'
  | 'rate-limited'
  | 'server-error'
  | 'auth-failed'
  | 'model-missing'
  | 'bad-request'
  | 'bad-format'
  | 'config'
  | 'no-eligible-connection'
  | 'deadline'

export type ConnectionSummary = {
  id: string
  name: string
  baseURL: string
  keyMask: string
  enabled: boolean
  dataClasses: DataClass[]
  lastCheckedAt: string | null
  lastOk: boolean | null
  lastFailure: FailureKind | null
}

export type ModelSummary = {
  id: string
  connectionId: string
  providerModelId: string
  capability: Capability
  enabled: boolean
  source: 'discovered' | 'manual'
  sortOrder: number
}

export type ConnectionValidationError =
  'name-required' | 'base-url-invalid' | 'data-classes-invalid'

export type ConnectionInput = {
  name: string
  baseURL: string
  dataClasses: DataClass[]
}

export type ModelRequest = {
  capability: Capability
  dataClasses: DataClass[]
  modelId?: string
}

export type ModelCandidate = {
  connection: ConnectionSummary
  model: ModelSummary
}

export type SelectCandidatesResult =
  | { ok: true; candidates: ModelCandidate[] }
  | { ok: false; kind: 'config' | 'no-eligible-connection' }

const DATA_CLASSES: DataClass[] = [
  'public',
  'draft',
  'idea',
  'resource',
  'image',
]

export const FAILURE_TEXT: Record<FailureKind, string> = {
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
  'no-eligible-connection':
    '没有可用的模型：确认调用顺序里有已启用的模型，且所属平台允许发送这类内容',
  deadline: '超过总等待时间',
}

export function guessCapability(providerModelId: string): Capability {
  const id = providerModelId.toLowerCase()
  if (id.includes('embed')) return 'embedding'
  if (id.includes('image') || id.includes('dall-e') || id.includes('imagen'))
    return 'image'
  return 'chat'
}

export function validateConnectionInput({
  name,
  baseURL,
  dataClasses,
}: ConnectionInput): ConnectionValidationError[] {
  const errors: ConnectionValidationError[] = []

  if (name.trim() === '') errors.push('name-required')

  try {
    const url = new URL(baseURL)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      baseURL.includes('?') ||
      baseURL.includes('#')
    ) {
      errors.push('base-url-invalid')
    }
  } catch {
    errors.push('base-url-invalid')
  }

  if (
    dataClasses.length === 0 ||
    dataClasses.some((dataClass) => !DATA_CLASSES.includes(dataClass))
  ) {
    errors.push('data-classes-invalid')
  }

  return errors
}

export function normalizeBaseURL(url: string): string {
  return url.replace(/\/+$/, '')
}

export function selectCandidates({
  connections,
  models,
  request,
}: {
  connections: ConnectionSummary[]
  models: ModelSummary[]
  request: ModelRequest
}): SelectCandidatesResult {
  if (request.modelId !== undefined) {
    const model = models.find(({ id }) => id === request.modelId)
    const connection = model
      ? connections.find(({ id }) => id === model.connectionId)
      : undefined
    if (
      connection?.enabled &&
      request.dataClasses.every((dataClass) =>
        connection.dataClasses.includes(dataClass),
      ) &&
      model?.enabled &&
      model.capability === request.capability
    ) {
      return { ok: true, candidates: [{ connection, model }] }
    }
    return { ok: false, kind: 'config' }
  }

  const connectionsById = new Map<string, ConnectionSummary>()
  for (const connection of connections) {
    connectionsById.set(connection.id, connection)
  }
  const candidates: ModelCandidate[] = []

  for (const model of models) {
    const connection = connectionsById.get(model.connectionId)
    if (
      connection?.enabled &&
      request.dataClasses.every((dataClass) =>
        connection.dataClasses.includes(dataClass),
      ) &&
      model.enabled &&
      model.capability === request.capability
    ) {
      candidates.push({ connection, model })
    }
  }

  candidates.sort((left, right) => {
    const orderDifference = left.model.sortOrder - right.model.sortOrder
    if (orderDifference !== 0) return orderDifference
    if (left.model.id === right.model.id) return 0
    return left.model.id < right.model.id ? -1 : 1
  })

  return candidates.length > 0
    ? { ok: true, candidates }
    : { ok: false, kind: 'no-eligible-connection' }
}

export function classifyFailure(
  input: { status: number } | { error: 'timeout' | 'network' },
): FailureKind {
  if ('error' in input) return input.error

  const { status } = input
  if (status === 0 || (status >= 300 && status < 400)) return 'redirect'
  if (status === 401 || status === 403) return 'auth-failed'
  if (status === 404) return 'model-missing'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'server-error'
  return 'bad-request'
}

export function skipsConnection(kind: FailureKind): boolean {
  switch (kind) {
    case 'timeout':
    case 'network':
    case 'redirect':
    case 'rate-limited':
    case 'server-error':
    case 'auth-failed':
      return true
    default:
      return false
  }
}

export function canTryNext(kind: FailureKind): boolean {
  switch (kind) {
    case 'timeout':
    case 'network':
    case 'redirect':
    case 'rate-limited':
    case 'server-error':
    case 'auth-failed':
    case 'model-missing':
      return true
    default:
      return false
  }
}
