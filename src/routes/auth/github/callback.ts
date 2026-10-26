import { env as workerEnv } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'

import {
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  decodeGitHubOAuthState,
  isAllowedGitHubIdentity,
  isValidOAuthState,
} from '#/features/github-oauth'
import { createGitHubSession } from '#/features/github-auth.server'
import {
  clearCookie,
  OAUTH_STATE_COOKIE,
  parseCookies,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  setCookie,
  verifySignedValue,
} from '#/server/auth-session'
import { authRuntimeEnv } from '#/server/auth-runtime'

function callbackFailure(
  error: 'not-configured' | 'login-error' | 'login-cancelled' | 'access-denied',
  secure: boolean,
): Response {
  const location =
    error === 'access-denied'
      ? '/admin/access-denied'
      : `/admin/login?error=${error}`
  const headers = new Headers({
    Location: location,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  })
  headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE, secure))
  return new Response(null, { status: 303, headers })
}

export const Route = createFileRoute('/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = authRuntimeEnv(workerEnv)
        const requestUrl = new URL(request.url)
        const secure = requestUrl.protocol === 'https:'
        if (
          !env.DB ||
          !env.GITHUB_CLIENT_ID ||
          !env.GITHUB_CLIENT_SECRET ||
          !/^\d+$/.test(env.GITHUB_ALLOWED_USER_ID ?? '') ||
          !env.SESSION_SECRET
        )
          return callbackFailure('not-configured', secure)

        try {
          const queryState = requestUrl.searchParams.get('state')
          const code = requestUrl.searchParams.get('code')
          const cookies = parseCookies(request.headers.get('cookie'))
          const statePayload = decodeGitHubOAuthState(
            await verifySignedValue(
              cookies.get(OAUTH_STATE_COOKIE),
              env.SESSION_SECRET,
            ),
          )
          if (!isValidOAuthState(statePayload?.state, queryState))
            return callbackFailure('login-error', secure)
          const githubError = requestUrl.searchParams.get('error')
          if (githubError)
            return callbackFailure(
              githubError === 'access_denied'
                ? 'login-cancelled'
                : 'login-error',
              secure,
            )
          if (!code) return callbackFailure('login-error', secure)

          const redirectUri = new URL(
            '/auth/github/callback',
            requestUrl.origin,
          ).toString()
          const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code,
              redirect_uri: redirectUri,
            }),
          })
          if (!tokenResponse.ok) return callbackFailure('login-error', secure)

          const token = (await tokenResponse.json()) as {
            access_token?: unknown
          }
          if (typeof token.access_token !== 'string')
            return callbackFailure('login-error', secure)

          const userResponse = await fetch(GITHUB_USER_URL, {
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token.access_token}`,
              'User-Agent': 'kaili.dev',
            },
          })
          if (!userResponse.ok) return callbackFailure('login-error', secure)

          const user = (await userResponse.json()) as {
            id?: unknown
            login?: unknown
          }
          if (typeof user.id !== 'number' || typeof user.login !== 'string')
            return callbackFailure('login-error', secure)
          const identity = { id: user.id, login: user.login }
          if (!isAllowedGitHubIdentity(identity, env.GITHUB_ALLOWED_USER_ID))
            return callbackFailure('access-denied', secure)

          const now = new Date().toISOString()
          const sessionId = crypto.randomUUID()
          await createGitHubSession(
            env.DB,
            identity,
            now,
            new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
            sessionId,
            cookies.get(SESSION_COOKIE),
          )

          const headers = new Headers()
          headers.set('Location', statePayload!.returnTo)
          headers.set('Cache-Control', 'no-store')
          headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE, secure))
          headers.append(
            'Set-Cookie',
            setCookie(SESSION_COOKIE, sessionId, SESSION_MAX_AGE, secure),
          )
          return new Response(null, { status: 302, headers })
        } catch {
          return callbackFailure('login-error', secure)
        }
      },
    },
  },
})
