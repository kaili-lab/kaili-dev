import { createFileRoute } from '@tanstack/react-router'

import { publishedOgResponse } from '#/features/og.server'

export const Route = createFileRoute('/og/$lang/$slug')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        publishedOgResponse(request, params.lang, params.slug),
    },
  },
})
