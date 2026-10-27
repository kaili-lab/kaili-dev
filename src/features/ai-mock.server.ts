import type { FetchImpl } from '#/features/ai-openai.server'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

export const mockFetch: FetchImpl = async (input) => {
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
  return json({ error: 'not-found' }, 404)
}
