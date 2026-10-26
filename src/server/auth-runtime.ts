import type { D1Database } from '#/server/data/db'

export type AuthRuntimeEnv = {
  DB: D1Database
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GITHUB_ALLOWED_USER_ID: string
  SESSION_SECRET: string
}

export function authRuntimeEnv(value: unknown): AuthRuntimeEnv {
  return value as AuthRuntimeEnv
}
