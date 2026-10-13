import { createFileRoute, notFound } from '@tanstack/react-router'

import { loadIdea } from '#/features/admin.functions'
import { IdeaEditor } from '#/components/admin/idea-pages'

export const Route = createFileRoute('/admin/ideas/$id')({
  loader: async ({ params }) => {
    const idea = await loadIdea({ data: { id: params.id } })
    if (!idea) throw notFound()
    return idea
  },
  component: AdminIdea,
})

function AdminIdea() {
  const idea = Route.useLoaderData()
  return <IdeaEditor key={idea.id} idea={idea} />
}
