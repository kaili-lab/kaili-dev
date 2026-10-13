import { createMiddleware } from '@tanstack/react-start'

import { normalizeWritingSearch } from '#/features/writing-list'
import { categories, tags } from '#/server/data/taxonomy'

/** D-132 / D-154: one 302 from a malformed list query to its canonical form. */
export const writingQueryRedirect = createMiddleware().server(
  async ({ request, next }) => {
    const url = new URL(request.url)
    const { canonicalSearch } = normalizeWritingSearch(url.search, {
      categories: categories.map((entry) => entry.slug),
      tags: tags.map((entry) => entry.slug),
    })
    if (canonicalSearch === undefined) return next()
    return new Response(null, {
      status: 302,
      headers: { Location: `${url.pathname}${canonicalSearch}` },
    })
  },
)
