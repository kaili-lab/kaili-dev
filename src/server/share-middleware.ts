import { createMiddleware } from '@tanstack/react-start'

import { getPost } from '#/server/data/posts'
import { runtimeDatabase } from '#/server/data/db'
import { resolveLanguage } from '#/features/routing'

function readLanguageCookie(cookie: string | null) {
  const value = cookie?.match(/(?:^|;\s*)kaili-language=(zh|en)(?:;|$)/)?.[1]
  return value === 'zh' || value === 'en' ? value : undefined
}

export const shareRedirect = createMiddleware().server(async ({ request }) => {
  const slug = new URL(request.url).pathname.split('/').at(-1)
  const post = slug ? await getPost(await runtimeDatabase(), slug) : undefined
  const language = resolveLanguage(
    readLanguageCookie(request.headers.get('cookie')),
    request.headers.get('accept-language'),
  )
  const fallback = post?.[language] ? language : language === 'zh' ? 'en' : 'zh'
  if (!post?.[fallback]) {
    throw new Response('Not Found', { status: 404 })
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `/${fallback}/writing/${slug}` },
  })
})
