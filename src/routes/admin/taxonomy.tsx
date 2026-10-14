import { createFileRoute } from '@tanstack/react-router'

import { parsePage } from '#/features/admin'
import { loadTaxonomy } from '#/features/admin.functions'
import { TaxonomyPage } from '#/components/admin/taxonomy-page'

export const Route = createFileRoute('/admin/taxonomy')({
  // D-163 ②: tab and page live in the address; categories by default.
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: 'tags'; page?: number } => {
    const page = parsePage(search.page)
    return {
      tab: search.tab === 'tags' ? ('tags' as const) : undefined,
      page: page > 1 ? page : undefined,
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadTaxonomy({ data: deps }),
  component: AdminTaxonomy,
})

function AdminTaxonomy() {
  return (
    <TaxonomyPage
      tab={Route.useSearch().tab ?? 'categories'}
      data={Route.useLoaderData()}
    />
  )
}
