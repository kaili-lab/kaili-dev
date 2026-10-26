export type MediaLanguage = 'zh' | 'en'
export type MediaVisibility = 'draft' | 'published' | 'withdrawn'

export type MediaReference = {
  objectKey: string
  articleId: string
  language: MediaLanguage
  visibility: MediaVisibility
}

export type MediaObject = {
  objectKey: string
  createdAt: string
  unreferencedSince: string | null
}

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const MEDIA_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Returns the opaque R2 key only for URLs issued by the media endpoint. */
export function mediaObjectKey(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://kaili.dev')
    if (parsed.origin !== 'https://kaili.dev' || parsed.search || parsed.hash)
      return null
    const match = parsed.pathname.match(/^\/media\/([^/]+)$/)
    if (!match) return null
    const key = decodeURIComponent(match[1]!)
    return MEDIA_KEY.test(key) ? key : null
  } catch {
    return null
  }
}

/**
 * Recomputes the start of the unreferenced grace period. A referenced object
 * is never eligible for cleanup, and a newly unreferenced object starts its
 * seven-day window only once.
 */
export function refreshUnreferencedSince(
  object: MediaObject,
  references: readonly MediaReference[],
  now: string,
): MediaObject {
  if (references.some((reference) => reference.objectKey === object.objectKey))
    return { ...object, unreferencedSince: null }
  return {
    ...object,
    unreferencedSince: object.unreferencedSince ?? now,
  }
}

/**
 * D-047: cleanup rechecks references immediately before deletion. The caller
 * must run this against the current database state, not an earlier snapshot.
 */
export function isEligibleForCleanup(
  object: MediaObject,
  references: readonly MediaReference[],
  now: string,
): boolean {
  if (references.some((reference) => reference.objectKey === object.objectKey))
    return false
  if (!object.unreferencedSince) return false
  return Date.parse(now) - Date.parse(object.unreferencedSince) >= RETENTION_MS
}

export function referencesForSlot(
  references: readonly MediaReference[],
  articleId: string,
  language: MediaLanguage,
  visibility: MediaVisibility,
): MediaReference[] {
  return references.filter(
    (reference) =>
      reference.articleId === articleId &&
      reference.language === language &&
      reference.visibility === visibility,
  )
}

/** Replace one language/visibility slot without touching the other three. */
export function replaceSlotReferences(
  references: readonly MediaReference[],
  articleId: string,
  language: MediaLanguage,
  visibility: MediaVisibility,
  objectKeys: readonly string[],
): MediaReference[] {
  const retained = references.filter(
    (reference) =>
      reference.articleId !== articleId ||
      reference.language !== language ||
      reference.visibility !== visibility,
  )
  return [
    ...retained,
    ...objectKeys.map((objectKey) => ({
      objectKey,
      articleId,
      language,
      visibility,
    })),
  ]
}

export function canReadMedia(
  references: readonly MediaReference[],
  objectKey: string,
  authenticated: boolean,
): boolean {
  return references.some(
    (reference) =>
      reference.objectKey === objectKey &&
      (authenticated || reference.visibility === 'published'),
  )
}
