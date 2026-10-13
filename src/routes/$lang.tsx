import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang')({
  beforeLoad: ({ params }) => {
    if (params.lang !== 'zh' && params.lang !== 'en') throw notFound()
  },
  component: LanguageLayout,
})

function LanguageLayout() {
  return <Outlet />
}
