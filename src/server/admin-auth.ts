import { notFound } from '@tanstack/react-router'

export type AdminUser = { name: string }

/**
 * Login check for every admin server function and route (D-132). Until the
 * GitHub login lands, development returns the fake "Kai Li" session and
 * production builds have no admin at all. Callers keep this signature when
 * the real implementation replaces the body.
 */
export function requireAdmin(): AdminUser {
  if (import.meta.env.PROD) throw notFound()
  return { name: 'Kai Li' }
}
