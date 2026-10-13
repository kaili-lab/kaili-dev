import { createFileRoute } from '@tanstack/react-router'

import { loadNewArticle } from '#/features/admin.functions'
import { ArticleEditor } from '#/components/admin/article-editor'

export const Route = createFileRoute('/admin/posts/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    idea: typeof search.idea === 'string' ? search.idea : undefined,
    lang: search.lang === 'en' ? ('en' as const) : ('zh' as const),
  }),
  loaderDeps: ({ search }) => ({ idea: search.idea }),
  loader: ({ deps }) => loadNewArticle({ data: { ideaId: deps.idea } }),
  component: NewArticle,
})

function NewArticle() {
  const view = Route.useLoaderData()
  const { lang } = Route.useSearch()
  return <ArticleEditor initial={view} language={lang} />
}
