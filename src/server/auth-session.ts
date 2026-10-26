export const SESSION_COOKIE = 'kaili-session'
export const OAUTH_STATE_COOKIE = 'kaili-oauth-state'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
export const OAUTH_STATE_MAX_AGE = 60 * 10

function encode(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const name = part.slice(0, separator).trim()
    try {
      cookies.set(name, decodeURIComponent(part.slice(separator + 1).trim()))
    } catch {
      // Ignore one malformed cookie without breaking unrelated requests.
    }
  }
  return cookies
}

export async function signValue(
  value: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )
  return `${value}.${encode(new Uint8Array(signature))}`
}

export async function verifySignedValue(
  signedValue: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!signedValue) return null
  const separator = signedValue.lastIndexOf('.')
  if (separator < 1) return null
  const value = signedValue.slice(0, separator)
  const expected = await signValue(value, secret)
  const expectedBytes = new TextEncoder().encode(expected)
  const actualBytes = new TextEncoder().encode(signedValue)
  if (expectedBytes.length !== actualBytes.length) return null
  let difference = 0
  for (let index = 0; index < expectedBytes.length; index += 1)
    difference |= (expectedBytes[index] ?? 0) ^ (actualBytes[index] ?? 0)
  return difference === 0 ? value : null
}

export function setCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function clearCookie(name: string, secure: boolean): string {
  return setCookie(name, '', 0, secure)
}

/** State-changing browser requests must carry an exact same-origin Origin. */
export function hasSameOrigin(request: {
  url: string
  headers: { get(name: string): string | null }
}): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}
