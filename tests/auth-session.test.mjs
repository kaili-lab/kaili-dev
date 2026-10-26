import { describe, expect, it } from 'vitest'

import {
  clearCookie,
  hasSameOrigin,
  parseCookies,
  setCookie,
  signValue,
  verifySignedValue,
} from '../src/server/auth-session.ts'

describe('session cookie helpers', () => {
  it('parses cookies without exposing unrelated attributes', () => {
    expect([
      ...parseCookies('a=one; kaili-session=abc%20def').entries(),
    ]).toEqual([
      ['a', 'one'],
      ['kaili-session', 'abc def'],
    ])
  })
  it('ignores a malformed cookie and keeps the others', () => {
    expect([...parseCookies('bad=%E0%A4%A; safe=value').entries()]).toEqual([
      ['safe', 'value'],
    ])
  })

  it('signs a value and rejects a changed value or secret', async () => {
    const signed = await signValue('session-id', 'local-secret')
    expect(await verifySignedValue(signed, 'local-secret')).toBe('session-id')
    expect(await verifySignedValue(`${signed}x`, 'local-secret')).toBeNull()
    expect(await verifySignedValue(signed, 'other-secret')).toBeNull()
  })

  it('sets HttpOnly SameSite cookies and clears them with max-age zero', () => {
    expect(setCookie('kaili-session', 'abc', 1800, true)).toBe(
      'kaili-session=abc; Path=/; Max-Age=1800; HttpOnly; SameSite=Lax; Secure',
    )
    expect(clearCookie('kaili-session', false)).toBe(
      'kaili-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    )
  })

  it('requires an exact Origin for state-changing browser requests', () => {
    const request = (origin) => ({
      url: 'https://kaili.dev/auth/logout',
      headers: { get: () => origin },
    })
    expect(hasSameOrigin(request('https://kaili.dev'))).toBe(true)
    expect(hasSameOrigin(request('https://attacker.example'))).toBe(false)
    expect(hasSameOrigin(request(null))).toBe(false)
  })
})
