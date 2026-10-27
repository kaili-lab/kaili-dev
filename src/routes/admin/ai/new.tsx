import { createFileRoute } from '@tanstack/react-router'

import { AiConnectionPage } from '#/components/admin/ai-pages'

export const Route = createFileRoute('/admin/ai/new')({
  component: NewAiConnection,
})

function NewAiConnection() {
  return <AiConnectionPage initial={null} />
}
