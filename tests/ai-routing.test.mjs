import { describe, expect, it } from 'vitest'

import {
  canTryNext,
  classifyFailure,
  normalizeBaseURL,
  guessCapability,
  selectCandidates,
  skipsConnection,
  validateConnectionInput,
} from '../src/features/ai-routing.ts'

const baseConnection = {
  id: 'connection-a',
  name: 'Connection A',
  baseURL: 'https://example.com/v1',
  keyMask: 'sk-…0000',
  enabled: true,
  dataClasses: ['public', 'draft'],
  lastCheckedAt: null,
  lastOk: null,
  lastFailure: null,
}

const baseModel = {
  id: 'model-a',
  connectionId: 'connection-a',
  providerModelId: 'provider-a',
  capability: 'chat',
  enabled: true,
  source: 'manual',
  sortOrder: 1,
}

function connection(overrides = {}) {
  return { ...baseConnection, ...overrides }
}

function model(overrides = {}) {
  return { ...baseModel, ...overrides }
}

describe('D-187 capability guessing', () => {
  it.each([
    ['text-embedding-3-small', 'embedding'],
    ['BGE-Embed-large', 'embedding'],
    ['gpt-image-1', 'image'],
    ['dall-e-3', 'image'],
    ['Imagen-4', 'image'],
    ['gpt-4o', 'chat'],
    ['', 'chat'],
  ])('guesses %s as %s', (id, expected) => {
    expect(guessCapability(id)).toBe(expected)
  })
})

describe('T8.1 connection input validation', () => {
  const validInput = {
    name: 'Primary gateway',
    baseURL: 'https://example.com/openai/v1/',
    dataClasses: ['public'],
  }

  it('returns every applicable error in field order', () => {
    expect(
      validateConnectionInput({
        name: ' \t',
        baseURL: 'not a URL',
        dataClasses: [],
      }),
    ).toEqual(['name-required', 'base-url-invalid', 'data-classes-invalid'])
  })

  it.each([
    'http://example.com/v1',
    'https://user@example.com/v1',
    'https://:secret@example.com/v1',
    'https://example.com/v1?model=test',
    'https://example.com/v1?',
    'https://example.com/v1#models',
    'https://example.com/v1#',
  ])('rejects unsafe base URL %s', (baseURL) => {
    expect(validateConnectionInput({ ...validInput, baseURL })).toEqual([
      'base-url-invalid',
    ])
  })

  it('rejects unknown data classes and accepts every known class', () => {
    expect(
      validateConnectionInput({
        ...validInput,
        dataClasses: ['public', 'private'],
      }),
    ).toEqual(['data-classes-invalid'])
    expect(
      validateConnectionInput({
        ...validInput,
        name: '  Gateway  ',
        dataClasses: ['public', 'draft', 'idea', 'resource', 'image'],
      }),
    ).toEqual([])
  })

  it('accepts HTTPS paths and duplicate known data classes', () => {
    expect(
      validateConnectionInput({
        ...validInput,
        dataClasses: ['public', 'public'],
      }),
    ).toEqual([])
  })
})

describe('T8.1 base URL normalization', () => {
  it.each([
    ['https://example.com/v1///', 'https://example.com/v1'],
    ['https://example.com/v1', 'https://example.com/v1'],
    ['https://example.com/', 'https://example.com'],
    ['///', ''],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeBaseURL(input)).toBe(expected)
  })
})

describe('T8.1 candidate selection', () => {
  const ids = (selected) =>
    selected.ok && selected.candidates.map(({ model }) => model.id)

  it('returns only an explicitly requested eligible model', () => {
    const selected = selectCandidates({
      connections: [connection(), connection({ id: 'connection-b' })],
      models: [
        model(),
        model({
          id: 'model-b',
          connectionId: 'connection-b',
          providerModelId: 'provider-b',
        }),
      ],
      request: {
        capability: 'chat',
        dataClasses: ['draft'],
        modelId: 'model-b',
      },
    })

    expect(ids(selected)).toEqual(['model-b'])
  })

  it('returns config when an explicit model connection disallows draft data', () => {
    expect(
      selectCandidates({
        connections: [connection({ dataClasses: ['public'] })],
        models: [model()],
        request: {
          capability: 'chat',
          dataClasses: ['draft'],
          modelId: 'model-a',
        },
      }),
    ).toEqual({ ok: false, kind: 'config' })
  })

  it('accepts an explicit model with no data classes even on a restricted platform', () => {
    const selected = selectCandidates({
      connections: [connection({ dataClasses: ['public'] })],
      models: [model()],
      request: { capability: 'chat', dataClasses: [], modelId: 'model-a' },
    })

    expect(ids(selected)).toEqual(['model-a'])
  })

  it('orders candidates by sort order across connections', () => {
    const selected = selectCandidates({
      connections: [connection(), connection({ id: 'connection-b' })],
      models: [
        model({ id: 'model-a-1', sortOrder: 3 }),
        model({
          id: 'model-b-1',
          connectionId: 'connection-b',
          providerModelId: 'provider-b',
          sortOrder: 1,
        }),
        model({ id: 'model-a-2', providerModelId: 'other', sortOrder: 2 }),
      ],
      request: { capability: 'chat', dataClasses: ['public'] },
    })

    expect(ids(selected)).toEqual(['model-b-1', 'model-a-2', 'model-a-1'])
  })

  it('breaks equal sort order ties by model id', () => {
    const selected = selectCandidates({
      connections: [connection()],
      models: [
        model({ id: 'model-z', providerModelId: 'z' }),
        model({ id: 'model-a', providerModelId: 'a' }),
      ],
      request: { capability: 'chat', dataClasses: ['public'] },
    })

    expect(ids(selected)).toEqual(['model-a', 'model-z'])
  })

  it('excludes connections that do not allow every requested data class', () => {
    const selected = selectCandidates({
      connections: [
        connection({ id: 'public-only', dataClasses: ['public'] }),
        connection({ id: 'draft-ok' }),
      ],
      models: [
        model({ id: 'public-model', connectionId: 'public-only' }),
        model({ id: 'draft-model', connectionId: 'draft-ok', sortOrder: 2 }),
      ],
      request: { capability: 'chat', dataClasses: ['draft'] },
    })

    expect(ids(selected)).toEqual(['draft-model'])
  })

  it('does not select an image-only model for a chat request', () => {
    const selected = selectCandidates({
      connections: [connection()],
      models: [
        model({ id: 'image-model', capability: 'image' }),
        model({ id: 'chat-model', providerModelId: 'chat', sortOrder: 2 }),
      ],
      request: { capability: 'chat', dataClasses: ['draft'] },
    })

    expect(ids(selected)).toEqual(['chat-model'])
  })

  it('excludes disabled connections, disabled models, and orphaned models', () => {
    expect(
      selectCandidates({
        connections: [connection({ enabled: false })],
        models: [
          model(),
          model({ id: 'disabled-model', enabled: false }),
          model({ id: 'orphan', connectionId: 'missing-connection' }),
        ],
        request: { capability: 'chat', dataClasses: ['public'] },
      }),
    ).toEqual({ ok: false, kind: 'no-eligible-connection' })
  })
})

describe('T8.1 failure classification', () => {
  it.each([
    [{ error: 'timeout' }, 'timeout'],
    [{ error: 'network' }, 'network'],
    [{ status: 0 }, 'redirect'],
    [{ status: 302 }, 'redirect'],
    [{ status: 401 }, 'auth-failed'],
    [{ status: 403 }, 'auth-failed'],
    [{ status: 404 }, 'model-missing'],
    [{ status: 429 }, 'rate-limited'],
    [{ status: 500 }, 'server-error'],
    [{ status: 503 }, 'server-error'],
    [{ status: 400 }, 'bad-request'],
    [{ status: 422 }, 'bad-request'],
  ])('classifies %j as %s', (input, expected) => {
    expect(classifyFailure(input)).toBe(expected)
  })
})

describe('T8.1 retry decisions', () => {
  it.each([
    'timeout',
    'network',
    'redirect',
    'rate-limited',
    'server-error',
    'auth-failed',
    'model-missing',
  ])('tries the next connection after %s', (kind) => {
    expect(canTryNext(kind)).toBe(true)
  })

  it.each([
    'bad-request',
    'bad-format',
    'config',
    'no-eligible-connection',
    'deadline',
  ])('stops after %s', (kind) => {
    expect(canTryNext(kind)).toBe(false)
  })
})

describe('D-187 connection skipping', () => {
  it.each([
    'timeout',
    'network',
    'redirect',
    'rate-limited',
    'server-error',
    'auth-failed',
  ])('skips the connection after %s', (kind) => {
    expect(skipsConnection(kind)).toBe(true)
  })

  it.each([
    'model-missing',
    'bad-request',
    'bad-format',
    'config',
    'no-eligible-connection',
    'deadline',
  ])('keeps the connection after %s', (kind) => {
    expect(skipsConnection(kind)).toBe(false)
  })
})
