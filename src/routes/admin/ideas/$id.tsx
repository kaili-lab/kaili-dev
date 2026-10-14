import { createFileRoute, notFound } from '@tanstack/react-router'

import { loadIdea } from '#/features/admin.functions'
import { IdeaEditor } from '#/components/admin/idea-pages'

export const Route = createFileRoute('/admin/ideas/$id')({
  // D-164 ③: the detail page previews by default; ?mode=edit edits.
  validateSearch: (search: Record<string, unknown>): { mode?: 'edit' } => ({
    mode: search.mode === 'edit' ? 'edit' : undefined,
  }),
  loader: async ({ params }) => {
    const idea = await loadIdea({ data: { id: params.id } })
    if (!idea) throw notFound()
    return idea
  },
  component: AdminIdea,
})

function AdminIdea() {
  const idea = Route.useLoaderData()
  const { mode } = Route.useSearch()
  return <IdeaEditor key={idea.id} idea={idea} edit={mode === 'edit'} />
}
