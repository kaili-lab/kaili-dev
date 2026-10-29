import { FAILURE_TEXT, classifyFailure } from '#/features/ai-routing'
import type { FailureKind } from '#/features/ai-routing'

export type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OpenAiError = {
  kind: FailureKind
  message: string
}

function openAiError(kind: FailureKind): OpenAiError {
  return { kind, message: FAILURE_TEXT[kind] }
}

export function isOpenAiError(error: unknown): error is OpenAiError {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as Partial<OpenAiError>
  return (
    typeof candidate.kind === 'string' &&
    Object.hasOwn(FAILURE_TEXT, candidate.kind) &&
    typeof candidate.message === 'string' &&
    candidate.message.length <= 120
  )
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

async function selectedFetch(
  baseURL: string,
  fetchImpl: FetchImpl,
): Promise<FetchImpl> {
  // The development-only mock must stay out of the production module graph.
  if (import.meta.env.DEV && new URL(baseURL).host === 'ai-mock.test') {
    const { mockFetch } = await import('./ai-mock.server')
    fetchImpl = mockFetch
  }
  return fetchImpl
}

async function fetchWithAbort(
  fetchImpl: FetchImpl,
  input: RequestInfo | URL,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  let removeAbortListener = () => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    const rejectAbort = () =>
      reject(new DOMException('The operation was aborted', 'AbortError'))
    if (signal.aborted) {
      rejectAbort()
      return
    }
    signal.addEventListener('abort', rejectAbort, { once: true })
    removeAbortListener = () => signal.removeEventListener('abort', rejectAbort)
  })
  try {
    return await Promise.race([fetchImpl(input, init), aborted])
  } finally {
    removeAbortListener()
  }
}

async function request({
  baseURL,
  apiKey,
  path,
  signal,
  fetchImpl = fetch,
  init,
}: {
  baseURL: string
  apiKey: string
  path: string
  signal: AbortSignal
  fetchImpl?: FetchImpl
  init: RequestInit
}): Promise<Response> {
  fetchImpl = await selectedFetch(baseURL, fetchImpl)
  let response: Response
  try {
    response = await fetchWithAbort(
      fetchImpl,
      `${baseURL}${path}`,
      {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${apiKey}`,
        },
        redirect: 'manual',
        signal,
      },
      signal,
    )
  } catch (error) {
    throw openAiError(
      classifyFailure({ error: isAbortError(error) ? 'timeout' : 'network' }),
    )
  }

  if (response.status < 200 || response.status >= 300) {
    throw openAiError(classifyFailure({ status: response.status }))
  }
  return response
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw openAiError('bad-format')
  }
}

export async function listModels({
  baseURL,
  apiKey,
  signal,
  fetchImpl,
}: {
  baseURL: string
  apiKey: string
  signal: AbortSignal
  fetchImpl?: FetchImpl
}): Promise<string[]> {
  const response = await request({
    baseURL,
    apiKey,
    path: '/models',
    signal,
    fetchImpl,
    init: { method: 'GET' },
  })
  const body = await responseJson(response)
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !Array.isArray(body.data)
  ) {
    throw openAiError('bad-format')
  }

  const ids: string[] = []
  for (const model of body.data) {
    if (
      typeof model !== 'object' ||
      model === null ||
      !('id' in model) ||
      typeof model.id !== 'string'
    ) {
      throw openAiError('bad-format')
    }
    ids.push(model.id)
  }
  return [...new Set(ids)].sort()
}

export async function chatCompletion({
  baseURL,
  apiKey,
  model,
  messages,
  maxTokens,
  signal,
  fetchImpl,
}: {
  baseURL: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  maxTokens: number
  signal: AbortSignal
  fetchImpl?: FetchImpl
}): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const response = await request({
    baseURL,
    apiKey,
    path: '/chat/completions',
    signal,
    fetchImpl,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
    },
  })
  const body = await responseJson(response)
  const choice =
    typeof body === 'object' &&
    body !== null &&
    'choices' in body &&
    Array.isArray(body.choices)
      ? body.choices[0]
      : undefined
  const message =
    typeof choice === 'object' && choice !== null && 'message' in choice
      ? choice.message
      : undefined
  if (
    typeof message !== 'object' ||
    message === null ||
    !('content' in message) ||
    typeof message.content !== 'string'
  ) {
    throw openAiError('bad-format')
  }

  const usage =
    typeof body === 'object' &&
    body !== null &&
    'usage' in body &&
    typeof body.usage === 'object' &&
    body.usage !== null
      ? body.usage
      : undefined
  const inputTokens =
    usage && 'prompt_tokens' in usage ? usage.prompt_tokens : undefined
  const outputTokens =
    usage && 'completion_tokens' in usage ? usage.completion_tokens : undefined
  if (
    (inputTokens !== undefined && typeof inputTokens !== 'number') ||
    (outputTokens !== undefined && typeof outputTokens !== 'number')
  ) {
    throw openAiError('bad-format')
  }

  return {
    text: message.content,
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  }
}

export async function createEmbedding({
  baseURL,
  apiKey,
  model,
  input,
  signal,
  fetchImpl,
}: {
  baseURL: string
  apiKey: string
  model: string
  input: string
  signal: AbortSignal
  fetchImpl?: FetchImpl
}): Promise<{ dimensions: number; inputTokens?: number }> {
  const response = await request({
    baseURL,
    apiKey,
    path: '/embeddings',
    signal,
    fetchImpl,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }),
    },
  })
  const body = await responseJson(response)
  const first =
    typeof body === 'object' &&
    body !== null &&
    'data' in body &&
    Array.isArray(body.data)
      ? body.data[0]
      : undefined
  const embedding =
    typeof first === 'object' && first !== null && 'embedding' in first
      ? first.embedding
      : undefined
  if (
    !Array.isArray(embedding) ||
    embedding.length === 0 ||
    embedding.some((value) => typeof value !== 'number')
  ) {
    throw openAiError('bad-format')
  }

  const usage =
    typeof body === 'object' &&
    body !== null &&
    'usage' in body &&
    typeof body.usage === 'object' &&
    body.usage !== null
      ? body.usage
      : undefined
  const inputTokens =
    usage && 'prompt_tokens' in usage ? usage.prompt_tokens : undefined
  if (inputTokens !== undefined && typeof inputTokens !== 'number') {
    throw openAiError('bad-format')
  }

  return {
    dimensions: embedding.length,
    ...(inputTokens === undefined ? {} : { inputTokens }),
  }
}
