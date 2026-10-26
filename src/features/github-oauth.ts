export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_USER_URL = 'https://api.github.com/user'
export const GITHUB_OAUTH_SCOPE = 'read:user'

export const DEFAULT_ADMIN_RETURN_TO = '/admin/posts'

/** Only an internal admin page may survive the OAuth round trip. */
export function normalizeAdminReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/'))
    return DEFAULT_ADMIN_RETURN_TO
  try {
    const decoded = decodeURIComponent(value)
    if (value.startsWith('//') || decoded.includes('\\'))
      return DEFAULT_ADMIN_RETURN_TO
    const url = new URL(value, 'https://kaili.dev')
    const adminPath =
      url.pathname === '/admin' || url.pathname.startsWith('/admin/')
    if (
      url.origin !== 'https://kaili.dev' ||
      !adminPath ||
      url.pathname === '/admin/login' ||
      url.pathname === '/admin/access-denied'
    )
      return DEFAULT_ADMIN_RETURN_TO
    return `${url.pathname}${url.search}`
  } catch {
    return DEFAULT_ADMIN_RETURN_TO
  }
}

export type GitHubOAuthState = { state: string; returnTo: string }

export function encodeGitHubOAuthState(
  state: string,
  returnTo: unknown,
): string {
  return JSON.stringify({ state, returnTo: normalizeAdminReturnTo(returnTo) })
}

export function decodeGitHubOAuthState(
  value: string | null,
): GitHubOAuthState | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).state !== 'string'
    )
      return null
    const state = (parsed as Record<string, unknown>).state as string
    if (state === '') return null
    return {
      state,
      returnTo: normalizeAdminReturnTo(
        (parsed as Record<string, unknown>).returnTo,
      ),
    }
  } catch {
    return null
  }
}

export type GitHubAuthorizeInput = {
  clientId: string
  redirectUri: string
  state: string
}

export type GitHubIdentity = {
  id: number
  login: string
}

export function buildGitHubAuthorizeUrl({
  clientId,
  redirectUri,
  state,
}: GitHubAuthorizeInput): string {
  const url = new URL(GITHUB_AUTHORIZE_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', GITHUB_OAUTH_SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

export function isValidOAuthState(
  expected: string | null | undefined,
  received: string | null | undefined,
): boolean {
  return Boolean(expected && received && expected === received)
}

export function isAllowedGitHubIdentity(
  identity: GitHubIdentity,
  allowedUserId: string,
): boolean {
  return String(identity.id) === allowedUserId
}
