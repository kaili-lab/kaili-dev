import { createFileRoute } from '@tanstack/react-router'

import { resetStores } from '#/features/test-store.server'
import { developmentOnly } from '#/lib/development-only'

// Development-only test hook (excluded from production builds): put the
// prototype stores back to a named fixture before each admin e2e test.
export const Route = createFileRoute('/_test-reset')({
  server: {
    middleware: [developmentOnly],
    handlers: {
      POST: ({ request }) =>
        resetStores(
          new URL(request.url).searchParams.get('fixture') ?? 'default',
        )
          ? new Response(null, { status: 204 })
          : new Response('Unknown fixture', { status: 400 }),
    },
  },
})
