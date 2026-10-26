import { describe, expect, it } from 'vitest'

import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  parseCookies,
  setCookie,
} from '../src/server/auth-session.ts'

describe('OAuth route cookie contract', () => {
  it('uses separate state and session cookie names', () => {
    expect(OAUTH_STATE_COOKIE).not.toBe(SESSION_COOKIE)
    expect(
      parseCookies(`${OAUTH_STATE_COOKIE}=state; ${SESSION_COOKIE}=session`),
    ).toEqual(
      new Map([
        [OAUTH_STATE_COOKIE, 'state'],
        [SESSION_COOKIE, 'session'],
      ]),
    )
  })

  it('clears OAuth state after callback failure', () => {
    expect(clearCookie(OAUTH_STATE_COOKIE, true)).toContain('Max-Age=0')
    expect(setCookie(SESSION_COOKIE, 'synthetic-session', 60, true)).toContain(
      'HttpOnly',
    )
  })
})
