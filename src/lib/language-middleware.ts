import { createMiddleware } from '@tanstack/react-start'

import { resolveLanguage } from '#/features/routing'

function readLanguageCookie(cookie: string | null) {
  const value = cookie?.match(/(?:^|;\s*)kaili-language=(zh|en)(?:;|$)/)?.[1]
  return value === 'zh' || value === 'en' ? value : undefined
}

export const languageRedirect = createMiddleware().server(
  async ({ request }) => {
    const language = resolveLanguage(
      readLanguageCookie(request.headers.get('cookie')),
      request.headers.get('accept-language'),
    )
    return new Response(null, {
      status: 302,
      headers: { Location: `/${language}` },
    })
  },
)
