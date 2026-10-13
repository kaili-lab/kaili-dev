import { env } from 'cloudflare:workers'

import { publishedOgCard } from '#/features/og'
import { renderOgCard } from '#/server/og-card'

export async function publishedOgResponse(
  request: Request,
  language: string,
  slug: string,
): Promise<Response> {
  const input = publishedOgCard(language, slug)
  if (!input) return new Response('Not Found', { status: 404 })

  const card = await renderOgCard(input, async (url) => {
    const response = await env.ASSETS.fetch(
      new Request(new URL(url, request.url)),
    )
    if (!response.ok)
      throw new Error(`OG font asset failed: ${url} (${response.status})`)
    return response.arrayBuffer()
  })
  return new Response(card.png as Uint8Array<ArrayBuffer>, {
    headers: {
      'Content-Type': 'image/png',
      // No persistent card cache until the real publish flow can invalidate it.
      'Cache-Control': 'no-store',
    },
  })
}
