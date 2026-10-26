import { createFileRoute } from '@tanstack/react-router'

import { articleMediaResponse } from '#/features/media.server'

export const Route = createFileRoute('/media/$key')({
  server: {
    handlers: {
      GET: ({ request, params }) => articleMediaResponse(request, params.key),
    },
  },
})
