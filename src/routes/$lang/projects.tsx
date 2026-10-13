import { createFileRoute } from '@tanstack/react-router'

import { K2ProjectItem } from '#/components/k2'
import { PublicLayout, PublicPageHeading } from '#/components/public-site'
import type { Language } from '#/features/routing'
import { loadSiteContent } from '#/features/site-content.functions'

export const Route = createFileRoute('/$lang/projects')({
  loader: async ({ params }) =>
    loadSiteContent({ data: params.lang as Language }),
  head: ({ params }) => ({
    meta: [
      {
        title:
          params.lang === 'zh'
            ? '做过的东西 — Kai Li'
            : "Things I've made — Kai Li",
      },
    ],
    links: [
      { rel: 'canonical', href: `/${params.lang}/projects` },
      { rel: 'alternate', hrefLang: 'zh-CN', href: '/zh/projects' },
      { rel: 'alternate', hrefLang: 'en', href: '/en/projects' },
    ],
  }),
  component: ProjectsPage,
})

function ProjectsPage() {
  const { lang } = Route.useParams()
  const language = lang as Language
  const { projects } = Route.useLoaderData()

  return (
    <PublicLayout language={language} page="projects">
      <PublicPageHeading
        title={language === 'zh' ? '做过的东西' : "Things I've made"}
      />
      <ul className="k2-projects">
        {projects.map((project) => (
          <K2ProjectItem
            key={project.name}
            mode="detail"
            name={project.name}
            why={project.why}
            introduction={project.introduction}
            image={{
              src: project.image,
              alt:
                language === 'zh'
                  ? `${project.name} 的首页截图`
                  : `${project.name} home page`,
            }}
            url={project.url}
            repository={project.repository}
            status={project.status}
            active={project.active}
          />
        ))}
      </ul>
    </PublicLayout>
  )
}
