import { env as workerEnv } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import {
  buildGitHubAuthorizeUrl,
  encodeGitHubOAuthState,
  normalizeAdminReturnTo,
} from '#/features/github-oauth'
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
  setCookie,
  signValue,
} from '#/server/auth-session'
import { authRuntimeEnv } from '#/server/auth-runtime'

export const Route = createFileRoute('/auth/github/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = authRuntimeEnv(workerEnv)
        if (!env.GITHUB_CLIENT_ID || !env.SESSION_SECRET)
          return new Response(null, {
            status: 303,
            headers: { Location: '/admin/login?error=not-configured' },
          })

        const requestUrl = new URL(request.url)
        const redirectUri = new URL(
          '/auth/github/callback',
          requestUrl.origin,
        ).toString()
        const state = crypto.randomUUID()
        const returnTo = normalizeAdminReturnTo(
          requestUrl.searchParams.get('returnTo'),
        )
        const signedState = await signValue(
          encodeGitHubOAuthState(state, returnTo),
          env.SESSION_SECRET,
        )
        const location = buildGitHubAuthorizeUrl({
          clientId: env.GITHUB_CLIENT_ID,
          redirectUri,
          state,
        })
        const secure = requestUrl.protocol === 'https:'
        return new Response(null, {
          status: 302,
          headers: {
            Location: location,
            'Set-Cookie': setCookie(
              OAUTH_STATE_COOKIE,
              signedState,
              OAUTH_STATE_MAX_AGE,
              secure,
            ),
          },
        })
      },
    },
  },
})
