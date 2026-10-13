import { createFileRoute, notFound } from '@tanstack/react-router'

import { loadAdminArticle } from '#/features/admin.functions'
import { ArticleEditor } from '#/components/admin/article-editor'

export const Route = createFileRoute('/admin/posts/$id')({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: search.lang === 'en' ? ('en' as const) : ('zh' as const),
    done:
      search.done === 'save' || search.done === 'publish'
        ? (search.done as 'save' | 'publish')
        : undefined,
  }),
  loader: async ({ params }) => {
    const view = await loadAdminArticle({ data: { id: params.id } })
    if (!view) throw notFound()
    return view
  },
  component: EditArticle,
})

function EditArticle() {
  const view = Route.useLoaderData()
  const { lang, done } = Route.useSearch()
  // Key by article so navigating between articles starts a fresh editor.
  return (
    <ArticleEditor
      key={view.id ?? 'new'}
      initial={view}
      language={lang}
      done={done}
    />
  )
}
