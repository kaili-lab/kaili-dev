import { createFileRoute } from '@tanstack/react-router'

import { uploadArticleMedia } from '#/features/media.server'

export const Route = createFileRoute('/api/media')({
  server: {
    handlers: {
      POST: ({ request }) => uploadArticleMedia(request),
    },
  },
})
