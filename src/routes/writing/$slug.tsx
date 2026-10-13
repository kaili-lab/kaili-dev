import { createFileRoute } from '@tanstack/react-router'

import { shareRedirect } from '#/server/share-middleware'

export const Route = createFileRoute('/writing/$slug')({
  server: { middleware: [shareRedirect] },
  component: NeutralSharePage,
})

function NeutralSharePage() {
  return null
}
