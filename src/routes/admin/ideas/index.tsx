import { createFileRoute } from '@tanstack/react-router'

import { parsePage } from '#/features/admin'
import { listIdeas } from '#/features/admin.functions'
import { IdeaList } from '#/components/admin/idea-pages'

export const Route = createFileRoute('/admin/ideas/')({
  // D-163 ②: page and search live in the address.
  validateSearch: (
    search: Record<string, unknown>,
  ): { page?: number; q?: string } => {
    const page = parsePage(search.page)
    return {
      page: page > 1 ? page : undefined,
      q: typeof search.q === 'string' && search.q !== '' ? search.q : undefined,
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listIdeas({ data: deps }),
  component: AdminIdeas,
})

function AdminIdeas() {
  return <IdeaList list={Route.useLoaderData()} q={Route.useSearch().q} />
}
