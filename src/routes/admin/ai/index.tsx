import { createFileRoute } from '@tanstack/react-router'

import { AiOverviewPage } from '#/components/admin/ai-pages'
import { loadAiOverview } from '#/features/ai.functions'

export const Route = createFileRoute('/admin/ai/')({
  loader: () => loadAiOverview(),
  component: AdminAi,
})

function AdminAi() {
  return <AiOverviewPage overview={Route.useLoaderData()} />
}
