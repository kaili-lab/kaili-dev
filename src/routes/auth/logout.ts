import { env as workerEnv } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import { revokeGitHubSession } from '#/features/github-auth.server'
import {
  clearCookie,
  hasSameOrigin,
  parseCookies,
  SESSION_COOKIE,
} from '#/server/auth-session'
import { authRuntimeEnv } from '#/server/auth-runtime'

export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasSameOrigin(request))
          return new Response('Forbidden', {
            status: 403,
            headers: { 'Cache-Control': 'no-store' },
          })
        const env = authRuntimeEnv(workerEnv)
        const requestUrl = new URL(request.url)
        const secure = requestUrl.protocol === 'https:'
        const sessionId = parseCookies(request.headers.get('cookie')).get(
          SESSION_COOKIE,
        )
        if (env.DB && sessionId)
          try {
            await revokeGitHubSession(env.DB, sessionId)
          } catch {
            // Browser logout must still complete when D1 is temporarily unavailable.
          }
        const headers = new Headers({
          Location: '/admin/login',
          'Cache-Control': 'no-store',
        })
        headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, secure))
        return new Response(null, { status: 303, headers })
      },
    },
  },
})
