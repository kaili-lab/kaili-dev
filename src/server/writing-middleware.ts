import { createMiddleware } from '@tanstack/react-start'

import { normalizeWritingSearch } from '#/features/writing-list'
import { listTaxonomy } from '#/server/data/taxonomy'
import { runtimeDatabase } from '#/server/data/db'
/** D-132 / D-154: one 302 from a malformed list query to its canonical form. */
export const writingQueryRedirect = createMiddleware().server(
  async ({ request, next }) => {
    const url = new URL(request.url)
    const database = await runtimeDatabase()
    const [categoryEntries, tagEntries] = await Promise.all([
      listTaxonomy(database, 'categories'),
      listTaxonomy(database, 'tags'),
    ])
    const { canonicalSearch } = normalizeWritingSearch(url.search, {
      categories: categoryEntries.map((entry) => entry.slug),
      tags: tagEntries.map((entry) => entry.slug),
    })
    if (canonicalSearch === undefined) return next()
    return new Response(null, {
      status: 302,
      headers: { Location: `${url.pathname}${canonicalSearch}` },
    })
  },
)
