import { createFileRoute } from '@tanstack/react-router'

import { loadTaxonomy } from '#/features/admin.functions'
import { TaxonomyPage } from '#/components/admin/taxonomy-page'

export const Route = createFileRoute('/admin/taxonomy')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === 'tags' ? ('tags' as const) : ('categories' as const),
  }),
  loader: () => loadTaxonomy(),
  component: AdminTaxonomy,
})

function AdminTaxonomy() {
  return (
    <TaxonomyPage tab={Route.useSearch().tab} data={Route.useLoaderData()} />
  )
}
