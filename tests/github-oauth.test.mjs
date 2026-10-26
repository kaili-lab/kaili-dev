import { describe, expect, it } from 'vitest'

import {
  buildGitHubAuthorizeUrl,
  decodeGitHubOAuthState,
  encodeGitHubOAuthState,
  isAllowedGitHubIdentity,
  isValidOAuthState,
  normalizeAdminReturnTo,
} from '../src/features/github-oauth.ts'

describe('GitHub OAuth protocol helpers', () => {
  it('builds a least-privilege authorization URL', () => {
    const url = new globalThis.URL(
      buildGitHubAuthorizeUrl({
        clientId: 'client-id',
        redirectUri: 'https://kaili.dev/auth/github/callback',
        state: 'state-value',
      }),
    )

    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    )
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://kaili.dev/auth/github/callback',
    )
    expect(url.searchParams.get('scope')).toBe('read:user')
    expect(url.searchParams.get('state')).toBe('state-value')
  })

  it('rejects missing or mismatched OAuth state', () => {
    expect(isValidOAuthState('same', 'same')).toBe(true)
    expect(isValidOAuthState(undefined, 'same')).toBe(false)
    expect(isValidOAuthState('same', undefined)).toBe(false)
    expect(isValidOAuthState('expected', 'received')).toBe(false)
  })

  it('authorizes the configured GitHub numeric user id only', () => {
    const identity = { id: 12345, login: 'kai-li' }
    expect(isAllowedGitHubIdentity(identity, '12345')).toBe(true)
    expect(isAllowedGitHubIdentity(identity, '54321')).toBe(false)
  })

  it('round-trips only internal admin return URLs', () => {
    const encoded = encodeGitHubOAuthState('state-value', '/admin/ideas?page=2')
    expect(decodeGitHubOAuthState(encoded)).toEqual({
      state: 'state-value',
      returnTo: '/admin/ideas?page=2',
    })
    expect(normalizeAdminReturnTo('https://attacker.example/admin')).toBe(
      '/admin/posts',
    )
    expect(normalizeAdminReturnTo('//attacker.example/admin')).toBe(
      '/admin/posts',
    )
    expect(normalizeAdminReturnTo('/admin/../public')).toBe('/admin/posts')
    expect(normalizeAdminReturnTo('/admin/login')).toBe('/admin/posts')
    expect(decodeGitHubOAuthState('{"state":1}')).toBeNull()
  })
})
