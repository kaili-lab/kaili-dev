import { createFileRoute } from '@tanstack/react-router'

import { listIdeas } from '#/features/admin.functions'
import { IdeaList } from '#/components/admin/idea-pages'

export const Route = createFileRoute('/admin/ideas/')({
  loader: () => listIdeas(),
  component: AdminIdeas,
})

function AdminIdeas() {
  return <IdeaList ideas={Route.useLoaderData()} />
}
