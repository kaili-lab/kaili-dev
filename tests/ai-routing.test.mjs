import { describe, expect, it } from 'vitest'

import {
  canTryNext,
  classifyFailure,
  normalizeBaseURL,
  normalizeCapabilities,
  selectCandidates,
  validateConnectionInput,
} from '../src/features/ai-routing.ts'

const baseConnection = {
  id: 'connection-a',
  name: 'Connection A',
  baseURL: 'https://example.com/v1',
  keyMask: 'sk-…0000',
  priority: 1,
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
  capabilities: ['chat'],
  enabled: true,
  source: 'manual',
}

function connection(overrides = {}) {
  return { ...baseConnection, ...overrides }
}

function model(overrides = {}) {
  return { ...baseModel, ...overrides }
}

describe('T8.1 capability normalization', () => {
  it.each([
    [[], []],
    [['chat', 'chat'], ['chat']],
    [['structured-output'], ['chat', 'structured-output']],
    [
      ['structured-output', 'chat', 'structured-output'],
      ['chat', 'structured-output'],
    ],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeCapabilities(input)).toEqual(expected)
  })
})

describe('T8.1 connection input validation', () => {
  const validInput = {
    name: 'Primary gateway',
    baseURL: 'https://example.com/openai/v1/',
    priority: 1,
    dataClasses: ['public'],
  }

  it('returns every applicable error in field order', () => {
    expect(
      validateConnectionInput({
        name: ' \t',
        baseURL: 'not a URL',
        priority: 0,
        dataClasses: [],
      }),
    ).toEqual([
      'name-required',
      'base-url-invalid',
      'priority-invalid',
      'data-classes-invalid',
    ])
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

  it.each([0, 100, 1.5, Number.NaN, '1'])('rejects priority %s', (priority) => {
    expect(validateConnectionInput({ ...validInput, priority })).toEqual([
      'priority-invalid',
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
        priority: 99,
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
  it('returns only an explicitly requested eligible model', () => {
    const selected = selectCandidates({
      connections: [
        connection(),
        connection({ id: 'connection-b', priority: 2 }),
      ],
      models: [
        model(),
        model({
          id: 'model-b',
          connectionId: 'connection-b',
          providerModelId: 'provider-b',
        }),
      ],
      defaults: { chat: 'model-a' },
      request: {
        capability: 'chat',
        dataClasses: ['draft'],
        modelId: 'model-b',
      },
    })

    expect(selected.ok).toBe(true)
    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['model-b'])
  })

  it('returns config when an explicit model connection disallows draft data', () => {
    expect(
      selectCandidates({
        connections: [connection({ dataClasses: ['public'] })],
        models: [model()],
        defaults: {},
        request: {
          capability: 'chat',
          dataClasses: ['draft'],
          modelId: 'model-a',
        },
      }),
    ).toEqual({ ok: false, kind: 'config' })
  })

  it('promotes an eligible default once ahead of normal priority order', () => {
    const selected = selectCandidates({
      connections: [
        connection(),
        connection({ id: 'connection-b', priority: 2 }),
      ],
      models: [
        model(),
        model({
          id: 'model-b',
          connectionId: 'connection-b',
          providerModelId: 'provider-b',
        }),
      ],
      defaults: { chat: 'model-b' },
      request: { capability: 'chat', dataClasses: ['public'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['model-b', 'model-a'])
  })

  it('does not duplicate a default already first', () => {
    const selected = selectCandidates({
      connections: [connection()],
      models: [model()],
      defaults: { chat: 'model-a' },
      request: { capability: 'chat', dataClasses: ['public'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['model-a'])
  })

  it('skips an ineligible default model', () => {
    const selected = selectCandidates({
      connections: [connection()],
      models: [
        model(),
        model({
          id: 'disabled-default',
          providerModelId: 'disabled',
          enabled: false,
        }),
      ],
      defaults: { chat: 'disabled-default' },
      request: { capability: 'chat', dataClasses: ['public'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['model-a'])
  })

  it('sorts equal-priority connections by id and models by provider id', () => {
    const selected = selectCandidates({
      connections: [
        connection({ id: 'connection-b' }),
        connection({ id: 'connection-a' }),
      ],
      models: [
        model({
          id: 'model-b-z',
          connectionId: 'connection-b',
          providerModelId: 'z-model',
        }),
        model({
          id: 'model-a-z',
          providerModelId: 'z-model',
        }),
        model({
          id: 'model-a-a',
          providerModelId: 'a-model',
        }),
      ],
      defaults: {},
      request: { capability: 'chat', dataClasses: ['public', 'draft'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['model-a-a', 'model-a-z', 'model-b-z'])
  })

  it('excludes connections that do not allow every requested data class', () => {
    const selected = selectCandidates({
      connections: [
        connection({ id: 'public-only', dataClasses: ['public'], priority: 1 }),
        connection({ id: 'draft-ok', priority: 2 }),
      ],
      models: [
        model({ id: 'public-model', connectionId: 'public-only' }),
        model({ id: 'draft-model', connectionId: 'draft-ok' }),
      ],
      defaults: {},
      request: { capability: 'chat', dataClasses: ['draft'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['draft-model'])
  })

  it('does not select a chat-only model for structured output', () => {
    const selected = selectCandidates({
      connections: [connection()],
      models: [
        model(),
        model({
          id: 'structured-model',
          providerModelId: 'structured',
          capabilities: ['chat', 'structured-output'],
        }),
      ],
      defaults: {},
      request: { capability: 'structured-output', dataClasses: ['draft'] },
    })

    expect(
      selected.ok && selected.candidates.map(({ model }) => model.id),
    ).toEqual(['structured-model'])
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
        defaults: {},
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
