import { createFileRoute } from '@tanstack/react-router'

import { sitemapResponse } from '#/features/sitemap.server'

export const Route = createFileRoute('/sitemap.xml')({
  server: { handlers: { GET: () => sitemapResponse() } },
})
