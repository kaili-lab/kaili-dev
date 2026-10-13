import { createFileRoute, notFound } from '@tanstack/react-router'

import variantsCss from '../styles/writing-variants.css?url'
import { PublicLayout } from '#/components/public-site'
import {
  WritingVariant,
  type Variant,
  type VariantState,
} from '#/components/writing-variants'
import { developmentOnly } from '#/lib/development-only'

const variants: Variant[] = ['links', 'pills', 'select']
const states: VariantState[] = ['default', 'filtered', 'empty', 'notice']

export const Route = createFileRoute('/_writing-variants')({
  head: () => ({ links: [{ rel: 'stylesheet', href: variantsCss }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    variant: variants.includes(search.variant as Variant)
      ? (search.variant as Variant)
      : 'links',
    state: states.includes(search.state as VariantState)
      ? (search.state as VariantState)
      : 'default',
    lang: search.lang === 'en' ? ('en' as const) : ('zh' as const),
  }),
  server: { middleware: [developmentOnly] },
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound()
  },
  component: VariantsPage,
})

function VariantsPage() {
  const { variant, state, lang } = Route.useSearch()
  return (
    <div lang={lang}>
      <PublicLayout language={lang}>
        <WritingVariant variant={variant} state={state} language={lang} />
      </PublicLayout>
    </div>
  )
}
