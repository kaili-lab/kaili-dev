import { createFileRoute } from '@tanstack/react-router'

import {
  createSyntheticAdminSession,
  resetStores,
  verifyArticleAtomicity,
  verifyMediaCleanupBoundary,
  verifyMediaCleanupRetry,
} from '#/features/test-store.server'
import { developmentOnly } from '#/lib/development-only'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  setCookie,
} from '#/server/auth-session'

// Development-only test hook. Production requests receive 404.
export const Route = createFileRoute('/_test-reset')({
  server: {
    middleware: [developmentOnly],
    handlers: {
      POST: async ({ request }) => {
        const fixture =
          new URL(request.url).searchParams.get('fixture') ?? 'default'
        if (!(await resetStores(fixture)))
          return new Response('Unknown fixture', { status: 400 })
        const verification = new URL(request.url).searchParams.get('verify')
        if (verification === 'atomicity' && !(await verifyArticleAtomicity()))
          return new Response('D1 batch was not atomic', { status: 500 })
        if (
          verification === 'media-cleanup-retry' &&
          !(await verifyMediaCleanupRetry())
        )
          return new Response('Media cleanup retry failed', { status: 500 })
        if (
          verification === 'media-cleanup-boundary' &&
          !(await verifyMediaCleanupBoundary())
        )
          return new Response('Media cleanup boundary failed', { status: 500 })
        const sessionId = await createSyntheticAdminSession()
        return new Response(null, {
          status: 204,
          headers: {
            'Set-Cookie': setCookie(
              SESSION_COOKIE,
              sessionId,
              SESSION_MAX_AGE,
              false,
            ),
          },
        })
      },
    },
  },
})
