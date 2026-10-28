import { describe, expect, it, vi } from 'vitest'
import {
  chatCompletion,
  createEmbedding,
  generateImage,
  listModels,
} from '../src/features/ai-openai.server.ts'

const apiKey = 'sk-test-0000'
const signal = () => globalThis.AbortSignal.timeout(1_000)
const messages = [{ role: 'user', content: 'Hello' }]

function chatBody() {
  return {
    choices: [{ message: { content: 'Hello back' } }],
    usage: { prompt_tokens: 7, completion_tokens: 3 },
  }
}

async function thrown(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected promise to reject')
}

describe('T8.3 OpenAI-compatible adapter', () => {
  it('lists unique model IDs in sorted order and sends manual redirect mode', async () => {
    const fetchImpl = vi.fn(async () =>
      globalThis.Response.json({
        data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'z-model' }],
      }),
    )

    await expect(
      listModels({
        baseURL: 'https://example.com/v1',
        apiKey,
        signal: signal(),
        fetchImpl,
      }),
    ).resolves.toEqual(['a-model', 'z-model'])

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.com/v1/models')
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual' })
    expect(init.signal).toBeInstanceOf(globalThis.AbortSignal)
    expect(init.headers.Authorization).toBe(`Bearer ${apiKey}`)
  })

  it('sends the specified chat body without response_format and reads usage', async () => {
    const fetchImpl = vi.fn(async () => globalThis.Response.json(chatBody()))

    await expect(
      chatCompletion({
        baseURL: 'https://example.com/v1',
        apiKey,
        model: 'model-a',
        messages,
        maxTokens: 200,
        signal: signal(),
        fetchImpl,
      }),
    ).resolves.toEqual({ text: 'Hello back', inputTokens: 7, outputTokens: 3 })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.com/v1/chat/completions')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(init.body)).toEqual({
      model: 'model-a',
      messages,
      max_tokens: 200,
      temperature: 0.2,
    })
    expect(init.body).not.toContain('response_format')
  })

  it.each([
    [0, 'redirect'],
    [302, 'redirect'],
    [401, 'auth-failed'],
    [403, 'auth-failed'],
    [404, 'model-missing'],
    [429, 'rate-limited'],
    [503, 'server-error'],
    [400, 'bad-request'],
  ])(
    'classifies HTTP status %s as %s without leaking details',
    async (status, kind) => {
      const fetchImpl = async () => ({ status })
      const error = await thrown(
        listModels({
          baseURL: 'https://example.com/v1',
          apiKey,
          signal: signal(),
          fetchImpl,
        }),
      )

      expect(error).toEqual({ kind, message: expect.any(String) })
      expect(Object.keys(error).sort()).toEqual(['kind', 'message'])
      expect(error.message.length).toBeLessThanOrEqual(120)
      expect(JSON.stringify(error)).not.toContain(apiKey)
    },
  )

  it.each([
    [
      Object.assign(new Error(`aborted ${apiKey}`), { name: 'AbortError' }),
      'timeout',
    ],
    [new Error(`network ${apiKey}`), 'network'],
  ])(
    'classifies fetch failures as %s without leaking the thrown message',
    async (cause, kind) => {
      const error = await thrown(
        listModels({
          baseURL: 'https://example.com/v1',
          apiKey,
          signal: signal(),
          fetchImpl: async () => {
            throw cause
          },
        }),
      )

      expect(error).toEqual({ kind, message: expect.any(String) })
      expect(JSON.stringify(error)).not.toContain(apiKey)
    },
  )

  it('classifies an AbortSignal.timeout rejection (TimeoutError) as timeout', async () => {
    const error = await thrown(
      listModels({
        baseURL: 'https://example.com/v1',
        apiKey,
        signal: globalThis.AbortSignal.timeout(1),
        fetchImpl: (_input, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(init.signal.reason),
            )
          }),
      }),
    )

    expect(error).toEqual({ kind: 'timeout', message: '请求超时' })
  })

  it.each([
    [async () => new globalThis.Response(`not-json ${apiKey}`)],
    [async () => globalThis.Response.json({ data: [{ name: apiKey }] })],
  ])(
    'classifies invalid model responses as bad-format without leaking the body',
    async (fetchImpl) => {
      const error = await thrown(
        listModels({
          baseURL: 'https://example.com/v1',
          apiKey,
          signal: signal(),
          fetchImpl,
        }),
      )

      expect(error).toEqual({ kind: 'bad-format', message: '上游返回格式不对' })
      expect(JSON.stringify(error)).not.toContain(apiKey)
    },
  )

  it('rejects malformed chat content and usage as bad-format', async () => {
    for (const body of [
      { choices: [{ message: { content: 7 } }] },
      {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: '7' },
      },
    ]) {
      await expect(
        chatCompletion({
          baseURL: 'https://example.com/v1',
          apiKey,
          model: 'model-a',
          messages,
          maxTokens: 10,
          signal: signal(),
          fetchImpl: async () => globalThis.Response.json(body),
        }),
      ).rejects.toEqual({
        kind: 'bad-format',
        message: '上游返回格式不对',
      })
    }
  })

  it('uses the development-only mock for its reserved host', async () => {
    const networkFetch = vi.fn(async () => {
      throw new Error('must not use network')
    })

    await expect(
      listModels({
        baseURL: 'https://ai-mock.test/ok/v1',
        apiKey,
        signal: signal(),
        fetchImpl: networkFetch,
      }),
    ).resolves.toEqual(['mock-chat', 'mock-json'])
    await expect(
      chatCompletion({
        baseURL: 'https://ai-mock.test/ok/v1',
        apiKey,
        model: 'mock-json',
        messages,
        maxTokens: 200,
        signal: signal(),
        fetchImpl: networkFetch,
      }),
    ).resolves.toEqual({
      text: '{"slugs":["mock-first-slug","mock-second-slug","Bad Slug"]}',
      inputTokens: 12,
      outputTokens: 8,
    })
    expect(networkFetch).not.toHaveBeenCalled()
  })

  it('creates an embedding and reports its dimensions and usage', async () => {
    const fetchImpl = vi.fn(async () =>
      globalThis.Response.json({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 2 },
      }),
    )
    const base = {
      baseURL: 'https://example.com/v1',
      apiKey,
      model: 'embed-a',
      input: 'ok',
      signal: signal(),
    }

    await expect(createEmbedding({ ...base, fetchImpl })).resolves.toEqual({
      dimensions: 3,
      inputTokens: 2,
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.com/v1/embeddings')
    expect(JSON.parse(init.body)).toEqual({ model: 'embed-a', input: 'ok' })

    for (const body of [
      {},
      { data: [] },
      { data: [{ embedding: [] }] },
      { data: [{ embedding: ['a'] }] },
      { data: [{ embedding: [1] }], usage: { prompt_tokens: 'x' } },
    ]) {
      await expect(
        createEmbedding({
          ...base,
          fetchImpl: async () => globalThis.Response.json(body),
        }),
      ).rejects.toEqual({ kind: 'bad-format', message: '上游返回格式不对' })
    }
    await expect(
      createEmbedding({
        ...base,
        fetchImpl: async () =>
          globalThis.Response.json({ error: 'bad' }, { status: 400 }),
      }),
    ).rejects.toMatchObject({ kind: 'bad-request' })
  })

  it('generates an image without returning its content', async () => {
    const fetchImpl = vi.fn(async () =>
      globalThis.Response.json({ data: [{ b64_json: 'aGk=' }] }),
    )
    const base = {
      baseURL: 'https://example.com/v1',
      apiKey,
      model: 'image-a',
      prompt: 'A circle',
      signal: signal(),
    }

    await expect(generateImage({ ...base, fetchImpl })).resolves.toEqual({})
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.com/v1/images/generations')
    expect(JSON.parse(init.body)).toEqual({
      model: 'image-a',
      prompt: 'A circle',
      n: 1,
    })
    await expect(
      generateImage({
        ...base,
        fetchImpl: async () =>
          globalThis.Response.json({ data: [{ url: 'https://x.test/a.png' }] }),
      }),
    ).resolves.toEqual({})

    for (const body of [
      {},
      { data: [] },
      { data: [{}] },
      { data: [{ b64_json: '', url: '' }] },
      { data: [{ url: 3 }] },
    ]) {
      await expect(
        generateImage({
          ...base,
          fetchImpl: async () => globalThis.Response.json(body),
        }),
      ).rejects.toEqual({ kind: 'bad-format', message: '上游返回格式不对' })
    }
    await expect(
      generateImage({
        ...base,
        fetchImpl: async () =>
          globalThis.Response.json({ error: 'bad' }, { status: 400 }),
      }),
    ).rejects.toMatchObject({ kind: 'bad-request' })
  })
})
