import { createFileRoute, notFound } from '@tanstack/react-router'

import catalogueCss from '../styles/design-catalogue.css?url'
import { DesignCatalogue } from '#/components/design-catalogue'
import { developmentOnly } from '#/lib/development-only'

export const Route = createFileRoute('/_design')({
  head: () => ({ links: [{ rel: 'stylesheet', href: catalogueCss }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    lang: search.lang === 'en' ? ('en' as const) : ('zh' as const),
  }),
  server: {
    middleware: [developmentOnly],
  },
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound()
  },
  component: DesignPage,
})

function DesignPage() {
  const { lang } = Route.useSearch()
  return (
    <div lang={lang}>
      <DesignCatalogue language={lang} />
    </div>
  )
}
