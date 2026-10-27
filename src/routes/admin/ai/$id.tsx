import { createFileRoute, notFound } from '@tanstack/react-router'

import { AiConnectionPage } from '#/components/admin/ai-pages'
import { loadAiConnection } from '#/features/ai.functions'

export const Route = createFileRoute('/admin/ai/$id')({
  loader: async ({ params }) => {
    const connection = await loadAiConnection({ data: { id: params.id } })
    if (!connection) throw notFound()
    return connection
  },
  component: AdminAiConnection,
})

function AdminAiConnection() {
  const connection = Route.useLoaderData()
  return (
    <AiConnectionPage key={connection.connection.id} initial={connection} />
  )
}
