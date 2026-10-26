import { env } from 'cloudflare:workers'

import { mediaObjectKey } from '#/features/media-lifecycle'
import { hasAdminSession } from '#/lib/require-admin-session'
import type { D1Database } from '#/server/data/db'
import {
  MEDIA_CONTENT_TYPES,
  MEDIA_MAX_BYTES,
  cleanupUnreferencedMedia,
  mediaAccess,
  registerUploadedMedia,
  type MediaBucket,
} from '#/server/data/media'

export type MediaRuntimeEnv = { DB: D1Database; MEDIA: MediaBucket }

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function uploadArticleMedia(request: Request): Promise<Response> {
  if (!(await hasAdminSession(request)))
    return json({ error: 'unauthorized' }, 401)
  if (!env.DB || !env.MEDIA) return json({ error: 'not-configured' }, 503)

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return json({ error: 'file-required' }, 400)
  if (!MEDIA_CONTENT_TYPES.has(file.type))
    return json({ error: 'unsupported-type' }, 415)
  if (file.size < 1 || file.size > MEDIA_MAX_BYTES)
    return json({ error: 'invalid-size' }, 413)

  const objectKey = crypto.randomUUID()
  try {
    // Register first: an ambiguous R2 failure still has a row the cron can clean.
    await registerUploadedMedia(
      env.DB,
      objectKey,
      file.type,
      file.size,
      new Date().toISOString(),
    )
    await env.MEDIA.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    })
    return json({ url: `/media/${objectKey}` }, 201)
  } catch {
    return json({ error: 'upload-failed' }, 503)
  }
}

export async function articleMediaResponse(
  request: Request,
  key: string,
): Promise<Response> {
  const objectKey = mediaObjectKey(`/media/${key}`)
  if (!objectKey || !env.DB || !env.MEDIA)
    return new Response('Not Found', { status: 404 })
  const access = await mediaAccess(
    env.DB,
    objectKey,
    await hasAdminSession(request),
  )
  if (!access) return new Response('Not Found', { status: 404 })
  const object = await env.MEDIA.get(objectKey)
  if (!object) return new Response('Not Found', { status: 404 })
  const headers = new Headers({
    'Content-Type': access.contentType,
    'Content-Length': String(access.byteLength),
    'Cache-Control': access.publiclyReadable
      ? 'public, max-age=31536000, immutable'
      : 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  if (object.httpEtag) headers.set('ETag', object.httpEtag)
  return new Response(object.body, { headers })
}

export async function runMediaCleanup(
  runtime: MediaRuntimeEnv,
  now = new Date().toISOString(),
): Promise<void> {
  const result = await cleanupUnreferencedMedia(runtime.DB, runtime.MEDIA, now)
  const message = `Media cleanup: ${result.deleted} deleted, ${result.retained} retained, ${result.failed} failed`
  if (result.failed > 0) console.error(message)
  else console.info(message)
}
