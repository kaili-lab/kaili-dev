import { createFileRoute, notFound } from '@tanstack/react-router'

import variantsCss from '../styles/admin-variants.css?url'
import {
  AdminVariantPage,
  type AdminPage,
  type AdminVariant,
  type Feedback,
} from '#/components/admin-variants'
import { developmentOnly } from '#/lib/development-only'

const codes = ['N', 'D', 'P', 'M'] as const
type Code = (typeof codes)[number]
const pick = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
) => (options.includes(value as T) ? (value as T) : fallback)

export const Route = createFileRoute('/_admin-variants')({
  head: () => ({ links: [{ rel: 'stylesheet', href: variantsCss }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    variant: pick<AdminVariant>(search.variant, ['a', 'b'], 'a'),
    page: pick<AdminPage>(
      search.page,
      ['list', 'list-empty', 'editor'],
      'list',
    ),
    tab: pick(search.tab, ['zh', 'en'] as const, 'zh'),
    zh: pick<Code>(search.zh, codes, 'P'),
    en: pick<Code>(search.en, codes, 'M'),
    unsaved: [1, '1', true, 'true'].includes(search.unsaved as never),
    feedback: pick<Feedback>(
      search.feedback,
      ['none', 'saved', 'published', 'error'],
      'none',
    ),
  }),
  server: { middleware: [developmentOnly] },
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound()
  },
  component: VariantsPage,
})

function VariantsPage() {
  return <AdminVariantPage {...Route.useSearch()} />
}
