import { createFileRoute } from '@tanstack/react-router'

import { languageRedirect } from '#/lib/language-middleware'

export const Route = createFileRoute('/')({
  server: { middleware: [languageRedirect] },
  component: RedirectedHome,
})

function RedirectedHome() {
  return null
}
