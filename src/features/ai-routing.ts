export type DataClass = 'public' | 'draft' | 'idea' | 'resource' | 'image'
export type Capability = 'chat' | 'structured-output'
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
  priority: number
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
  capabilities: Capability[]
  enabled: boolean
  source: 'discovered' | 'manual'
}

export type CapabilityDefaults = Partial<Record<Capability, string>>

export type ConnectionValidationError =
  | 'name-required'
  | 'base-url-invalid'
  | 'priority-invalid'
  | 'data-classes-invalid'

export type ConnectionInput = {
  name: string
  baseURL: string
  priority: number
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

export function normalizeCapabilities(caps: Capability[]): Capability[] {
  if (caps.includes('structured-output')) return ['chat', 'structured-output']
  return caps.includes('chat') ? ['chat'] : []
}

export function validateConnectionInput({
  name,
  baseURL,
  priority,
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

  if (!Number.isInteger(priority) || priority < 1 || priority > 99) {
    errors.push('priority-invalid')
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
  defaults,
  request,
}: {
  connections: ConnectionSummary[]
  models: ModelSummary[]
  defaults: CapabilityDefaults
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
      model.capabilities.includes(request.capability)
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
      model.capabilities.includes(request.capability)
    ) {
      candidates.push({ connection, model })
    }
  }

  candidates.sort((left, right) => {
    const priorityDifference =
      left.connection.priority - right.connection.priority
    if (priorityDifference !== 0) return priorityDifference
    if (left.connection.id !== right.connection.id) {
      return left.connection.id < right.connection.id ? -1 : 1
    }
    if (left.model.providerModelId === right.model.providerModelId) return 0
    return left.model.providerModelId < right.model.providerModelId ? -1 : 1
  })

  const defaultModelId = defaults[request.capability]
  if (defaultModelId !== undefined) {
    const defaultIndex = candidates.findIndex(
      ({ model }) => model.id === defaultModelId,
    )
    if (defaultIndex > 0) {
      candidates.unshift(...candidates.splice(defaultIndex, 1))
    }
  }

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
