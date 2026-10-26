import { drizzle } from 'drizzle-orm/d1'
export type D1Database = Parameters<typeof drizzle>[0]
export type D1PreparedStatement = D1Database['prepare'] extends (
  ...args: never[]
) => infer Result
  ? Result
  : never

import * as schema from './schema'

export function createDb(database: D1Database) {
  return drizzle(database, { schema })
}

/** The request-bound D1 binding supplied by the Cloudflare Worker runtime. */
export async function runtimeDatabase(): Promise<D1Database> {
  // The Worker-only module is lazy so repository tests can import this module in Node.
  const { env } = await import('cloudflare:workers')
  if (!env.DB) throw new Error('D1 binding DB is unavailable')
  return env.DB as D1Database
}
