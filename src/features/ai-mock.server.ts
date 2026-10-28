import type { FetchImpl } from '#/features/ai-openai.server'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function requestModel(init: RequestInit | undefined): string {
  try {
    const body = JSON.parse(String(init?.body)) as { model?: unknown }
    return typeof body.model === 'string' ? body.model : ''
  } catch {
    return ''
  }
}

export const mockFetch: FetchImpl = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  const [behavior, version, endpoint] = url.pathname.split('/').filter(Boolean)

  if (behavior === 'down') return json({ error: 'unavailable' }, 503)
  if (behavior === 'badkey') return json({ error: 'unauthorized' }, 401)
  if (behavior === 'redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com/' },
    })
  }
  if (behavior !== 'ok' || version !== 'v1') {
    return json({ error: 'not-found' }, 404)
  }
  if (endpoint === 'models') {
    return json({ data: [{ id: 'mock-chat' }, { id: 'mock-json' }] })
  }
  if (endpoint === 'chat' && url.pathname.endsWith('/chat/completions')) {
    return json({
      choices: [
        {
          message: {
            content:
              '{"slugs":["mock-first-slug","mock-second-slug","Bad Slug"]}',
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 8 },
    })
  }
  if (endpoint === 'embeddings' || endpoint === 'images') {
    const model = requestModel(init)
    if (endpoint === 'embeddings' && model.includes('embed')) {
      return json({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 1 },
      })
    }
    if (endpoint === 'images' && model.includes('image')) {
      return json({ data: [{ b64_json: 'aGk=' }] })
    }
    return json({ error: 'unsupported-model' }, 400)
  }
  return json({ error: 'not-found' }, 404)
}
