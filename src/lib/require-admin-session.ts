import { createMiddleware, createServerOnlyFn } from '@tanstack/react-start'

import type { GitHubSession } from '#/features/github-auth.server'
import { normalizeAdminReturnTo } from '#/features/github-oauth'
import {
  SESSION_COOKIE,
  clearCookie,
  parseCookies,
} from '#/server/auth-session'
import { authRuntimeEnv } from '#/server/auth-runtime'

type Authentication =
  | { status: 'authenticated'; session: GitHubSession }
  | { status: 'anonymous' | 'expired' | 'denied' | 'not-configured' }

const authenticate = createServerOnlyFn(
  async (request: Request): Promise<Authentication> => {
    const [{ env: workerEnv }, { findGitHubSession, revokeGitHubSession }] =
      await Promise.all([
        import('cloudflare:workers'),
        import('#/features/github-auth.server'),
      ])
    const env = authRuntimeEnv(workerEnv)
    if (!env.DB) return { status: 'not-configured' }
    const allowedUserConfigured = /^\d+$/.test(env.GITHUB_ALLOWED_USER_ID ?? '')
    if (!import.meta.env.DEV && !allowedUserConfigured)
      return { status: 'not-configured' }
    const sessionId = parseCookies(request.headers.get('cookie')).get(
      SESSION_COOKIE,
    )
    if (!sessionId) return { status: 'anonymous' }
    const session = await findGitHubSession(
      env.DB,
      sessionId,
      new Date().toISOString(),
    )
    if (!session) {
      await revokeGitHubSession(env.DB, sessionId)
      return { status: 'expired' }
    }
    const syntheticTestSession = import.meta.env.DEV && session.githubId === '0'
    if (syntheticTestSession) return { status: 'authenticated', session }
    if (!allowedUserConfigured) return { status: 'not-configured' }
    if (session.githubId !== env.GITHUB_ALLOWED_USER_ID) {
      await revokeGitHubSession(env.DB, sessionId)
      return { status: 'denied' }
    }
    return { status: 'authenticated', session }
  },
)

function returnTo(request: Request): string {
  const url = new URL(request.url)
  return normalizeAdminReturnTo(`${url.pathname}${url.search}`)
}

function redirectToLogin(
  request: Request,
  status: Authentication['status'],
): never {
  const params = new URLSearchParams({ returnTo: returnTo(request) })
  if (status === 'expired') params.set('error', 'session-expired')
  if (status === 'not-configured') params.set('error', 'not-configured')
  const headers = new Headers({ Location: `/admin/login?${params}` })
  if (status === 'expired' || status === 'denied')
    headers.append(
      'Set-Cookie',
      clearCookie(SESSION_COOKIE, new URL(request.url).protocol === 'https:'),
    )
  throw new Response(null, { status: 302, headers })
}

/** Document/page guard: anonymous users enter the login page. */
export const requireAdminSession = createMiddleware().server(
  async ({ request, next }) => {
    const pathname = new URL(request.url).pathname
    if (pathname === '/admin/login' || pathname === '/admin/access-denied')
      return next()
    const result = await authenticate(request)
    if (result.status === 'denied') {
      const headers = new Headers({ Location: '/admin/access-denied' })
      headers.append(
        'Set-Cookie',
        clearCookie(SESSION_COOKIE, new URL(request.url).protocol === 'https:'),
      )
      throw new Response(null, { status: 302, headers })
    }
    if (result.status !== 'authenticated')
      redirectToLogin(request, result.status)
    return next({ context: { adminUser: result.session } })
  },
)

/** RPC/API guard: never follow a redirect and accidentally return login HTML. */
export const requireAdminFunctionSession = createMiddleware().server(
  async ({ request, next }) => {
    const result = await authenticate(request)
    if (result.status !== 'authenticated')
      throw new Response(
        result.status === 'denied' ? 'Forbidden' : 'Unauthorized',
        {
          status: result.status === 'denied' ? 403 : 401,
        },
      )
    return next({ context: { adminUser: result.session } })
  },
)

/** Optional identity check for public media reads. */
export async function hasAdminSession(request: Request): Promise<boolean> {
  return (await authenticate(request)).status === 'authenticated'
}
